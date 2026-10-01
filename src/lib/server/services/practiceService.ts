import 'server-only';
import { query, queryOne, transaction } from '../db';
import type { AnswerOption, User } from '@/types';

/**
 * Practice mode: untimed, instant-feedback, topic-level question practice.
 * Unlike the test runner, practice mode reveals the correct answer immediately after each question.
 */

export interface PracticeQuestion {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: AnswerOption;
  explanation: string | null;
  topic_name: string;
  subject_name: string;
}

/** Get a batch of practice questions for a topic, optionally excluding already-answered ones. */
export async function getPracticeQuestions(
  topicId: string,
  userId: string | null,
  limit = 10,
  offset = 0,
): Promise<PracticeQuestion[]> {
  return query<PracticeQuestion>(
    `SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
            q.correct_answer, q.explanation,
            t.name AS topic_name, s.name AS subject_name
       FROM questions q
       JOIN topics t ON t.id = q.topic_id
       JOIN subjects s ON s.id = q.subject_id
      WHERE q.topic_id = $1 AND q.review_status = 'APPROVED'
      ORDER BY q.question_order, q.created_at
      LIMIT $2 OFFSET $3`,
    [topicId, limit, offset],
  );
}

/** Get total count of approved questions for a topic. */
export async function getPracticeCount(topicId: string): Promise<number> {
  const row = await queryOne<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM questions WHERE topic_id = $1 AND review_status = 'APPROVED'`,
    [topicId],
  );
  return row?.count ?? 0;
}

/** Record a practice answer and update user_topic_stats atomically. */
export async function recordPracticeAnswer(
  userId: string,
  topicId: string,
  questionId: string,
  selectedAnswer: AnswerOption,
) {
  return transaction(async (db) => {
    const q = await queryOne<{ correct_answer: AnswerOption }>(
      `SELECT correct_answer FROM questions WHERE id = $1`,
      [questionId],
      db,
    );
    if (!q) return null;

    const isCorrect = selectedAnswer === q.correct_answer;

    // Update topic stats
    await query(
      `INSERT INTO user_topic_stats (user_id, topic_id, attempted, correct, last_attempted_at)
       VALUES ($1, $2, 1, $3, now())
       ON CONFLICT (user_id, topic_id) DO UPDATE SET
         attempted = user_topic_stats.attempted + 1,
         correct = user_topic_stats.correct + $3,
         last_attempted_at = now()`,
      [userId, topicId, isCorrect ? 1 : 0],
      db,
    );

    return {
      isCorrect,
      correctAnswer: q.correct_answer,
    };
  });
}

// ---------------------------------------------------------------- Topic Stats (weak topics analytics)

export interface TopicStat {
  topic_id: string;
  topic_name: string;
  subject_name: string;
  attempted: number;
  correct: number;
  accuracy: number | null;
  last_attempted_at: string | null;
}

export async function getUserTopicStats(userId: string): Promise<TopicStat[]> {
  return query<TopicStat>(
    `SELECT uts.topic_id, t.name AS topic_name, s.name AS subject_name,
            uts.attempted, uts.correct,
            CASE WHEN uts.attempted > 0 THEN ROUND(100.0 * uts.correct / uts.attempted, 1)::float END AS accuracy,
            uts.last_attempted_at
       FROM user_topic_stats uts
       JOIN topics t ON t.id = uts.topic_id
       JOIN subjects s ON s.id = t.subject_id
      WHERE uts.user_id = $1
      ORDER BY accuracy ASC NULLS FIRST, uts.attempted DESC`,
    [userId],
  );
}
