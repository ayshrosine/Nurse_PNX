import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ButtonLink, Card, Stat, StatusBadge } from '@/components/ui';
import { AdminHeader } from '@/components/admin/shared';
import { ActionButton } from '@/components/admin/ActionButton';
import { adminGet } from '@/lib/server/services/testSeriesService';
import { listForEntity } from '@/lib/server/services/auditService';
import { formatDateTime, formatMoney, formatPrice } from '@/lib/format';
import { uuidSchema } from '@/lib/validation';

export const metadata = { title: 'Test series' };

export default async function AdminTestSeriesDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const s = await adminGet(id).catch(() => null);
  if (!s) notFound();
  const history = await listForEntity('test_series', id);
  const base = `/api/admin/test-series/${id}`;

  return (
    <>
      <AdminHeader
        back={{ href: '/admin/test-series', label: 'Test series' }}
        title={<span className="flex flex-wrap items-center gap-3">{s.title} <StatusBadge status={s.status} /></span>}
        description={`${formatPrice(s.price, s.is_free, s.currency)} · ${s.duration_minutes} minutes · created ${formatDateTime(s.created_at)}`}
        actions={
          <>
            <ButtonLink href={`/admin/test-series/${id}/edit`} variant="secondary" size="sm">Edit</ButtonLink>
            {s.status !== 'PUBLISHED' && (
              <ActionButton endpoint={`${base}/publish`} label="Publish" variant="primary"
                confirm={{ title: 'Publish this test series?', message: 'It will appear on the public catalog immediately.', confirmLabel: 'Publish' }} />
            )}
            {s.status === 'PUBLISHED' && (
              <ActionButton endpoint={`${base}/unpublish`} label="Unpublish"
                confirm={{ title: 'Unpublish?', message: 'It will be hidden from the catalog and students can no longer start it. Purchases, attempts and results are kept.' }} />
            )}
            {s.status !== 'ARCHIVED' && (
              <ActionButton endpoint={`${base}/archive`} label="Archive"
                confirm={{ title: 'Archive this test series?', message: 'Archived series are hidden from students. All history is preserved and you can republish later.' }} />
            )}
            {s.attempt_count === 0 && s.purchase_count === 0 && (
              <ActionButton endpoint={base} method="DELETE" label="Delete" variant="danger" redirectTo="/admin/test-series"
                confirm={{ title: 'Delete permanently?', message: 'This removes the test series and all of its questions. This cannot be undone.', danger: true, confirmLabel: 'Delete' }} />
            )}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Approved questions" value={s.question_count} hint={s.pending_count ? `${s.pending_count} drafts awaiting review` : undefined} />
        <Stat label="Attempts" value={s.attempt_count} />
        <Stat label="Sales" value={s.is_free ? '—' : s.purchase_count} />
        <Stat label="Revenue" value={s.is_free ? '—' : formatMoney(s.revenue, s.currency)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-sans text-sm font-semibold">Content</h2>
            <div className="flex gap-2">
              <ButtonLink href={`/admin/test-series/${id}/questions`} size="sm">Manage questions</ButtonLink>
              <ButtonLink href={`/admin/test-series/${id}/import`} size="sm" variant="secondary">Import</ButtonLink>
            </div>
          </div>
          {s.description && <p className="mt-4 text-sm text-ink-2">{s.description}</p>}
          {s.instructions && (
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">Instructions</div>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink-2">
                {s.instructions.split('\n').filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </div>
          )}
          {s.status === 'PUBLISHED' && (
            <Link href={`/test-series/${id}`} className="mt-6 inline-block text-sm font-medium text-brand-600 hover:underline">View on public site →</Link>
          )}
        </Card>
        <Card className="p-6">
          <h2 className="font-sans text-sm font-semibold">Activity</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {history.map((h) => (
              <li key={h.id}>
                <div className="font-medium text-ink">{h.action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</div>
                <div className="text-xs text-muted">{h.admin_name ?? 'System'} · {formatDateTime(h.created_at)}</div>
              </li>
            ))}
            {history.length === 0 && <li className="text-muted">No recorded changes yet.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
