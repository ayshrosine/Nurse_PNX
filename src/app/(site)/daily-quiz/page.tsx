import type { Metadata } from 'next';
import Link from 'next/link';
import { ButtonLink, Card, Container, EmptyState } from '@/components/ui';
import { getCurrentUser } from '@/lib/server/session';
import { getTodaysQuiz, getDailyStreak, listRecentQuizzes } from '@/lib/server/services/dailyQuizService';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Daily Quiz' };
export const dynamic = 'force-dynamic';

export default async function DailyQuizPage() {
  const user = await getCurrentUser();
  const [todayQuiz, recentQuizzes] = await Promise.all([
    getTodaysQuiz(),
    listRecentQuizzes(14),
  ]);
  const streak = user ? await getDailyStreak(user.id) : 0;
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Container className="py-12 lg:py-16">
      {/* Hero */}
      <div className="animate-slide-up text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-200/60 bg-brand-50/60 px-4 py-1.5 text-xs font-medium text-brand-700">
          🔥 Daily Booster Quiz
        </div>
        <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">Daily Free Quiz</h1>
        <p className="mx-auto mt-3 max-w-lg text-lg text-muted">
          10 free MCQs every day. Build your streak, sharpen your knowledge.
        </p>
        <p className="mt-2 text-sm text-muted">{today}</p>
      </div>

      {/* Streak + Today's Quiz */}
      <div className="mx-auto mt-10 max-w-xl space-y-6">
        {/* Streak Card */}
        {user && (
          <Card className="animate-scale-in flex items-center gap-6 p-6 bg-gradient-to-r from-brand-50 to-accent-50 border-brand-200/40">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-white shadow-sm">
              <span className="text-3xl">🔥</span>
            </div>
            <div>
              <div className="font-serif text-3xl font-semibold">{streak} day{streak !== 1 ? 's' : ''}</div>
              <div className="text-sm text-muted">
                {streak === 0 ? 'Start your streak today!' : streak >= 7 ? 'Amazing! Keep it going!' : 'Great start! Keep it up!'}
              </div>
            </div>
          </Card>
        )}

        {/* Today's Quiz */}
        {todayQuiz ? (
          <Card className="animate-slide-up stagger-1 p-6">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-ok-50 px-2.5 py-0.5 text-xs font-semibold text-ok">TODAY</span>
              {todayQuiz.subject_name && (
                <span className="text-xs text-muted">{todayQuiz.subject_name}</span>
              )}
            </div>
            <h2 className="mt-3 text-xl font-semibold">{todayQuiz.title}</h2>
            <p className="mt-1 text-sm text-muted">{todayQuiz.question_count} questions · Free · No time limit</p>
            <ButtonLink
              href={todayQuiz.test_series_id ? `/tests/${todayQuiz.test_series_id}` : '/exams'}
              size="lg"
              className="mt-5 w-full text-center"
            >
              Start Today&apos;s Quiz
            </ButtonLink>
          </Card>
        ) : (
          <Card className="animate-slide-up stagger-1 p-8 text-center">
            <span className="text-4xl">📝</span>
            <h2 className="mt-3 text-xl font-semibold">No quiz scheduled today</h2>
            <p className="mt-2 text-muted">Meanwhile, explore our test series or practice by topic.</p>
            <div className="mt-5 flex justify-center gap-3">
              <ButtonLink href="/test-series" variant="secondary">Test Series</ButtonLink>
              <ButtonLink href="/exams">Browse Exams</ButtonLink>
            </div>
          </Card>
        )}
      </div>

      {/* Recent Quizzes */}
      {recentQuizzes.length > 1 && (
        <div className="mx-auto mt-12 max-w-xl">
          <h2 className="text-lg font-semibold mb-4">Recent Quizzes</h2>
          <div className="space-y-2">
            {recentQuizzes.map((rq) => (
              <div key={rq.quiz_date} className="flex items-center justify-between rounded-lg border border-line/50 bg-surface px-4 py-3 text-sm">
                <div>
                  <span className="font-medium">{rq.title}</span>
                  {rq.subject_name && <span className="ml-2 text-muted">· {rq.subject_name}</span>}
                </div>
                <span className="text-muted">{formatDate(rq.quiz_date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Container>
  );
}
