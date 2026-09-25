import { notFound } from 'next/navigation';
import { ButtonLink, StatusBadge } from '@/components/ui';
import { AdminHeader } from '@/components/admin/shared';
import { QuestionManager } from '@/components/admin/QuestionManager';
import { adminGet } from '@/lib/server/services/testSeriesService';
import { listForAdmin } from '@/lib/server/services/questionService';
import { uuidSchema } from '@/lib/validation';

export const metadata = { title: 'Questions' };

export default async function QuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const series = await adminGet(id).catch(() => null);
  if (!series) notFound();
  const questions = await listForAdmin(id);
  return (
    <div className="max-w-4xl">
      <AdminHeader
        back={{ href: `/admin/test-series/${id}`, label: series.title }}
        title={<span className="flex items-center gap-3">Questions <StatusBadge status={series.status} /></span>}
        description="Order here is the order students see. Questions that students have already answered can be edited but not deleted."
        actions={<ButtonLink href={`/admin/test-series/${id}/import`} variant="secondary" size="sm">Import questions</ButtonLink>}
      />
      <QuestionManager seriesId={id} initial={questions} />
    </div>
  );
}
