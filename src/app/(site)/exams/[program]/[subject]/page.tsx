import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ButtonLink, Card, Container } from '@/components/ui';
import { getProgramBySlug, getSubjectBySlug, listTopicsForSubject, buildTopicTree } from '@/lib/server/services/catalogService';

export async function generateMetadata({ params }: { params: Promise<{ program: string; subject: string }> }): Promise<Metadata> {
  const { subject: slug } = await params;
  const sub = await getSubjectBySlug(slug);
  return { title: sub?.name ?? 'Subject' };
}

export const dynamic = 'force-dynamic';

export default async function SubjectTopicsPage({ params }: { params: Promise<{ program: string; subject: string }> }) {
  const { program: programSlug, subject: subjectSlug } = await params;
  const [prog, sub] = await Promise.all([
    getProgramBySlug(programSlug),
    getSubjectBySlug(subjectSlug),
  ]);
  if (!prog || !sub) notFound();

  const topics = await listTopicsForSubject(sub.id);
  const tree = buildTopicTree(topics);
  const totalQuestions = topics.reduce((sum, t) => sum + t.question_count, 0);

  return (
    <Container className="py-12 lg:py-16">
      {/* Breadcrumb */}
      <nav className="animate-slide-up flex items-center gap-2 text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/exams" className="hover:text-brand-600 transition-colors">Exams</Link>
        <span>›</span>
        <Link href={`/exams/${programSlug}`} className="hover:text-brand-600 transition-colors">{prog.name}</Link>
        <span>›</span>
        <span className="font-medium text-ink">{sub.name}</span>
      </nav>

      <div className="mt-6 animate-slide-up">
        <div className="flex items-center gap-4">
          <span className="text-3xl">{sub.icon}</span>
          <div>
            <h1 className="text-3xl font-semibold">{sub.name}</h1>
            {sub.description && <p className="mt-1 text-muted">{sub.description}</p>}
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <div className="rounded-lg bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700">
            {topics.length} Topics
          </div>
          <div className="rounded-lg bg-sunken px-4 py-2 text-sm font-medium text-ink-2">
            {totalQuestions} Questions
          </div>
        </div>
      </div>

      {/* Topics List */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-6">Topics</h2>
        {tree.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted">Topics are being added. Check back soon!</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {tree.map((topic, i) => (
              <div key={topic.id} className={`animate-slide-up stagger-${Math.min(i + 1, 6)}`}>
                <Card className="card-hover">
                  <div className="flex items-center justify-between p-5">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-ink">{topic.name}</h3>
                      <div className="mt-1 flex gap-4 text-sm text-muted">
                        <span>{topic.question_count} questions</span>
                        {topic.children.length > 0 && (
                          <span>{topic.children.length} sub-topics</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {topic.question_count > 0 && (
                        <ButtonLink href={`/practice/${topic.id}`} size="sm" variant="secondary">
                          Practice
                        </ButtonLink>
                      )}
                    </div>
                  </div>

                  {/* Sub-topics */}
                  {topic.children.length > 0 && (
                    <div className="border-t border-line/50 bg-sunken/30 px-5 py-3">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {topic.children.map((child: any) => (
                          <Link
                            key={child.id}
                            href={child.question_count > 0 ? `/practice/${child.id}` : '#'}
                            className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-brand-50"
                          >
                            <span className="text-ink">{child.name}</span>
                            <span className="text-xs text-muted">{child.question_count} Qs</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            ))}
          </div>
        )}
      </section>
    </Container>
  );
}
