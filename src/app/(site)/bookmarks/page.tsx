import type { Metadata } from 'next';
import Link from 'next/link';
import { ButtonLink, Card, Container, EmptyState } from '@/components/ui';
import { requireStudentPage } from '@/lib/server/session';
import { listBookmarks } from '@/lib/server/services/bookmarkService';

export const metadata: Metadata = { title: 'Bookmarks' };
export const dynamic = 'force-dynamic';

const LETTERS = ['A', 'B', 'C', 'D'] as const;

export default async function BookmarksPage() {
  const user = await requireStudentPage('/bookmarks');
  const bookmarks = await listBookmarks(user.id);

  // Group by subject
  const grouped = new Map<string, typeof bookmarks>();
  for (const b of bookmarks) {
    const key = b.subject_name ?? 'Uncategorized';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(b);
  }

  return (
    <Container className="py-12">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Bookmarks</div>
          <h1 className="mt-2 text-3xl font-semibold">Saved Questions</h1>
          <p className="mt-1 text-sm text-muted">{bookmarks.length} bookmarked question{bookmarks.length !== 1 ? 's' : ''}</p>
        </div>
        <ButtonLink href="/exams" variant="secondary">Browse more</ButtonLink>
      </div>

      {bookmarks.length === 0 ? (
        <EmptyState
          title="No bookmarks yet"
          description="While reviewing results, bookmark questions you want to revisit later."
          action={<ButtonLink href="/test-series">Take a test</ButtonLink>}
        />
      ) : (
        <div className="space-y-10">
          {[...grouped.entries()].map(([subjectName, items]) => (
            <section key={subjectName}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="rounded bg-brand-50 px-2.5 py-1 text-sm font-medium text-brand-700">{subjectName}</span>
                <span className="text-sm text-muted">{items.length} question{items.length !== 1 ? 's' : ''}</span>
              </h2>
              <div className="space-y-4">
                {items.map((b) => (
                  <Card key={b.question_id} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        {b.topic_name && <span className="text-xs text-muted">{b.topic_name}</span>}
                        <p className="mt-1 font-serif text-base leading-relaxed text-ink">{b.question_text}</p>

                        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                          {LETTERS.map((letter) => {
                            const isCorrect = b.correct_answer === letter;
                            return (
                              <div
                                key={letter}
                                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${isCorrect ? 'bg-ok-50 text-ok font-medium' : 'bg-sunken text-ink-2'}`}
                              >
                                <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${isCorrect ? 'bg-ok text-white' : 'bg-line text-muted'}`}>
                                  {letter}
                                </span>
                                {b[`option_${letter.toLowerCase()}` as 'option_a']}
                              </div>
                            );
                          })}
                        </div>

                        {b.explanation && (
                          <div className="mt-3 rounded-md bg-brand-50/50 border border-brand-100 px-3 py-2 text-sm text-ink-2">
                            <span className="font-medium text-brand-700">Explanation:</span> {b.explanation}
                          </div>
                        )}
                      </div>
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
