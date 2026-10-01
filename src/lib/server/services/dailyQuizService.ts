import 'server-only';
import { prisma } from '../db';

export interface DailyQuizInfo {
  id: string;
  quiz_date: Date;
  test_series_id: string | null;
  subject_name: string | null;
  title: string;
  question_count: number;
}

/** Get today's daily quiz for a specific exam program. If not provided, gets the first available one. */
export async function getTodaysQuiz(programId?: string): Promise<DailyQuizInfo | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dq = await prisma.daily_quizzes.findFirst({
    where: {
      ...(programId ? { program_id: programId } : {}),
      quiz_date: today,
    },
    include: {
      subjects: true,
      test_series: {
        include: {
          _count: {
            select: { questions: true }
          }
        }
      }
    }
  });

  if (!dq) return null;

  return {
    id: dq.id,
    quiz_date: dq.quiz_date,
    test_series_id: dq.test_series_id,
    subject_name: dq.subjects?.name || null,
    title: dq.test_series?.title || `Daily Quiz — ${dq.quiz_date.toDateString()}`,
    question_count: dq.test_series?._count.questions || 10,
  };
}

/** Get a user's daily quiz streak for a specific exam program. If no program, just returns 0. */
export async function getDailyStreak(userId: string, programId?: string): Promise<number> {
  if (!programId) return 0; // Global streaks not supported in schema yet
  const streak = await prisma.streaks.findUnique({
    where: {
      user_id_program_id: { user_id: userId, program_id: programId }
    }
  });
  return streak?.current ?? 0;
}

/** List recent quizzes. */
export async function listRecentQuizzes(days: number): Promise<{ quiz_date: string; title: string; subject_name: string | null }[]> {
  const dqs = await prisma.daily_quizzes.findMany({
    take: days,
    orderBy: { quiz_date: 'desc' },
    include: {
      subjects: true,
      test_series: true
    }
  });
  return dqs.map(dq => ({
    quiz_date: dq.quiz_date.toISOString(),
    title: dq.test_series?.title || `Daily Quiz`,
    subject_name: dq.subjects?.name || null,
  }));
}
