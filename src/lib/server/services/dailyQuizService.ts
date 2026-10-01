import 'server-only';
import { query, queryOne } from '../db';

export interface DailyQuizInfo {
  quiz_date: string;
  test_series_id: string | null;
  subject_name: string | null;
  title: string;
  question_count: number;
}

/** Get today's daily quiz. Returns null if none is scheduled. */
export async function getTodaysQuiz(): Promise<DailyQuizInfo | null> {
  return queryOne<DailyQuizInfo>(
    `SELECT dq.quiz_date, dq.test_series_id, s.name AS subject_name,
            COALESCE(ts.title, 'Daily Quiz — ' || to_char(dq.quiz_date, 'DD Mon YYYY')) AS title,
            (SELECT COUNT(*) FROM questions q WHERE q.test_series_id = dq.test_series_id AND q.review_status = 'APPROVED')::int AS question_count
       FROM daily_quizzes dq
       LEFT JOIN test_series ts ON ts.id = dq.test_series_id
       LEFT JOIN subjects s ON s.id = dq.subject_id
      WHERE dq.quiz_date = CURRENT_DATE`,
  );
}

/** Get a user's daily quiz streak (consecutive days they've completed a daily quiz). */
export async function getDailyStreak(userId: string): Promise<number> {
  const row = await queryOne<{ streak: number }>(
    `WITH completed_dates AS (
       SELECT DISTINCT dq.quiz_date
         FROM daily_quizzes dq
         JOIN attempts a ON a.test_series_id = dq.test_series_id AND a.user_id = $1 AND a.status = 'COMPLETED'
        ORDER BY dq.quiz_date DESC
     ),
     streaks AS (
       SELECT quiz_date,
              quiz_date - (ROW_NUMBER() OVER (ORDER BY quiz_date DESC))::int AS grp
         FROM completed_dates
     )
     SELECT COUNT(*)::int AS streak
       FROM streaks
      WHERE grp = (SELECT grp FROM streaks WHERE quiz_date = CURRENT_DATE OR quiz_date = CURRENT_DATE - 1 LIMIT 1)`,
    [userId],
  );
  return row?.streak ?? 0;
}

/** List recent daily quizzes (for a calendar/history view). */
export async function listRecentQuizzes(limit = 30): Promise<DailyQuizInfo[]> {
  return query<DailyQuizInfo>(
    `SELECT dq.quiz_date, dq.test_series_id, s.name AS subject_name,
            COALESCE(ts.title, 'Daily Quiz — ' || to_char(dq.quiz_date, 'DD Mon YYYY')) AS title,
            (SELECT COUNT(*) FROM questions q WHERE q.test_series_id = dq.test_series_id AND q.review_status = 'APPROVED')::int AS question_count
       FROM daily_quizzes dq
       LEFT JOIN test_series ts ON ts.id = dq.test_series_id
       LEFT JOIN subjects s ON s.id = dq.subject_id
      ORDER BY dq.quiz_date DESC
      LIMIT $1`,
    [limit],
  );
}
