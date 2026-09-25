import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { TestRunner } from '@/components/test/TestRunner';
import { requireStudentPage } from '@/lib/server/session';
import { getPublished } from '@/lib/server/services/testSeriesService';
import { uuidSchema } from '@/lib/validation';

export const metadata: Metadata = { title: 'Test' };
export const dynamic = 'force-dynamic';

export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const user = await requireStudentPage(`/tests/${id}`);
  const series = await getPublished(id, user);
  if (!series) notFound();
  // UX redirect only — POST /api/tests/:id/start re-checks access and returns 403 PURCHASE_REQUIRED.
  if (!series.has_access) redirect(`/unlock/${id}`);

  return (
    <TestRunner
      testSeriesId={series.id}
      title={series.title}
      durationMinutes={series.duration_minutes}
      questionCount={series.question_count}
      instructions={series.instructions}
    />
  );
}
