import 'server-only';
import { query, queryOne } from '../db';

// ---------------------------------------------------------------- Programs

export interface ProgramRow {
  id: string;
  code: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  subject_count: number;
  test_count: number;
}

export async function listPrograms(): Promise<ProgramRow[]> {
  return query<ProgramRow>(
    `SELECT p.id, p.code, p.name, p.slug, p.description, p.icon, p.sort_order,
            (SELECT COUNT(*) FROM program_subjects ps WHERE ps.program_id = p.id)::int AS subject_count,
            (SELECT COUNT(*) FROM test_series ts WHERE ts.program_id = p.id AND ts.status = 'PUBLISHED')::int AS test_count
       FROM programs p
      WHERE p.is_active = true
      ORDER BY p.sort_order, p.name`,
  );
}

export async function getProgramBySlug(slug: string) {
  return queryOne<ProgramRow>(
    `SELECT p.id, p.code, p.name, p.slug, p.description, p.icon, p.sort_order,
            (SELECT COUNT(*) FROM program_subjects ps WHERE ps.program_id = p.id)::int AS subject_count,
            (SELECT COUNT(*) FROM test_series ts WHERE ts.program_id = p.id AND ts.status = 'PUBLISHED')::int AS test_count
       FROM programs p
      WHERE p.slug = $1 AND p.is_active = true`,
    [slug],
  );
}

// ---------------------------------------------------------------- Subjects

export interface SubjectRow {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  topic_count: number;
  question_count: number;
}

export async function listSubjectsForProgram(programId: string): Promise<SubjectRow[]> {
  return query<SubjectRow>(
    `SELECT s.id, s.name, s.slug, s.icon, s.description,
            (SELECT COUNT(*) FROM topics t WHERE t.subject_id = s.id)::int AS topic_count,
            (SELECT COUNT(*) FROM questions q WHERE q.subject_id = s.id AND q.review_status = 'APPROVED')::int AS question_count
       FROM subjects s
       JOIN program_subjects ps ON ps.subject_id = s.id
      WHERE ps.program_id = $1
      ORDER BY s.sort_order, s.name`,
    [programId],
  );
}

export async function getSubjectBySlug(slug: string) {
  return queryOne<SubjectRow>(
    `SELECT s.id, s.name, s.slug, s.icon, s.description,
            (SELECT COUNT(*) FROM topics t WHERE t.subject_id = s.id)::int AS topic_count,
            (SELECT COUNT(*) FROM questions q WHERE q.subject_id = s.id AND q.review_status = 'APPROVED')::int AS question_count
       FROM subjects s WHERE s.slug = $1`,
    [slug],
  );
}

// ---------------------------------------------------------------- Topics

export interface TopicRow {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  question_count: number;
}

export async function listTopicsForSubject(subjectId: string): Promise<TopicRow[]> {
  return query<TopicRow>(
    `SELECT t.id, t.name, t.slug, t.parent_id, t.sort_order,
            (SELECT COUNT(*) FROM questions q WHERE q.topic_id = t.id AND q.review_status = 'APPROVED')::int AS question_count
       FROM topics t
      WHERE t.subject_id = $1
      ORDER BY t.sort_order, t.name`,
    [subjectId],
  );
}

/** Builds a nested tree from a flat topic list. */
export function buildTopicTree(topics: TopicRow[]): (TopicRow & { children: TopicRow[] })[] {
  const map = new Map<string, TopicRow & { children: TopicRow[] }>();
  const roots: (TopicRow & { children: TopicRow[] })[] = [];

  for (const t of topics) map.set(t.id, { ...t, children: [] });

  for (const t of topics) {
    const node = map.get(t.id)!;
    if (t.parent_id && map.has(t.parent_id)) {
      map.get(t.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

// ---------------------------------------------------------------- Full catalog tree

export interface CatalogTree {
  programs: (ProgramRow & {
    subjects: (SubjectRow & {
      topics: (TopicRow & { children: TopicRow[] })[];
    })[];
  })[];
}

export async function getFullCatalog(): Promise<CatalogTree> {
  const programs = await listPrograms();
  const tree = await Promise.all(
    programs.map(async (p) => {
      const subjects = await listSubjectsForProgram(p.id);
      const subjectsWithTopics = await Promise.all(
        subjects.map(async (s) => {
          const topics = await listTopicsForSubject(s.id);
          return { ...s, topics: buildTopicTree(topics) };
        }),
      );
      return { ...p, subjects: subjectsWithTopics };
    }),
  );
  return { programs: tree };
}

// ---------------------------------------------------------------- Test listing with filters

export interface FilteredTestRow {
  id: string;
  title: string;
  description: string | null;
  price: number;
  is_free: boolean;
  duration_minutes: number;
  test_type: string | null;
  question_count: number;
  slug: string | null;
  program_name: string | null;
  subject_name: string | null;
}

export async function listTestsFiltered(opts: {
  programSlug?: string;
  subjectSlug?: string;
  testType?: string;
  isFree?: boolean;
}): Promise<FilteredTestRow[]> {
  const where = [`ts.status = 'PUBLISHED'`];
  const params: unknown[] = [];

  if (opts.programSlug) {
    params.push(opts.programSlug);
    where.push(`p.slug = $${params.length}`);
  }
  if (opts.subjectSlug) {
    params.push(opts.subjectSlug);
    where.push(`s.slug = $${params.length}`);
  }
  if (opts.testType) {
    params.push(opts.testType);
    where.push(`ts.test_type = $${params.length}`);
  }
  if (opts.isFree !== undefined) {
    params.push(opts.isFree);
    where.push(`ts.is_free = $${params.length}`);
  }

  return query<FilteredTestRow>(
    `SELECT ts.id, ts.title, ts.description, ts.price, ts.is_free, ts.duration_minutes,
            ts.test_type, ts.slug,
            (SELECT COUNT(*) FROM questions q WHERE q.test_series_id = ts.id AND q.review_status = 'APPROVED')::int AS question_count,
            p.name AS program_name, s.name AS subject_name
       FROM test_series ts
       LEFT JOIN programs p ON p.id = ts.program_id
       LEFT JOIN subjects s ON s.id = ts.subject_id
      WHERE ${where.join(' AND ')}
      ORDER BY ts.is_free DESC, ts.published_at DESC NULLS LAST`,
    params,
  );
}

// ---------------------------------------------------------------- PYQ Papers

export interface ExamPaperRow {
  id: string;
  exam_name: string;
  exam_year: number;
  shift: string | null;
  program_name: string;
  total_questions: number | null;
  question_count: number;
}

export async function listExamPapers(programSlug?: string): Promise<ExamPaperRow[]> {
  const where = [];
  const params: unknown[] = [];
  if (programSlug) {
    params.push(programSlug);
    where.push(`p.slug = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  return query<ExamPaperRow>(
    `SELECT ep.id, ep.exam_name, ep.exam_year, ep.shift, p.name AS program_name,
            ep.total_questions,
            (SELECT COUNT(*) FROM questions q WHERE q.exam_paper_id = ep.id AND q.review_status = 'APPROVED')::int AS question_count
       FROM exam_papers ep
       JOIN programs p ON p.id = ep.program_id
       ${whereSql}
      ORDER BY ep.exam_year DESC, ep.exam_name, ep.shift NULLS LAST`,
    params,
  );
}

export async function getExamPaperQuestions(paperId: string) {
  return query(
    `SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
            q.paper_qno, q.question_order
       FROM questions q
      WHERE q.exam_paper_id = $1 AND q.review_status = 'APPROVED'
      ORDER BY q.paper_qno NULLS LAST, q.question_order`,
    [paperId],
  );
}
