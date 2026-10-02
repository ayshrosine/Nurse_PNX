import type { Metadata } from 'next';
import { PracticeRunner } from '@/components/test/PracticeRunner';

export const metadata: Metadata = { title: 'Practice' };

import { requireStudentPage } from '@/lib/server/session';

export default async function PracticePage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  await requireStudentPage(`/practice/${topicId}`);

  return (
    <div className="min-h-dvh bg-paper">
      <PracticeRunner topicId={topicId} />
    </div>
  );
}
