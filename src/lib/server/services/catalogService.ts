import 'server-only';
import { prisma } from '../db';
import { Prisma } from '@prisma/client';

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
  const programs = await prisma.programs.findMany({
    where: { is_active: true },
    orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    include: {
      _count: {
        select: {
          program_subjects: true,
          test_series: { where: { status: 'PUBLISHED' } },
        },
      },
    },
  });
  return programs.map(p => ({
    id: p.id,
    code: p.code,
    name: p.name,
    slug: p.slug,
    description: p.description,
    icon: p.icon,
    sort_order: p.sort_order,
    subject_count: p._count.program_subjects,
    test_count: p._count.test_series,
  }));
}

export async function getProgramBySlug(slug: string): Promise<ProgramRow | null> {
  const p = await prisma.programs.findUnique({
    where: { slug, is_active: true },
    include: {
      _count: {
        select: {
          program_subjects: true,
          test_series: { where: { status: 'PUBLISHED' } },
        },
      },
    },
  });
  if (!p) return null;
  return {
    id: p.id, code: p.code, name: p.name, slug: p.slug, description: p.description,
    icon: p.icon, sort_order: p.sort_order,
    subject_count: p._count.program_subjects,
    test_count: p._count.test_series,
  };
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
  const subjects = await prisma.subjects.findMany({
    where: {
      program_subjects: { some: { program_id: programId } }
    },
    orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    include: {
      _count: {
        select: {
          topics: true,
          questions: { where: { review_status: 'APPROVED' } }
        }
      }
    }
  });
  return subjects.map(s => ({
    id: s.id, name: s.name, slug: s.slug, icon: s.icon, description: s.description,
    topic_count: s._count.topics, question_count: s._count.questions,
  }));
}

export async function getSubjectBySlug(slug: string): Promise<SubjectRow | null> {
  const s = await prisma.subjects.findUnique({
    where: { slug },
    include: {
      _count: {
        select: {
          topics: true,
          questions: { where: { review_status: 'APPROVED' } }
        }
      }
    }
  });
  if (!s) return null;
  return {
    id: s.id, name: s.name, slug: s.slug, icon: s.icon, description: s.description,
    topic_count: s._count.topics, question_count: s._count.questions,
  };
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
  const topics = await prisma.topics.findMany({
    where: { subject_id: subjectId },
    orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    include: {
      _count: {
        select: {
          questions: { where: { review_status: 'APPROVED' } }
        }
      }
    }
  });
  return topics.map(t => ({
    id: t.id, name: t.name, slug: t.slug, parent_id: t.parent_id, sort_order: t.sort_order,
    question_count: t._count.questions,
  }));
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
  const where: Prisma.test_seriesWhereInput = { status: 'PUBLISHED' };
  
  if (opts.programSlug) where.programs = { slug: opts.programSlug };
  if (opts.subjectSlug) where.subjects = { slug: opts.subjectSlug };
  if (opts.testType) where.test_type = opts.testType as any;
  if (opts.isFree !== undefined) where.is_free = opts.isFree;

  const tests = await prisma.test_series.findMany({
    where,
    orderBy: [
      { is_free: 'desc' },
      { published_at: 'desc' }
    ],
    include: {
      programs: { select: { name: true } },
      subjects: { select: { name: true } },
      _count: { select: { questions: { where: { review_status: 'APPROVED' } } } }
    }
  });

  return tests.map(ts => ({
    id: ts.id,
    title: ts.title,
    description: ts.description,
    price: ts.price ? Number(ts.price) : 0,
    is_free: ts.is_free,
    duration_minutes: ts.duration_minutes,
    test_type: ts.test_type,
    question_count: ts._count.questions,
    slug: ts.slug,
    program_name: ts.programs?.name ?? null,
    subject_name: ts.subjects?.name ?? null,
  }));
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
  const where: Prisma.exam_papersWhereInput = {};
  if (programSlug) where.programs = { slug: programSlug };

  const papers = await prisma.exam_papers.findMany({
    where,
    orderBy: [
      { exam_year: 'desc' },
      { exam_name: 'asc' },
      { shift: 'asc' }
    ],
    include: {
      programs: { select: { name: true } },
      _count: { select: { questions: { where: { review_status: 'APPROVED' } } } }
    }
  });

  return papers.map(ep => ({
    id: ep.id,
    exam_name: ep.exam_name,
    exam_year: ep.exam_year,
    shift: ep.shift,
    program_name: ep.programs.name,
    total_questions: ep.total_questions,
    question_count: ep._count.questions,
  }));
}

export async function getExamPaperQuestions(paperId: string) {
  const questions = await prisma.questions.findMany({
    where: { exam_paper_id: paperId, review_status: 'APPROVED' },
    orderBy: [
      { paper_qno: 'asc' },
      { question_order: 'asc' }
    ],
    select: {
      id: true,
      question_text: true,
      option_a: true,
      option_b: true,
      option_c: true,
      option_d: true,
      paper_qno: true,
      question_order: true,
    }
  });
  return questions;
}
