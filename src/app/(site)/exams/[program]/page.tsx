import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ButtonLink, Card, Container } from '@/components/ui';
import { getProgramBySlug, listSubjectsForProgram, listTestsFiltered, listExamPapers } from '@/lib/server/services/catalogService';

export async function generateMetadata({ params }: { params: Promise<{ program: string }> }): Promise<Metadata> {
  const { program: slug } = await params;
  const prog = await getProgramBySlug(slug);
  return { title: prog?.name ?? 'Exam' };
}

export const dynamic = 'force-dynamic';

export default async function ExamProgramPage({ params }: { params: Promise<{ program: string }> }) {
  const { program: slug } = await params;
  const prog = await getProgramBySlug(slug);
  if (!prog) notFound();

  const [subjects, tests, papers] = await Promise.all([
    listSubjectsForProgram(prog.id),
    listTestsFiltered({ programSlug: slug }),
    listExamPapers(slug),
  ]);

  const freeTests = tests.filter((t) => t.is_free);
  const paidTests = tests.filter((t) => !t.is_free);

  return (
    <Container className="py-12 lg:py-16">
      {/* Hero */}
      <div className="animate-slide-up">
        <Link href="/exams" className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors">
          ← All Exams
        </Link>
        <div className="mt-4 flex items-center gap-4">
          <span className="text-4xl">{prog.icon}</span>
          <div>
            <h1 className="text-3xl font-semibold sm:text-4xl">{prog.name}</h1>
            {prog.description && <p className="mt-1 text-muted">{prog.description}</p>}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <div className="rounded-lg bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700">
            {subjects.length} Subjects
          </div>
          <div className="rounded-lg bg-sunken px-4 py-2 text-sm font-medium text-ink-2">
            {tests.length} Mock Tests
          </div>
          {papers.length > 0 && (
            <div className="rounded-lg bg-accent-50 px-4 py-2 text-sm font-medium text-accent">
              {papers.length} PYQ Papers
            </div>
          )}
        </div>
      </div>

      {/* Subjects Grid */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Subjects</h2>
        <p className="mt-1 text-sm text-muted">Select a subject to browse topics and start practicing</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s, i) => (
            <Link key={s.id} href={`/exams/${slug}/${s.slug}`} className={`block group animate-slide-up stagger-${Math.min(i + 1, 6)}`}>
              <Card className="flex items-start gap-4 p-5 card-hover h-full">
                <span className="mt-0.5 text-2xl">{s.icon}</span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-ink group-hover:text-brand-600 transition-colors">{s.name}</h3>
                  <div className="mt-1 flex gap-3 text-xs text-muted">
                    <span>{s.topic_count} topics</span>
                    <span>{s.question_count} questions</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Free Tests */}
      {freeTests.length > 0 && (
        <section className="mt-12">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-semibold">Free Mock Tests</h2>
            <Link href="/test-series" className="text-sm font-medium text-brand-600 hover:underline">View all →</Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {freeTests.slice(0, 6).map((t) => (
              <Card key={t.id} className="flex flex-col p-5 card-hover">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-ok-50 px-2.5 py-0.5 text-xs font-semibold text-ok">FREE</span>
                  {t.test_type && <span className="text-xs text-muted">{t.test_type.replace('_', ' ')}</span>}
                </div>
                <h3 className="mt-2 font-semibold text-ink">{t.title}</h3>
                <div className="mt-1 text-sm text-muted">
                  {t.question_count} Qs · {t.duration_minutes} min
                </div>
                <div className="mt-4 flex-1" />
                <ButtonLink href={`/tests/${t.id}`} size="sm" className="mt-2 w-full text-center">Start Test</ButtonLink>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* PYQ Papers */}
      {papers.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold">Previous Year Questions (PYQ)</h2>
          <p className="mt-1 text-sm text-muted">Practice with real exam questions from past years</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {papers.map((p) => (
              <Card key={p.id} className="p-5 card-hover">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-semibold text-accent">PYQ</span>
                  <span className="text-xs text-muted">{p.exam_year}</span>
                </div>
                <h3 className="mt-2 font-semibold text-ink">{p.exam_name}</h3>
                {p.shift && <p className="text-sm text-muted">Shift: {p.shift}</p>}
                <p className="mt-1 text-sm text-muted">{p.question_count} questions available</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Paid Tests */}
      {paidTests.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold">Premium Mock Tests</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paidTests.slice(0, 6).map((t) => (
              <Card key={t.id} className="flex flex-col p-5 card-hover">
                <h3 className="font-semibold text-ink">{t.title}</h3>
                <div className="mt-1 text-sm text-muted">
                  {t.question_count} Qs · {t.duration_minutes} min
                </div>
                <div className="mt-2 font-serif text-lg font-semibold text-ink">₹{t.price}</div>
                <div className="mt-4 flex-1" />
                <ButtonLink href={`/test-series/${t.id}`} variant="secondary" size="sm" className="mt-2 w-full text-center">
                  View Details
                </ButtonLink>
              </Card>
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
