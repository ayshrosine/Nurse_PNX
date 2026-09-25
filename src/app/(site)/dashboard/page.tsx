import type { Metadata } from 'next';
import Link from 'next/link';
import { ButtonLink, Card, Container, EmptyState, Stat, StatusBadge, Table, Td, Th } from '@/components/ui';
import { requireStudentPage } from '@/lib/server/session';
import { listForUser as listAttempts, progressForUser } from '@/lib/server/services/attemptService';
import { listForUser as listPurchases } from '@/lib/server/services/purchaseService';
import { formatDate, formatDuration, formatMoney, formatPercent, formatPhone } from '@/lib/format';
import type { Progress } from '@/types';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireStudentPage('/dashboard');
  const [attempts, purchases, progress] = await Promise.all([listAttempts(user.id, 20), listPurchases(user.id), progressForUser(user.id)]);
  const owned = purchases.filter((p) => p.status === 'SUCCESS');
  const inProgress = attempts.filter((a) => a.status === 'IN_PROGRESS');
  const firstName = user.name.split(' ')[0];

  return (
    <Container className="py-12">
      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Dashboard</div>
          <h1 className="mt-2 text-3xl font-semibold">Welcome back, {firstName}</h1>
        </div>
        <ButtonLink href="/test-series">Browse test series</ButtonLink>
      </div>

      {inProgress.length > 0 && (
        <Card className="mb-6 flex flex-col gap-3 border-brand-200 bg-brand-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-medium text-brand-800">You have an unfinished test</div>
            <div className="text-sm text-brand-700">{inProgress[0].test_title}</div>
          </div>
          <ButtonLink href={`/tests/${inProgress[0].test_series_id}`} size="sm">Resume</ButtonLink>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Tests attempted" value={progress.tests_attempted} />
        <Stat label="Tests completed" value={progress.tests_completed} />
        <Stat label="Average score" value={formatPercent(progress.average_percentage)} />
        <Stat label="Best score" value={formatPercent(progress.best_percentage)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Progress</h2>
            <span className="text-sm text-muted">
              Accuracy {formatPercent(progress.accuracy)} · {progress.total_questions_answered} answered
            </span>
          </div>
          <ProgressChart trend={progress.trend} />
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Profile</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div><dt className="text-muted">Name</dt><dd className="font-medium">{user.name}</dd></div>
            <div><dt className="text-muted">Email</dt><dd className="break-all font-medium">{user.email}</dd></div>
            <div><dt className="text-muted">Phone</dt><dd className="font-medium">{formatPhone(user.phone)}</dd></div>
          </dl>
          <Link href="/profile" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">Edit profile →</Link>
        </Card>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">Purchased test series</h2>
        {owned.length === 0 ? (
          <EmptyState title="No purchases yet" description="Unlock a full test series to see it here." action={<ButtonLink href="/test-series" variant="secondary" size="sm">See test series</ButtonLink>} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {owned.map((p) => (
              <Card key={p.id} className="flex flex-col p-5">
                <div className="font-medium">{p.test_title}</div>
                <div className="mt-1 text-sm text-muted">Purchased {formatDate(p.created_at)} · {formatMoney(p.amount, p.currency)}</div>
                <div className="mt-4 flex gap-2">
                  <ButtonLink href={`/tests/${p.test_series_id}`} size="sm">Start test</ButtonLink>
                  <ButtonLink href={`/test-series/${p.test_series_id}`} size="sm" variant="ghost">Details</ButtonLink>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">Recent attempts</h2>
        {attempts.length === 0 ? (
          <EmptyState title="No attempts yet" description="Take a free test to see your results here." action={<ButtonLink href="/test-series" size="sm">Find a free test</ButtonLink>} />
        ) : (
          <Table>
            <thead>
              <tr><Th>Test</Th><Th>Date</Th><Th>Score</Th><Th>Percentage</Th><Th>Time</Th><Th /></tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id}>
                  <Td className="font-medium text-ink">{a.test_title}</Td>
                  <Td>{formatDate(a.submitted_at ?? a.started_at)}</Td>
                  <Td className="tabular-nums">{a.status === 'COMPLETED' ? `${a.score}/${a.total_questions}` : '—'}</Td>
                  <Td className="tabular-nums">{a.status === 'COMPLETED' ? formatPercent(a.percentage) : <StatusBadge status={a.status} />}</Td>
                  <Td>{formatDuration(a.time_taken_seconds)}</Td>
                  <Td className="text-right">
                    {a.status === 'COMPLETED' ? (
                      <Link href={`/results/${a.id}`} className="font-medium text-brand-600 hover:underline">View result</Link>
                    ) : a.status === 'IN_PROGRESS' ? (
                      <Link href={`/tests/${a.test_series_id}`} className="font-medium text-brand-600 hover:underline">Resume</Link>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </Container>
  );
}

function ProgressChart({ trend }: { trend: Progress['trend'] }) {
  if (trend.length === 0) {
    return <p className="mt-6 rounded-lg bg-sunken p-6 text-center text-sm text-muted">Complete a test to start tracking your progress.</p>;
  }
  return (
    <div className="mt-6">
      <div className="flex h-44 items-end gap-2 border-b border-line" role="img" aria-label={`Scores of your last ${trend.length} completed tests`}>
        {trend.map((t) => (
          <Link key={t.attempt_id} href={`/results/${t.attempt_id}`} className="group flex h-full flex-1 flex-col justify-end" title={`${t.test_title}: ${formatPercent(t.percentage)}`}>
            <span className="mb-1 text-center text-[11px] tabular-nums text-muted opacity-0 transition-opacity group-hover:opacity-100">{formatPercent(t.percentage)}</span>
            <span
              className="block w-full rounded-t-md bg-brand-500 transition-colors group-hover:bg-brand-700"
              style={{ height: `${Math.max(4, t.percentage)}%` }}
            />
          </Link>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-faint">
        <span>{formatDate(trend[0].submitted_at)}</span>
        <span>Latest</span>
      </div>
    </div>
  );
}
