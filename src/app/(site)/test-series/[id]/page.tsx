import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ButtonLink, Card, Container, StatusBadge } from '@/components/ui';
import { AccessBadge } from '@/components/test-series/TestSeriesCard';
import { getCurrentUser } from '@/lib/server/session';
import { getPublished } from '@/lib/server/services/testSeriesService';
import { query } from '@/lib/server/db';
import { formatDate, formatPercent, formatPrice } from '@/lib/format';
import { uuidSchema } from '@/lib/validation';
import type { Attempt, PublicTestSeries, User } from '@/types';

export const dynamic = 'force-dynamic';

async function load(id: string) {
  if (!uuidSchema.safeParse(id).success) return null;
  const user = await getCurrentUser();
  const series = await getPublished(id, user);
  return series ? { user, series } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const data = await load((await params).id);
  return { title: data?.series.title ?? 'Test series' };
}

/** CTA table from Frontend doc §7 — every input is server-derived. */
function cta(series: PublicTestSeries, user: User | null) {
  const price = formatPrice(series.price, series.is_free, series.currency);
  if (!user) {
    return series.is_free
      ? { label: 'Login to Start', href: `/login?next=${encodeURIComponent(`/tests/${series.id}`)}` }
      : { label: 'Login to Unlock', href: `/login?next=${encodeURIComponent(`/unlock/${series.id}`)}` };
  }
  if (series.has_access) return { label: 'Start Test', href: `/tests/${series.id}` };
  return { label: `Unlock for ${price}`, href: `/unlock/${series.id}` };
}

export default async function TestSeriesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await load((await params).id);
  if (!data) notFound();
  const { user, series } = data;
  const attempts = user
    ? await query<Attempt>(
        `SELECT id, status, percentage, score, total_questions, started_at, submitted_at FROM attempts
          WHERE user_id = $1 AND test_series_id = $2 ORDER BY started_at DESC LIMIT 5`,
        [user.id, series.id],
      )
    : [];
  const inProgress = attempts.find((a) => a.status === 'IN_PROGRESS');
  const action = cta(series, user);
  const ready = series.question_count > 0;

  return (
    <Container className="py-12">
      <nav className="mb-6 text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/test-series" className="hover:text-brand-600">Test series</Link> <span aria-hidden>/</span>{' '}
        <span className="text-ink-2">{series.title}</span>
      </nav>
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          <AccessBadge access={series.access} />
          <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">{series.title}</h1>
          {series.description && <p className="mt-4 text-lg leading-relaxed text-ink-2">{series.description}</p>}

          <dl className="mt-8 grid grid-cols-3 gap-4 rounded-card border border-line bg-surface p-5">
            <div><dt className="text-xs text-muted">Questions</dt><dd className="mt-1 font-serif text-2xl">{series.question_count}</dd></div>
            <div><dt className="text-xs text-muted">Duration</dt><dd className="mt-1 font-serif text-2xl">{series.duration_minutes} min</dd></div>
            <div><dt className="text-xs text-muted">Price</dt><dd className="mt-1 font-serif text-2xl">{formatPrice(series.price, series.is_free, series.currency)}</dd></div>
          </dl>

          {series.instructions && (
            <section className="mt-8">
              <h2 className="text-xl font-semibold">Instructions</h2>
              <ul className="mt-3 space-y-2 text-ink-2">
                {series.instructions.split('\n').filter(Boolean).map((line, i) => (
                  <li key={i} className="flex gap-3"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500" />{line}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-8 rounded-card border border-line bg-surface p-5 text-sm text-ink-2">
            <div className="font-medium text-ink">Prepared by Dhruva Thakre</div>
            <div className="text-muted">Nursing Officer, GMCH Nagpur · Nursing Level Up</div>
          </section>
        </div>

        <aside>
          <Card className="sticky top-24 p-6">
            <div className="font-serif text-3xl font-semibold">{formatPrice(series.price, series.is_free, series.currency)}</div>
            <p className="mt-1 text-sm text-muted">
              {series.is_free ? 'Free with a Nursing Level Up account' : series.has_access ? 'You own this test series' : 'One-time payment · lifetime access'}
            </p>
            <div className="mt-5 space-y-2">
              {!ready ? (
                <p className="rounded-lg bg-sunken p-3 text-sm text-muted">Questions are being added. Check back soon.</p>
              ) : inProgress && series.has_access ? (
                <ButtonLink href={`/tests/${series.id}`} size="lg" className="w-full">Resume Test</ButtonLink>
              ) : (
                <ButtonLink href={action.href} size="lg" className="w-full" data-testid="series-cta">{action.label}</ButtonLink>
              )}
            </div>
            {attempts.length > 0 && (
              <div className="mt-6 border-t border-line pt-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted">Your attempts</div>
                <ul className="mt-2 divide-y divide-line text-sm">
                  {attempts.map((a) => (
                    <li key={a.id} className="flex items-center justify-between py-2">
                      <span className="text-ink-2">{formatDate(a.submitted_at ?? a.started_at)}</span>
                      {a.status === 'COMPLETED' ? (
                        <Link href={`/results/${a.id}`} className="font-medium text-brand-600 hover:underline">{formatPercent(a.percentage)}</Link>
                      ) : (
                        <StatusBadge status={a.status} />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </aside>
      </div>
    </Container>
  );
}
