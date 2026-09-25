import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ButtonLink, Container, EmptyState } from '@/components/ui';
import { ScoreSummary, QuestionReview } from '@/components/results/ResultView';
import { requireUserPage } from '@/lib/server/session';
import { getResult } from '@/lib/server/services/attemptService';
import { ApiError } from '@/lib/errors';
import { uuidSchema } from '@/lib/validation';

export const metadata: Metadata = { title: 'Result' };
export const dynamic = 'force-dynamic';

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const user = await requireUserPage(`/results/${id}`);

  let result;
  try {
    // Ownership is enforced inside getResult: another student's id yields 403 before any data is read out.
    result = await getResult(user, id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    if (err instanceof ApiError && (err.status === 403 || err.status === 409)) {
      return (
        <Container className="py-16">
          <EmptyState
            title={err.status === 403 ? 'This result isn’t yours' : 'This test hasn’t been submitted yet'}
            description={err.status === 403 ? 'You can only view results for your own attempts.' : 'Finish the test to see your score and answers.'}
            action={<ButtonLink href="/dashboard" variant="secondary">Go to dashboard</ButtonLink>}
          />
        </Container>
      );
    }
    throw err;
  }

  return (
    <Container className="max-w-4xl py-12">
      <ScoreSummary result={result} />
      <div className="mt-6 flex flex-wrap gap-2">
        <ButtonLink href={`/tests/${result.test_series_id}`}>Retake test</ButtonLink>
        <ButtonLink href="/dashboard" variant="secondary">Back to dashboard</ButtonLink>
      </div>
      <h2 className="mb-4 mt-12 text-2xl font-semibold">Question-wise review</h2>
      <QuestionReview result={result} />
    </Container>
  );
}
