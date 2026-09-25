import Link from 'next/link';
import { ButtonLink, Container, EmptyState } from '@/components/ui';
import { TestSeriesCard } from '@/components/test-series/TestSeriesCard';
import { SampleQuestion } from '@/components/test-series/SampleQuestion';
import { getCurrentUser } from '@/lib/server/session';
import { listPublished } from '@/lib/server/services/testSeriesService';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const user = await getCurrentUser();
  const series = await listPublished(user);
  const free = series.filter((s) => s.is_free);
  const paid = series.filter((s) => !s.is_free);
  const firstFree = free[0];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden hero-gradient">
        {/* Decorative floating shapes */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -right-20 top-20 size-72 rounded-full bg-brand-100/30 blur-3xl animate-float-slow" />
          <div className="absolute -left-16 bottom-10 size-56 rounded-full bg-accent-50/40 blur-3xl animate-float-slow stagger-3" />
          <div className="absolute left-1/2 top-10 size-40 rounded-full bg-brand-50/50 blur-2xl animate-float stagger-2" />
        </div>

        <Container className="relative grid items-center gap-12 py-20 md:grid-cols-[1.1fr_1fr] md:py-28 lg:py-36">
          <div className="animate-slide-up">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-brand-200/60 bg-white/60 px-4 py-1.5 text-xs font-medium text-brand-700 backdrop-blur-sm">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-500 opacity-50" />
                <span className="relative inline-flex size-2 rounded-full bg-brand-500" />
              </span>
              Nursing MCQ practice
            </div>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-[3.5rem]">
              Practice smarter.
              <br />
              <span className="text-gradient">Prepare better.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-2">
              Timed, exam-level test series crafted for nursing students — with a clear
              explanation behind every answer.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <ButtonLink href="/test-series" size="lg">
                Explore Test Series
              </ButtonLink>
              <ButtonLink href={firstFree ? `/test-series/${firstFree.id}` : '/test-series'} size="lg" variant="secondary">
                Try Free Test
              </ButtonLink>
            </div>

            {/* Stats strip */}
            <dl className="mt-12 flex items-center gap-10 border-t border-line/60 pt-6">
              <div className="animate-fade-up stagger-1">
                <dd className="font-serif text-3xl font-semibold text-ink">{series.length}</dd>
                <dt className="mt-0.5 text-sm text-muted">Test series</dt>
              </div>
              <div className="h-8 w-px bg-line" aria-hidden="true" />
              <div className="animate-fade-up stagger-2">
                <dd className="font-serif text-3xl font-semibold text-ink">{free.length}</dd>
                <dt className="mt-0.5 text-sm text-muted">Free to start</dt>
              </div>
              <div className="h-8 w-px bg-line" aria-hidden="true" />
              <div className="animate-fade-up stagger-3">
                <dd className="font-serif text-3xl font-semibold text-ink">₹199</dd>
                <dt className="mt-0.5 text-sm text-muted">Full series</dt>
              </div>
            </dl>
          </div>

          {/* Sample question */}
          <div className="animate-scale-in stagger-2">
            <SampleQuestion />
          </div>
        </Container>
      </section>

      {/* Test Series — unified section */}
      <section className="py-20 lg:py-24" id="series">
        <Container>
          {/* Free */}
          <div className="animate-slide-up">
            <SectionTag>Start here</SectionTag>
            <div className="mt-2 flex items-end justify-between gap-4">
              <h2 className="text-3xl font-semibold sm:text-4xl">Free test series</h2>
              <Link href="/test-series" className="shrink-0 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors">
                View all →
              </Link>
            </div>
          </div>
          {free.length ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {free.map((s, i) => (
                <div key={s.id} className={`animate-slide-up stagger-${i + 1}`}>
                  <TestSeriesCard series={s} />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8"><EmptyState title="No free tests yet" description="New practice tests are added regularly." /></div>
          )}

          {/* Paid */}
          <div className="mt-20 animate-slide-up">
            <SectionTag>Go deeper</SectionTag>
            <div className="mt-2 flex items-end justify-between gap-4">
              <h2 className="text-3xl font-semibold sm:text-4xl">Full test series</h2>
              <Link href="/test-series" className="shrink-0 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors">
                View all →
              </Link>
            </div>
          </div>
          {paid.length ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {paid.map((s, i) => (
                <div key={s.id} className={`animate-slide-up stagger-${i + 1}`}>
                  <TestSeriesCard series={s} />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8"><EmptyState title="Full test series are on their way" /></div>
          )}
        </Container>
      </section>

      {/* How it works */}
      <section className="relative overflow-hidden border-y border-line/50 bg-sunken/40 py-20 lg:py-24">
        <div className="pointer-events-none absolute inset-0 dot-pattern opacity-30" aria-hidden="true" />
        <Container className="relative">
          <div className="text-center animate-slide-up">
            <SectionTag className="justify-center">How it works</SectionTag>
            <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">From first attempt to exam day</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted">Simple, focused preparation in four steps.</p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.n} className={`animate-slide-up stagger-${i + 1}`}>
                <div className="group relative rounded-2xl border border-line/60 bg-surface p-6 card-hover h-full">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-sm font-bold text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                    {s.n}
                  </div>
                  <h3 className="mt-4 font-serif text-lg font-semibold leading-snug">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Creator */}
      <section className="py-20 lg:py-24">
        <Container>
          <div className="animate-slide-up overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 to-brand-600">
            <div className="grid items-center gap-8 p-8 sm:grid-cols-[auto_1fr] sm:p-12">
              <div className="flex size-20 items-center justify-center rounded-2xl bg-white/10 font-serif text-2xl font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm">
                DT
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-200">
                  Created by a nursing professional
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-white">Dhruva Thakre</h2>
                <p className="mt-1 text-brand-100/90">
                  Nursing Officer, GMCH Nagpur · B.Sc. Nursing · Batch 2018, GMC Nagpur
                </p>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-brand-100/80">
                  Every question is written and reviewed against current nursing curricula, with explanations that
                  teach the reasoning — not just the answer.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* CTA */}
      {!user && (
        <section className="pb-20 lg:pb-24">
          <Container>
            <div className="animate-slide-up relative overflow-hidden rounded-2xl border border-line bg-surface px-6 py-16 text-center sm:px-12">
              <div className="pointer-events-none absolute inset-0 hero-gradient opacity-60" aria-hidden="true" />
              <div className="relative">
                <h2 className="text-3xl font-semibold sm:text-4xl">
                  Ready for your first mock test?
                </h2>
                <p className="mx-auto mt-3 max-w-md text-muted">
                  Sign in with Google to get started — it takes just a few seconds.
                </p>
                <div className="mt-8">
                  <ButtonLink href="/login" size="lg">Get Started Free</ButtonLink>
                </div>
              </div>
            </div>
          </Container>
        </section>
      )}
    </>
  );
}

const STEPS = [
  { n: '01', title: 'Pick a test series', body: 'Start with a free mock or unlock a full exam-level series for ₹199.' },
  { n: '02', title: 'Attempt under exam conditions', body: 'A real timer, a question navigator, and mark-for-review — on any device.' },
  { n: '03', title: 'Review every answer', body: 'Instant, server-checked scores with the correct option and an explanation for each question.' },
  { n: '04', title: 'Track your progress', body: 'Your dashboard shows averages, best scores and how you are improving over time.' },
];

function SectionTag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-600 ${className ?? ''}`}>
      <span className="h-px w-5 bg-brand-500/40" aria-hidden="true" />
      {children}
    </div>
  );
}
