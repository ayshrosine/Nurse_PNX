import 'server-only';
import type { PoolClient } from 'pg';
import { query, queryOne, transaction, type Queryable } from '../db';
import { ApiError, Errors } from '../../errors';
import type { Question, ReviewStatus, StudentQuestion, User } from '@/types';
import type { QuestionInput } from '../../validation';
import { logAudit } from './auditService';

const ADMIN_COLUMNS = `id, test_series_id, question_text, option_a, option_b, option_c, option_d, correct_answer,
  explanation, question_order, source, source_document_id, review_status, created_at, updated_at`;

/**
 * Student-facing column allow-list. correct_answer and explanation are deliberately absent:
 * they are never selected for a student before the attempt is submitted (PRD §2.5, §39).
 */
const STUDENT_COLUMNS = `id, question_text, option_a, option_b, option_c, option_d, question_order`;

export async function listForAttempt(questionIds: string[], db?: Queryable): Promise<StudentQuestion[]> {
  if (questionIds.length === 0) return [];
  return query<StudentQuestion>(
    `SELECT ${STUDENT_COLUMNS} FROM questions WHERE id = ANY($1::uuid[])
      ORDER BY array_position($1::uuid[], id)`,
    [questionIds],
    db,
  );
}

export async function approvedIdsForSeries(testSeriesId: string, db?: Queryable): Promise<string[]> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM questions WHERE test_series_id = $1 AND review_status = 'APPROVED' ORDER BY question_order, created_at`,
    [testSeriesId],
    db,
  );
  return rows.map((r) => r.id);
}

export async function listForAdmin(testSeriesId: string, review?: ReviewStatus): Promise<Question[]> {
  return query<Question>(
    `SELECT ${ADMIN_COLUMNS} FROM questions
      WHERE test_series_id = $1 AND ($2::question_review_status IS NULL OR review_status = $2)
      ORDER BY (review_status = 'APPROVED') DESC, question_order`,
    [testSeriesId, review ?? null],
  );
}

export async function getById(id: string) {
  return queryOne<Question>(`SELECT ${ADMIN_COLUMNS} FROM questions WHERE id = $1`, [id]);
}

async function nextOrder(testSeriesId: string, db: Queryable) {
  // Lock the parent row so concurrent inserts can't compute the same order number.
  await query(`SELECT 1 FROM test_series WHERE id = $1 FOR UPDATE`, [testSeriesId], db);
  const row = await queryOne<{ next: number }>(
    `SELECT COALESCE(MAX(question_order), 0) + 1 AS next FROM questions WHERE test_series_id = $1`,
    [testSeriesId],
    db,
  );
  return row!.next;
}

export async function create(testSeriesId: string, input: QuestionInput, admin: User) {
  return transaction(async (db) => {
    const series = await queryOne(`SELECT 1 FROM test_series WHERE id = $1`, [testSeriesId], db);
    if (!series) throw Errors.notFound('Test series');
    const order = await nextOrder(testSeriesId, db);
    const row = await queryOne<Question>(
      `INSERT INTO questions (test_series_id, question_text, option_a, option_b, option_c, option_d, correct_answer,
                              explanation, question_order, source, review_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'MANUAL','APPROVED') RETURNING ${ADMIN_COLUMNS}`,
      [testSeriesId, input.question_text, input.option_a, input.option_b, input.option_c, input.option_d,
        input.correct_answer, input.explanation, order],
      db,
    );
    await logAudit(admin.id, 'QUESTION_CREATED', 'question', row!.id, { test_series_id: testSeriesId }, db);
    return row!;
  });
}

export async function insertMany(
  db: PoolClient,
  testSeriesId: string,
  questions: QuestionInput[],
  opts: { source: 'IMPORTED' | 'AI_GENERATED'; reviewStatus: ReviewStatus; documentId?: string | null },
) {
  let order = await nextOrder(testSeriesId, db);
  const ids: string[] = [];
  for (const q of questions) {
    const row = await queryOne<{ id: string }>(
      `INSERT INTO questions (test_series_id, question_text, option_a, option_b, option_c, option_d, correct_answer,
                              explanation, question_order, source, review_status, source_document_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [testSeriesId, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer,
        q.explanation, order++, opts.source, opts.reviewStatus, opts.documentId ?? null],
      db,
    );
    ids.push(row!.id);
  }
  return ids;
}

/** Saves admin-confirmed questions from an HTML/JSON/CSV import (PRD §6.9: preview → edit → save). */
export async function importQuestions(testSeriesId: string, questions: QuestionInput[], admin: User, filename?: string) {
  return transaction(async (db) => {
    const series = await queryOne(`SELECT 1 FROM test_series WHERE id = $1`, [testSeriesId], db);
    if (!series) throw Errors.notFound('Test series');
    const ids = await insertMany(db, testSeriesId, questions, { source: 'IMPORTED', reviewStatus: 'APPROVED' });
    await logAudit(admin.id, 'QUESTION_IMPORTED', 'test_series', testSeriesId, { count: ids.length, filename }, db);
    return ids;
  });
}

export async function update(id: string, input: QuestionInput, admin: User) {
  const row = await queryOne<Question>(
    `UPDATE questions SET question_text = $2, option_a = $3, option_b = $4, option_c = $5, option_d = $6,
            correct_answer = $7, explanation = $8
      WHERE id = $1 RETURNING ${ADMIN_COLUMNS}`,
    [id, input.question_text, input.option_a, input.option_b, input.option_c, input.option_d,
      input.correct_answer, input.explanation],
  );
  if (!row) throw Errors.notFound('Question');
  await logAudit(admin.id, 'QUESTION_UPDATED', 'question', id, { test_series_id: row.test_series_id });
  return row;
}

export async function setReviewStatus(id: string, status: ReviewStatus, admin: User) {
  const row = await queryOne<Question>(
    `UPDATE questions SET review_status = $2 WHERE id = $1 RETURNING ${ADMIN_COLUMNS}`,
    [id, status],
  );
  if (!row) throw Errors.notFound('Question');
  if (status === 'REJECTED') await logAudit(admin.id, 'QUESTION_REJECTED', 'question', id, {});
  return row;
}

export async function remove(id: string, admin: User) {
  return transaction(async (db) => {
    const row = await queryOne<{ test_series_id: string; answered: boolean }>(
      `SELECT test_series_id, EXISTS (SELECT 1 FROM user_answers WHERE question_id = $1) AS answered
         FROM questions WHERE id = $1 FOR UPDATE`,
      [id],
      db,
    );
    if (!row) throw Errors.notFound('Question');
    if (row.answered) {
      // Historical attempts reference this question; deleting it would rewrite past results (PRD §22).
      throw new ApiError(409, 'CONFLICT', 'Students have already answered this question. Edit it instead, or archive the test series.');
    }
    await query(`DELETE FROM questions WHERE id = $1`, [id], db);
    await logAudit(admin.id, 'QUESTION_DELETED', 'question', id, { test_series_id: row.test_series_id }, db);
  });
}

/**
 * Reorders the APPROVED questions to match `orderedIds` (must be exactly that set). Drafts and rejected
 * questions are moved after them, keeping their relative order.
 */
export async function reorder(testSeriesId: string, orderedIds: string[], admin: User) {
  return transaction(async (db) => {
    const approved = await approvedIdsForSeries(testSeriesId, db);
    const given = new Set(orderedIds);
    if (given.size !== orderedIds.length || approved.length !== given.size || approved.some((id) => !given.has(id))) {
      throw Errors.validation('questionIds must list every approved question of this test series exactly once');
    }
    const others = await query<{ id: string }>(
      `SELECT id FROM questions WHERE test_series_id = $1 AND review_status <> 'APPROVED' ORDER BY question_order`,
      [testSeriesId],
      db,
    );
    const all = [...orderedIds, ...others.map((o) => o.id)];
    await db.query('SET CONSTRAINTS uq_question_order DEFERRED');
    await query(
      `UPDATE questions q SET question_order = v.ord
         FROM unnest($1::uuid[]) WITH ORDINALITY AS v(id, ord)
        WHERE q.id = v.id AND q.test_series_id = $2`,
      [all, testSeriesId],
      db,
    );
    await logAudit(admin.id, 'QUESTIONS_REORDERED', 'test_series', testSeriesId, { count: orderedIds.length }, db);
  });
}
