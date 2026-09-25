import 'server-only';
import { query, queryOne, transaction } from '../db';
import { ApiError, Errors } from '../../errors';
import type { AnswerOption, Attempt, AttemptResult, Progress, ReviewItem, StudentQuestion, User } from '@/types';
import { hasPurchased } from './testSeriesService';
import { listForAttempt, approvedIdsForSeries } from './questionService';
import { scoreAttempt } from '../scoring';

/** Extra seconds allowed after the timer ends for the auto-submit request to arrive. */
export const SUBMIT_GRACE_SECONDS = 120;

type AttemptRow = Attempt & { question_ids: string[] };

const ATTEMPT_COLUMNS = `a.id, a.user_id, a.test_series_id, a.started_at, a.submitted_at, a.score, a.total_questions,
  a.correct_answers, a.incorrect_answers, a.unanswered, a.percentage, a.time_taken_seconds, a.status`;

export interface StartedAttempt {
  attempt: {
    id: string;
    started_at: string;
    expires_at: string;
    server_now: string;
    duration_minutes: number;
    resumed: boolean;
  };
  test: { id: string; title: string; instructions: string | null };
  questions: StudentQuestion[];
  saved_answers: { questionId: string; selectedAnswer: AnswerOption | null }[];
}

/**
 * POST /api/tests/:id/start (PRD §14). Validates: authenticated (caller), test exists + PUBLISHED,
 * access (free, admin, or SUCCESS purchase). Resumes an unexpired in-progress attempt instead of creating
 * a duplicate. Returned questions never include correct answers.
 */
export async function start(user: User, testSeriesId: string): Promise<StartedAttempt> {
  return transaction(async (db) => {
    const series = await queryOne<{ id: string; title: string; instructions: string | null; is_free: boolean; duration_minutes: number }>(
      `SELECT id, title, instructions, is_free, duration_minutes FROM test_series WHERE id = $1 AND status = 'PUBLISHED'`,
      [testSeriesId],
      db,
    );
    if (!series) throw Errors.notFound('Test');
    if (!series.is_free && user.role !== 'ADMIN' && !(await hasPurchased(user.id, testSeriesId))) {
      throw new ApiError(403, 'PURCHASE_REQUIRED', 'Purchase this test series to start it');
    }

    // Serialise concurrent "start" clicks for the same user+series.
    await db.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`${user.id}:${testSeriesId}`]);

    const open = await queryOne<AttemptRow & { expired: boolean }>(
      `SELECT ${ATTEMPT_COLUMNS}, a.question_ids,
              now() > a.started_at + make_interval(mins => $3) AS expired
         FROM attempts a
        WHERE a.user_id = $1 AND a.test_series_id = $2 AND a.status = 'IN_PROGRESS'
        ORDER BY a.started_at DESC LIMIT 1`,
      [user.id, testSeriesId, series.duration_minutes],
      db,
    );

    let attempt: AttemptRow;
    let resumed = false;
    if (open && !open.expired) {
      attempt = open;
      resumed = true;
    } else {
      if (open?.expired) {
        // Time ran out without a submit (tab closed etc.): grade whatever was autosaved so the attempt isn't lost.
        await finalize(db, open, new Map(), true);
      }
      const questionIds = await approvedIdsForSeries(testSeriesId, db);
      if (questionIds.length === 0) throw Errors.conflict('This test has no questions yet');
      attempt = (await queryOne<AttemptRow>(
        `INSERT INTO attempts AS a (user_id, test_series_id, total_questions, question_ids)
         VALUES ($1,$2,$3,$4) RETURNING ${ATTEMPT_COLUMNS}, a.question_ids`,
        [user.id, testSeriesId, questionIds.length, questionIds],
        db,
      ))!;
    }

    const questions = await listForAttempt(attempt.question_ids, db);
    const saved = await query<{ question_id: string; selected_answer: AnswerOption | null }>(
      `SELECT question_id, selected_answer FROM user_answers WHERE attempt_id = $1`,
      [attempt.id],
      db,
    );
    const times = await queryOne<{ expires_at: string; server_now: string }>(
      `SELECT ($1::timestamptz + make_interval(mins => $2)) AS expires_at, now() AS server_now`,
      [attempt.started_at, series.duration_minutes],
      db,
    );
    return {
      attempt: {
        id: attempt.id,
        started_at: attempt.started_at,
        expires_at: times!.expires_at,
        server_now: times!.server_now,
        duration_minutes: series.duration_minutes,
        resumed,
      },
      test: { id: series.id, title: series.title, instructions: series.instructions },
      questions,
      saved_answers: saved.map((s) => ({ questionId: s.question_id, selectedAnswer: s.selected_answer })),
    };
  });
}

async function loadOwnedOpenAttempt(
  db: Parameters<typeof query>[2],
  user: User,
  testSeriesId: string,
  attemptId: string,
) {
  const attempt = await queryOne<AttemptRow & { duration_minutes: number; seconds_elapsed: number }>(
    `SELECT ${ATTEMPT_COLUMNS}, a.question_ids, ts.duration_minutes,
            EXTRACT(EPOCH FROM (now() - a.started_at))::int AS seconds_elapsed
       FROM attempts a JOIN test_series ts ON ts.id = a.test_series_id
      WHERE a.id = $1 FOR UPDATE OF a`,
    [attemptId],
    db,
  );
  // Ownership check (PRD §18 layer 4). Another user's attempt looks identical to a missing one.
  if (!attempt || attempt.user_id !== user.id || attempt.test_series_id !== testSeriesId) throw Errors.notFound('Attempt');
  if (attempt.status !== 'IN_PROGRESS') throw Errors.conflict('This attempt has already been submitted');
  return attempt;
}

/** Autosave: stores selections only. is_correct stays NULL until the server scores the submitted attempt. */
export async function saveAnswers(
  user: User,
  testSeriesId: string,
  attemptId: string,
  answers: { questionId: string; selectedAnswer: AnswerOption | null }[],
) {
  return transaction(async (db) => {
    const attempt = await loadOwnedOpenAttempt(db, user, testSeriesId, attemptId);
    if (attempt.seconds_elapsed > attempt.duration_minutes * 60 + SUBMIT_GRACE_SECONDS) {
      throw Errors.conflict('Time is up for this attempt');
    }
    const allowed = new Set(attempt.question_ids);
    const valid = answers.filter((a) => allowed.has(a.questionId));
    if (valid.length) {
      await query(
        `INSERT INTO user_answers (attempt_id, question_id, selected_answer)
         SELECT $1, v.qid, v.ans::answer_option FROM unnest($2::uuid[], $3::text[]) AS v(qid, ans)
         ON CONFLICT (attempt_id, question_id) DO UPDATE SET selected_answer = EXCLUDED.selected_answer`,
        [attemptId, valid.map((a) => a.questionId), valid.map((a) => a.selectedAnswer)],
        db,
      );
    }
    return { saved: valid.length };
  });
}

async function finalize(
  db: Parameters<typeof query>[2],
  attempt: AttemptRow & { duration_minutes?: number },
  submitted: Map<string, AnswerOption | null>,
  late: boolean,
) {
  // Correct answers are read from the database here and only here (PRD §15).
  const key = await query<{ id: string; correct_answer: AnswerOption }>(
    `SELECT id, correct_answer FROM questions WHERE id = ANY($1::uuid[])`,
    [attempt.question_ids],
    db,
  );
  const saved = await query<{ question_id: string; selected_answer: AnswerOption | null }>(
    `SELECT question_id, selected_answer FROM user_answers WHERE attempt_id = $1`,
    [attempt.id],
    db,
  );
  const selections = new Map<string, AnswerOption | null>(saved.map((s) => [s.question_id, s.selected_answer]));
  // A late submission cannot change answers after time expired; only autosaved answers count.
  if (!late) for (const [qid, ans] of submitted) selections.set(qid, ans);

  const result = scoreAttempt(attempt.question_ids, new Map(key.map((k) => [k.id, k.correct_answer])), selections);
  await query(
    `INSERT INTO user_answers (attempt_id, question_id, selected_answer, is_correct)
     SELECT $1, v.qid, v.ans::answer_option, v.ok FROM unnest($2::uuid[], $3::text[], $4::boolean[]) AS v(qid, ans, ok)
     ON CONFLICT (attempt_id, question_id)
       DO UPDATE SET selected_answer = EXCLUDED.selected_answer, is_correct = EXCLUDED.is_correct`,
    [attempt.id, result.answers.map((a) => a.questionId), result.answers.map((a) => a.selectedAnswer),
      result.answers.map((a) => a.isCorrect)],
    db,
  );
  await query(
    `UPDATE attempts a
        SET status = 'COMPLETED', submitted_at = now(), score = $2, correct_answers = $3, incorrect_answers = $4,
            unanswered = $5, percentage = $6,
            time_taken_seconds = LEAST(EXTRACT(EPOCH FROM (now() - a.started_at))::int,
                                       (SELECT duration_minutes * 60 FROM test_series WHERE id = a.test_series_id))
      WHERE a.id = $1`,
    [attempt.id, result.score, result.correct, result.incorrect, result.unanswered, result.percentage],
    db,
  );
  return result;
}

/** POST /api/tests/:id/submit — the request can only carry selections; scores come from finalize(). */
export async function submit(
  user: User,
  testSeriesId: string,
  attemptId: string,
  answers: { questionId: string; selectedAnswer: AnswerOption | null }[],
) {
  return transaction(async (db) => {
    const attempt = await loadOwnedOpenAttempt(db, user, testSeriesId, attemptId);
    const allowed = new Set(attempt.question_ids);
    const submitted = new Map(answers.filter((a) => allowed.has(a.questionId)).map((a) => [a.questionId, a.selectedAnswer]));
    const late = attempt.seconds_elapsed > attempt.duration_minutes * 60 + SUBMIT_GRACE_SECONDS;
    const result = await finalize(db, attempt, submitted, late);
    return {
      attemptId,
      late,
      score: result.score,
      total: result.total,
      correct: result.correct,
      incorrect: result.incorrect,
      unanswered: result.unanswered,
      percentage: result.percentage,
    };
  });
}

/** GET /api/results/:id — owner or admin only; review (incl. correct answers) only after completion. */
export async function getResult(user: User, attemptId: string): Promise<AttemptResult> {
  const attempt = await queryOne<AttemptRow & { test_title: string; duration_minutes: number; user_name: string; user_email: string }>(
    `SELECT ${ATTEMPT_COLUMNS}, a.question_ids, ts.title AS test_title, ts.duration_minutes,
            u.name AS user_name, u.email AS user_email
       FROM attempts a JOIN test_series ts ON ts.id = a.test_series_id JOIN users u ON u.id = a.user_id
      WHERE a.id = $1`,
    [attemptId],
  );
  if (!attempt) throw Errors.notFound('Result');
  if (attempt.user_id !== user.id && user.role !== 'ADMIN') throw Errors.forbidden('This result belongs to another student');
  if (attempt.status !== 'COMPLETED') throw Errors.conflict('This attempt has not been submitted yet');

  const review = await query<ReviewItem>(
    `SELECT q.id AS question_id, ord.n::int AS question_order, q.question_text, q.option_a, q.option_b, q.option_c,
            q.option_d, q.correct_answer, q.explanation, ua.selected_answer, ua.is_correct
       FROM unnest($2::uuid[]) WITH ORDINALITY AS ord(id, n)
       JOIN questions q ON q.id = ord.id
       LEFT JOIN user_answers ua ON ua.attempt_id = $1 AND ua.question_id = q.id
      ORDER BY ord.n`,
    [attemptId, attempt.question_ids],
  );
  const { question_ids: _omit, ...rest } = attempt;
  void _omit;
  return { ...rest, review };
}

export async function listForUser(userId: string, limit = 50): Promise<Attempt[]> {
  return query<Attempt>(
    `SELECT ${ATTEMPT_COLUMNS}, ts.title AS test_title
       FROM attempts a JOIN test_series ts ON ts.id = a.test_series_id
      WHERE a.user_id = $1
      ORDER BY a.started_at DESC LIMIT $2`,
    [userId, limit],
  );
}

export async function progressForUser(userId: string): Promise<Progress> {
  const stats = await queryOne<Omit<Progress, 'trend'>>(
    `SELECT COUNT(*)::int AS tests_attempted,
            COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS tests_completed,
            COUNT(DISTINCT test_series_id) FILTER (WHERE status = 'COMPLETED')::int AS distinct_tests,
            ROUND(AVG(percentage) FILTER (WHERE status = 'COMPLETED'), 2)::float AS average_percentage,
            MAX(percentage) FILTER (WHERE status = 'COMPLETED')::float AS best_percentage,
            COALESCE(SUM(correct_answers + incorrect_answers) FILTER (WHERE status = 'COMPLETED'), 0)::int AS total_questions_answered,
            CASE WHEN SUM(correct_answers + incorrect_answers) FILTER (WHERE status = 'COMPLETED') > 0
                 THEN ROUND(100.0 * SUM(correct_answers) FILTER (WHERE status = 'COMPLETED')
                            / SUM(correct_answers + incorrect_answers) FILTER (WHERE status = 'COMPLETED'), 2)::float
            END AS accuracy
       FROM attempts WHERE user_id = $1`,
    [userId],
  );
  const trend = await query<Progress['trend'][number]>(
    `SELECT * FROM (
       SELECT a.id AS attempt_id, ts.title AS test_title, a.percentage::float AS percentage, a.submitted_at
         FROM attempts a JOIN test_series ts ON ts.id = a.test_series_id
        WHERE a.user_id = $1 AND a.status = 'COMPLETED'
        ORDER BY a.submitted_at DESC LIMIT 10) t
      ORDER BY submitted_at ASC`,
    [userId],
  );
  return { ...stats!, trend };
}
