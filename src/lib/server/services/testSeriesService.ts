import 'server-only';
import { query, queryOne, transaction } from '../db';
import { ApiError, Errors } from '../../errors';
import type { AccessState, Paginated, PublicTestSeries, TestSeries, TestStatus, User } from '@/types';
import type { TestSeriesInput } from '../../validation';
import { logAudit } from './auditService';

// question_count is derived from APPROVED questions at query time, never stored (Database doc §3).
const QUESTION_COUNT = `(SELECT COUNT(*) FROM questions q WHERE q.test_series_id = ts.id AND q.review_status = 'APPROVED')::int`;

const PUBLIC_COLUMNS = `ts.id, ts.title, ts.description, ts.price, ts.currency, ts.is_free, ts.duration_minutes,
  ts.instructions, ts.published_at, ${QUESTION_COUNT} AS question_count`;

const ADMIN_COLUMNS = `ts.id, ts.title, ts.description, ts.price, ts.currency, ts.is_free, ts.duration_minutes,
  ts.status, ts.instructions, ts.created_at, ts.updated_at, ts.published_at, ${QUESTION_COUNT} AS question_count`;

/** The only rule that grants access to a paid series: a SUCCESS purchase in the database. */
export async function hasPurchased(userId: string, testSeriesId: string): Promise<boolean> {
  const row = await queryOne(
    `SELECT 1 FROM purchases WHERE user_id = $1 AND test_series_id = $2 AND status = 'SUCCESS' LIMIT 1`,
    [userId, testSeriesId],
  );
  return row !== null;
}

export function accessState(isFree: boolean, viewer: User | null, purchased: boolean): AccessState {
  if (isFree) return 'FREE';
  if (!viewer) return 'LOGIN_REQUIRED';
  if (viewer.role === 'ADMIN' || purchased) return 'PURCHASED';
  return 'PURCHASE_REQUIRED';
}

type PublicRow = Omit<PublicTestSeries, 'access' | 'has_access'> & { purchased: boolean };

function toPublic(row: PublicRow, viewer: User | null): PublicTestSeries {
  const { purchased, ...rest } = row;
  const access = accessState(row.is_free, viewer, purchased);
  return { ...rest, access, has_access: Boolean(viewer) && (row.is_free || access === 'PURCHASED') };
}

export async function listPublished(viewer: User | null): Promise<PublicTestSeries[]> {
  const rows = await query<PublicRow>(
    `SELECT ${PUBLIC_COLUMNS},
            EXISTS (SELECT 1 FROM purchases p WHERE p.test_series_id = ts.id AND p.user_id = $1 AND p.status = 'SUCCESS') AS purchased
       FROM test_series ts
      WHERE ts.status = 'PUBLISHED'
      ORDER BY ts.is_free DESC, ts.published_at DESC NULLS LAST, ts.title`,
    [viewer?.id ?? null],
  );
  return rows.map((r) => toPublic(r, viewer));
}

export async function getPublished(id: string, viewer: User | null): Promise<PublicTestSeries | null> {
  const row = await queryOne<PublicRow>(
    `SELECT ${PUBLIC_COLUMNS},
            EXISTS (SELECT 1 FROM purchases p WHERE p.test_series_id = ts.id AND p.user_id = $2 AND p.status = 'SUCCESS') AS purchased
       FROM test_series ts
      WHERE ts.id = $1 AND ts.status = 'PUBLISHED'`,
    [id, viewer?.id ?? null],
  );
  return row ? toPublic(row, viewer) : null;
}

// ------------------------------------------------------------------ admin

export async function adminList(opts: {
  page: number;
  pageSize: number;
  q?: string;
  status?: TestStatus;
}): Promise<Paginated<TestSeries & { attempt_count: number; purchase_count: number }>> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.q) {
    params.push(`%${opts.q}%`);
    where.push(`ts.title ILIKE $${params.length}`);
  }
  if (opts.status) {
    params.push(opts.status);
    where.push(`ts.status = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [{ total }] = await query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM test_series ts ${whereSql}`, params);
  params.push(opts.pageSize, (opts.page - 1) * opts.pageSize);
  const items = await query<TestSeries & { attempt_count: number; purchase_count: number }>(
    `SELECT ${ADMIN_COLUMNS},
            (SELECT COUNT(*) FROM attempts a WHERE a.test_series_id = ts.id)::int AS attempt_count,
            (SELECT COUNT(*) FROM purchases p WHERE p.test_series_id = ts.id AND p.status = 'SUCCESS')::int AS purchase_count
       FROM test_series ts ${whereSql}
      ORDER BY ts.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { items, page: opts.page, pageSize: opts.pageSize, total, totalPages: Math.max(1, Math.ceil(total / opts.pageSize)) };
}

export async function adminGet(id: string) {
  const row = await queryOne<TestSeries & { pending_count: number; attempt_count: number; purchase_count: number; revenue: number }>(
    `SELECT ${ADMIN_COLUMNS},
            (SELECT COUNT(*) FROM questions q WHERE q.test_series_id = ts.id AND q.review_status = 'PENDING_REVIEW')::int AS pending_count,
            (SELECT COUNT(*) FROM attempts a WHERE a.test_series_id = ts.id)::int AS attempt_count,
            (SELECT COUNT(*) FROM purchases p WHERE p.test_series_id = ts.id AND p.status = 'SUCCESS')::int AS purchase_count,
            (SELECT COALESCE(SUM(p.amount), 0) FROM purchases p WHERE p.test_series_id = ts.id AND p.status = 'SUCCESS') AS revenue
       FROM test_series ts WHERE ts.id = $1`,
    [id],
  );
  if (!row) throw Errors.notFound('Test series');
  return row;
}

async function assertPublishable(id: string, db?: Parameters<typeof query>[2]) {
  const [{ count }] = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM questions WHERE test_series_id = $1 AND review_status = 'APPROVED'`,
    [id],
    db,
  );
  if (count === 0) throw new ApiError(409, 'CONFLICT', 'Add at least one approved question before publishing');
}

export async function create(input: TestSeriesInput, admin: User) {
  return transaction(async (db) => {
    if (input.status === 'PUBLISHED') {
      throw new ApiError(409, 'CONFLICT', 'Create the test as a draft, add questions, then publish it');
    }
    const row = await queryOne<{ id: string }>(
      `INSERT INTO test_series (title, description, price, currency, is_free, duration_minutes, status, instructions, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [input.title, input.description, input.price, input.currency, input.is_free, input.duration_minutes,
        input.status, input.instructions, admin.id],
      db,
    );
    await logAudit(admin.id, 'TEST_CREATED', 'test_series', row!.id, { title: input.title }, db);
    return row!.id;
  });
}

export async function update(id: string, input: TestSeriesInput, admin: User) {
  return transaction(async (db) => {
    const existing = await queryOne<{ status: TestStatus }>(`SELECT status FROM test_series WHERE id = $1 FOR UPDATE`, [id], db);
    if (!existing) throw Errors.notFound('Test series');
    if (input.status === 'PUBLISHED' && existing.status !== 'PUBLISHED') await assertPublishable(id, db);
    // Price edits only affect future orders: purchases.amount is frozen at purchase time (PRD §6.7).
    await query(
      `UPDATE test_series
          SET title = $2, description = $3, price = $4, currency = $5, is_free = $6, duration_minutes = $7,
              status = $8, instructions = $9,
              published_at = CASE WHEN $8::test_status = 'PUBLISHED' AND published_at IS NULL THEN now() ELSE published_at END
        WHERE id = $1`,
      [id, input.title, input.description, input.price, input.currency, input.is_free, input.duration_minutes,
        input.status, input.instructions],
      db,
    );
    await logAudit(admin.id, 'TEST_UPDATED', 'test_series', id, { fields: Object.keys(input) }, db);
    if (input.status !== existing.status) {
      const action = input.status === 'PUBLISHED' ? 'TEST_PUBLISHED' : input.status === 'ARCHIVED' ? 'TEST_ARCHIVED' : 'TEST_UNPUBLISHED';
      await logAudit(admin.id, action, 'test_series', id, { from: existing.status }, db);
    }
  });
}

export async function setStatus(id: string, status: TestStatus, admin: User) {
  return transaction(async (db) => {
    const existing = await queryOne<{ status: TestStatus }>(`SELECT status FROM test_series WHERE id = $1 FOR UPDATE`, [id], db);
    if (!existing) throw Errors.notFound('Test series');
    if (status === 'PUBLISHED') await assertPublishable(id, db);
    // Status changes never touch purchases, attempts or answers (PRD §23).
    await query(
      `UPDATE test_series SET status = $2,
              published_at = CASE WHEN $2::test_status = 'PUBLISHED' THEN COALESCE(published_at, now()) ELSE published_at END
        WHERE id = $1`,
      [id, status],
      db,
    );
    const action = status === 'PUBLISHED' ? 'TEST_PUBLISHED' : status === 'ARCHIVED' ? 'TEST_ARCHIVED' : 'TEST_UNPUBLISHED';
    await logAudit(admin.id, action, 'test_series', id, { from: existing.status }, db);
  });
}

/** Hard delete is only allowed for series with no purchase/attempt history; otherwise archive it. */
export async function remove(id: string, admin: User) {
  return transaction(async (db) => {
    const row = await queryOne<{ title: string; history: number }>(
      `SELECT title,
              ((SELECT COUNT(*) FROM attempts WHERE test_series_id = $1) + (SELECT COUNT(*) FROM purchases WHERE test_series_id = $1))::int AS history
         FROM test_series WHERE id = $1 FOR UPDATE`,
      [id],
      db,
    );
    if (!row) throw Errors.notFound('Test series');
    if (row.history > 0) {
      throw Errors.conflict('This test series has purchases or attempts. Archive it instead to keep that history.');
    }
    await query(`DELETE FROM test_series WHERE id = $1`, [id], db);
    await logAudit(admin.id, 'TEST_DELETED', 'test_series', id, { title: row.title }, db);
  });
}
