import { notFound } from 'next/navigation';
import { AdminHeader } from '@/components/admin/shared';
import { TestSeriesForm } from '@/components/admin/TestSeriesForm';
import { adminGet } from '@/lib/server/services/testSeriesService';
import { uuidSchema } from '@/lib/validation';

export const metadata = { title: 'Edit test series' };

export default async function EditTestSeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const series = await adminGet(id).catch(() => null);
  if (!series) notFound();
  return (
    <div className="max-w-3xl">
      <AdminHeader back={{ href: `/admin/test-series/${id}`, label: series.title }} title="Edit test series" />
      <TestSeriesForm initial={series} />
    </div>
  );
}
