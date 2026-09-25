import { notFound } from 'next/navigation';
import { AdminHeader } from '@/components/admin/shared';
import { StructuredImport } from '@/components/admin/import/StructuredImport';
import { DocumentPipeline } from '@/components/admin/import/DocumentPipeline';
import { adminGet } from '@/lib/server/services/testSeriesService';
import { listForSeries } from '@/lib/server/services/documentService';
import { getSettings, providerAvailability } from '@/lib/server/services/settingsService';
import { uuidSchema } from '@/lib/validation';

export const metadata = { title: 'Import questions' };

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const series = await adminGet(id).catch(() => null);
  if (!series) notFound();
  const [docs, settings] = await Promise.all([listForSeries(id), getSettings()]);

  return (
    <div className="max-w-5xl">
      <AdminHeader back={{ href: `/admin/test-series/${id}`, label: series.title }} title="Import questions"
        description="Everything is parsed on the server and shown as plain text for review before it is saved." />
      <div className="space-y-6">
        <StructuredImport seriesId={id} />
        <DocumentPipeline seriesId={id} initialDocs={docs} settings={settings} availability={providerAvailability()} />
      </div>
    </div>
  );
}
