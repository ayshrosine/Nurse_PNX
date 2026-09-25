import type { Metadata } from 'next';
import { Container, EmptyState, PageHeader } from '@/components/ui';
import { TestSeriesCard } from '@/components/test-series/TestSeriesCard';
import { getCurrentUser } from '@/lib/server/session';
import { listPublished } from '@/lib/server/services/testSeriesService';

export const metadata: Metadata = { title: 'Test Series' };
export const dynamic = 'force-dynamic';

export default async function TestSeriesPage() {
  const series = await listPublished(await getCurrentUser());
  const free = series.filter((s) => s.is_free);
  const paid = series.filter((s) => !s.is_free);

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Catalog"
        title="Test series"
        description="Timed, exam-level MCQ tests with explained answers. Start free, unlock full series when you’re ready."
      />
      {series.length === 0 ? (
        <EmptyState title="No test series published yet" description="Please check back soon." />
      ) : (
        <div className="space-y-12">
          {free.length > 0 && (
            <section aria-labelledby="free-h">
              <h2 id="free-h" className="mb-4 text-xl font-semibold">Free</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{free.map((s) => <TestSeriesCard key={s.id} series={s} />)}</div>
            </section>
          )}
          {paid.length > 0 && (
            <section aria-labelledby="paid-h">
              <h2 id="paid-h" className="mb-4 text-xl font-semibold">Full series</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{paid.map((s) => <TestSeriesCard key={s.id} series={s} />)}</div>
            </section>
          )}
        </div>
      )}
    </Container>
  );
}
