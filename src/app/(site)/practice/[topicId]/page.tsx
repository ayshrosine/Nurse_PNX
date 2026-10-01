import type { Metadata } from 'next';
import { PracticeRunner } from '@/components/test/PracticeRunner';

export const metadata: Metadata = { title: 'Practice' };

export default async function PracticePage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;

  return (
    <div className="min-h-dvh bg-paper">
      <PracticeRunner topicId={topicId} />
    </div>
  );
}
