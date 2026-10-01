import 'server-only';
import { query, queryOne } from '../db';

export interface BookmarkedQuestion {
  question_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string | null;
  subject_name: string | null;
  topic_name: string | null;
  bookmarked_at: string;
}

/** Toggle a bookmark: returns true if added, false if removed. */
export async function toggleBookmark(userId: string, questionId: string): Promise<boolean> {
  const existing = await queryOne(
    `SELECT 1 FROM bookmarks WHERE user_id = $1 AND question_id = $2`,
    [userId, questionId],
  );
  if (existing) {
    await query(`DELETE FROM bookmarks WHERE user_id = $1 AND question_id = $2`, [userId, questionId]);
    return false;
  } else {
    await query(
      `INSERT INTO bookmarks (user_id, question_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, questionId],
    );
    return true;
  }
}

/** Check if a question is bookmarked by the user. */
export async function isBookmarked(userId: string, questionId: string): Promise<boolean> {
  const row = await queryOne(`SELECT 1 FROM bookmarks WHERE user_id = $1 AND question_id = $2`, [userId, questionId]);
  return row !== null;
}

/** Bulk check bookmarks. */
export async function getBookmarkedIds(userId: string, questionIds: string[]): Promise<Set<string>> {
  if (questionIds.length === 0) return new Set();
  const rows = await query<{ question_id: string }>(
    `SELECT question_id FROM bookmarks WHERE user_id = $1 AND question_id = ANY($2::uuid[])`,
    [userId, questionIds],
  );
  return new Set(rows.map((r) => r.question_id));
}

/** List all bookmarked questions for a user, grouped by subject. */
export async function listBookmarks(userId: string): Promise<BookmarkedQuestion[]> {
  return query<BookmarkedQuestion>(
    `SELECT q.id AS question_id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
            q.correct_answer, q.explanation,
            s.name AS subject_name, t.name AS topic_name, b.created_at AS bookmarked_at
       FROM bookmarks b
       JOIN questions q ON q.id = b.question_id
       LEFT JOIN subjects s ON s.id = q.subject_id
       LEFT JOIN topics t ON t.id = q.topic_id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC`,
    [userId],
  );
}

/** Count bookmarks for a user. */
export async function countBookmarks(userId: string): Promise<number> {
  const row = await queryOne<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM bookmarks WHERE user_id = $1`,
    [userId],
  );
  return row?.count ?? 0;
}
