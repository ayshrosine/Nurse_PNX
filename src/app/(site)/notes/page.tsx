import type { Metadata } from 'next';
import { Card, Container, EmptyState } from '@/components/ui';
import { listResources } from '@/lib/server/services/productService';
import { getCurrentUser } from '@/lib/server/session';

export const metadata: Metadata = { title: 'Notes & PDFs' };
export const dynamic = 'force-dynamic';

function formatSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function NotesPage() {
  const user = await getCurrentUser();
  const resources = await listResources();

  // Group by subject
  const grouped = new Map<string, typeof resources>();
  for (const r of resources) {
    const key = r.subject_name ?? 'General';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  return (
    <Container className="py-12 lg:py-16">
      <div className="animate-slide-up text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-200/60 bg-brand-50/60 px-4 py-1.5 text-xs font-medium text-brand-700">
          📄 Study Material
        </div>
        <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">Notes & PDFs</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          Downloadable handwritten notes and study material curated for nursing exams.
        </p>
      </div>

      {resources.length === 0 ? (
        <div className="mx-auto mt-12 max-w-md">
          <EmptyState
            title="Notes are coming soon"
            description="We're preparing high-quality notes for all major nursing subjects. Check back shortly!"
          />
        </div>
      ) : (
        <div className="mt-12 space-y-10">
          {[...grouped.entries()].map(([subjectName, items]) => (
            <section key={subjectName}>
              <h2 className="text-xl font-semibold mb-4">{subjectName}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((r) => (
                  <Card key={r.id} className="flex flex-col p-5 card-hover">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent">
                        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-ink">{r.title}</h3>
                        {r.description && <p className="mt-1 text-sm text-muted line-clamp-2">{r.description}</p>}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs text-muted">
                      <div className="flex gap-3">
                        <span>{r.file_type}</span>
                        {r.size_bytes && <span>{formatSize(r.size_bytes)}</span>}
                        <span>{r.download_count} downloads</span>
                      </div>
                      {r.is_free ? (
                        <span className="rounded-full bg-ok-50 px-2 py-0.5 font-semibold text-ok">FREE</span>
                      ) : (
                        <span className="rounded-full bg-accent-50 px-2 py-0.5 font-semibold text-accent">PAID</span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Container>
  );
}
