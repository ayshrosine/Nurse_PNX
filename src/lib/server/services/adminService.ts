import 'server-only';
import { query, queryOne } from '../db';
import { Errors } from '../../errors';
import type { Attempt, Paginated, Purchase, User, UserStatus } from '@/types';
import { logAudit } from './auditService';
import { listForUser as attemptsForUser, progressForUser } from './attemptService';
import { listForUser as purchasesForUser } from './purchaseService';

function paginate<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function dashboard() {
  const stats = await queryOne<Record<string, number>>(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE role = 'STUDENT')::int AS total_students,
       (SELECT COUNT(*) FROM users WHERE role = 'STUDENT' AND created_at > now() - interval '7 days')::int AS new_students_7d,
       (SELECT COUNT(*) FROM test_series)::int AS total_test_series,
       (SELECT COUNT(*) FROM test_series WHERE status = 'PUBLISHED')::int AS published_tests,
       (SELECT COUNT(*) FROM test_series WHERE NOT is_free)::int AS paid_tests,
       (SELECT COUNT(*) FROM purchases)::int AS total_purchases,
       (SELECT COUNT(*) FROM purchases WHERE status = 'SUCCESS')::int AS successful_purchases,
       -- Revenue = SUM(successful purchases) only; pending/failed/cancelled/refunded never count (PRD §6.2).
       (SELECT COALESCE(SUM(amount), 0) FROM purchases WHERE status = 'SUCCESS')::float AS revenue,
       (SELECT COUNT(*) FROM attempts)::int AS total_attempts,
       (SELECT COUNT(*) FROM attempts WHERE status = 'COMPLETED')::int AS completed_attempts,
       (SELECT ROUND(AVG(percentage), 2) FROM attempts WHERE status = 'COMPLETED')::float AS average_percentage,
       (SELECT COUNT(*) FROM questions WHERE review_status = 'PENDING_REVIEW')::int AS pending_review`,
  );
  const [recentUsers, recentPurchases, recentAttempts] = await Promise.all([
    query<Pick<User, 'id' | 'name' | 'email' | 'created_at'>>(
      `SELECT id, name, email, created_at FROM users WHERE role = 'STUDENT' ORDER BY created_at DESC LIMIT 5`,
    ),
    query<Purchase>(
      `SELECT p.id, p.amount, p.currency, p.status, p.created_at, u.name AS user_name, ts.title AS test_title
         FROM purchases p JOIN users u ON u.id = p.user_id JOIN test_series ts ON ts.id = p.test_series_id
        ORDER BY p.created_at DESC LIMIT 5`,
    ),
    query<Attempt>(
      `SELECT a.id, a.status, a.percentage, a.score, a.total_questions, a.started_at, a.submitted_at,
              u.name AS user_name, ts.title AS test_title
         FROM attempts a JOIN users u ON u.id = a.user_id JOIN test_series ts ON ts.id = a.test_series_id
        ORDER BY a.started_at DESC LIMIT 5`,
    ),
  ]);
  return { stats: stats!, recentUsers, recentPurchases, recentAttempts };
}

export type AdminUserRow = User & { attempt_count: number; purchase_count: number; last_activity_at: string | null };

export async function listUsers(opts: {
  page: number;
  pageSize: number;
  q?: string;
  role?: 'STUDENT' | 'ADMIN';
  status?: UserStatus;
  profile?: 'complete' | 'incomplete';
}): Promise<Paginated<AdminUserRow>> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.q) {
    params.push(`%${opts.q}%`);
    where.push(`(u.name ILIKE $${params.length} OR u.email::text ILIKE $${params.length} OR u.phone ILIKE $${params.length})`);
  }
  if (opts.role) {
    params.push(opts.role);
    where.push(`u.role = $${params.length}`);
  }
  if (opts.status) {
    params.push(opts.status);
    where.push(`u.status = $${params.length}`);
  }
  if (opts.profile === 'complete') where.push('u.phone IS NOT NULL');
  if (opts.profile === 'incomplete') where.push('u.phone IS NULL');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [{ total }] = await query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM users u ${whereSql}`, params);
  params.push(opts.pageSize, (opts.page - 1) * opts.pageSize);
  // Aggregates are joined once per page (no N+1 lookups).
  const items = await query<AdminUserRow>(
    `SELECT u.id, u.google_id, u.name, u.email, u.phone, u.role, u.status, u.created_at, u.updated_at, u.last_login_at,
            COALESCE(a.cnt, 0)::int AS attempt_count, COALESCE(p.cnt, 0)::int AS purchase_count,
            GREATEST(u.last_login_at, a.last_at) AS last_activity_at
       FROM users u
       LEFT JOIN (SELECT user_id, COUNT(*) AS cnt, MAX(started_at) AS last_at FROM attempts GROUP BY user_id) a ON a.user_id = u.id
       LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM purchases WHERE status = 'SUCCESS' GROUP BY user_id) p ON p.user_id = u.id
       ${whereSql}
      ORDER BY u.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return paginate(items, total, opts.page, opts.pageSize);
}

export async function userDetail(id: string) {
  const user = await queryOne<User>(
    `SELECT id, google_id, name, email, phone, role, status, created_at, updated_at, last_login_at FROM users WHERE id = $1`,
    [id],
  );
  if (!user) throw Errors.notFound('User');
  const [purchases, attempts, progress] = await Promise.all([
    purchasesForUser(id),
    attemptsForUser(id, 100),
    progressForUser(id),
  ]);
  return { user, purchases, attempts, progress };
}

export async function setUserStatus(admin: User, id: string, status: UserStatus) {
  if (admin.id === id) throw Errors.conflict('You cannot change your own account status');
  const row = await queryOne<User>(`UPDATE users SET status = $2 WHERE id = $1 RETURNING id, status, role`, [id, status]);
  if (!row) throw Errors.notFound('User');
  await logAudit(admin.id, 'USER_STATUS_CHANGED', 'user', id, { status });
  return row;
}

export async function listPurchases(opts: {
  page: number;
  pageSize: number;
  q?: string;
  status?: string;
  testSeriesId?: string;
}): Promise<Paginated<Purchase> & { summary: { revenue: number; count: number } }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.q) {
    params.push(`%${opts.q}%`);
    const n = params.length;
    where.push(`(u.name ILIKE $${n} OR u.email::text ILIKE $${n} OR p.order_id ILIKE $${n} OR p.payment_id ILIKE $${n})`);
  }
  if (opts.status) {
    params.push(opts.status);
    where.push(`p.status = $${params.length}::purchase_status`);
  }
  if (opts.testSeriesId) {
    params.push(opts.testSeriesId);
    where.push(`p.test_series_id = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const from = `FROM purchases p JOIN users u ON u.id = p.user_id JOIN test_series ts ON ts.id = p.test_series_id ${whereSql}`;
  const summary = await queryOne<{ total: number; revenue: number }>(
    `SELECT COUNT(*)::int AS total, COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'SUCCESS'), 0)::float AS revenue ${from}`,
    params,
  );
  params.push(opts.pageSize, (opts.page - 1) * opts.pageSize);
  const items = await query<Purchase>(
    `SELECT p.id, p.user_id, p.test_series_id, p.amount, p.currency, p.provider, p.order_id, p.payment_id, p.status,
            p.created_at, p.updated_at, u.name AS user_name, u.email AS user_email, ts.title AS test_title
       ${from}
      ORDER BY p.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return {
    ...paginate(items, summary!.total, opts.page, opts.pageSize),
    summary: { revenue: summary!.revenue, count: summary!.total },
  };
}

export async function purchaseDetail(id: string) {
  const purchase = await queryOne<Purchase & { failure_reason: string | null; user_phone: string | null }>(
    `SELECT p.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone, ts.title AS test_title
       FROM purchases p JOIN users u ON u.id = p.user_id JOIN test_series ts ON ts.id = p.test_series_id
      WHERE p.id = $1`,
    [id],
  );
  if (!purchase) throw Errors.notFound('Purchase');
  const events = await query<{ id: string; event_type: string; created_at: string }>(
    `SELECT id, event_type, created_at FROM payment_events WHERE order_id = $1 ORDER BY created_at`,
    [purchase.order_id],
  );
  return { purchase, events };
}

export async function listAttempts(opts: {
  page: number;
  pageSize: number;
  q?: string;
  status?: string;
  testSeriesId?: string;
  userId?: string;
}): Promise<Paginated<Attempt>> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.q) {
    params.push(`%${opts.q}%`);
    const n = params.length;
    where.push(`(u.name ILIKE $${n} OR u.email::text ILIKE $${n} OR ts.title ILIKE $${n})`);
  }
  if (opts.status) {
    params.push(opts.status);
    where.push(`a.status = $${params.length}::attempt_status`);
  }
  if (opts.testSeriesId) {
    params.push(opts.testSeriesId);
    where.push(`a.test_series_id = $${params.length}`);
  }
  if (opts.userId) {
    params.push(opts.userId);
    where.push(`a.user_id = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const from = `FROM attempts a JOIN users u ON u.id = a.user_id JOIN test_series ts ON ts.id = a.test_series_id ${whereSql}`;
  const [{ total }] = await query<{ total: number }>(`SELECT COUNT(*)::int AS total ${from}`, params);
  params.push(opts.pageSize, (opts.page - 1) * opts.pageSize);
  const items = await query<Attempt>(
    `SELECT a.id, a.user_id, a.test_series_id, a.started_at, a.submitted_at, a.score, a.total_questions,
            a.correct_answers, a.incorrect_answers, a.unanswered, a.percentage, a.time_taken_seconds, a.status,
            u.name AS user_name, u.email AS user_email, ts.title AS test_title
       ${from}
      ORDER BY a.started_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return paginate(items, total, opts.page, opts.pageSize);
}
