import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, StatusBadge } from '@/components/ui';
import { AdminHeader } from '@/components/admin/shared';
import { purchaseDetail } from '@/lib/server/services/adminService';
import { formatDateTime, formatMoney, formatPhone } from '@/lib/format';
import { uuidSchema } from '@/lib/validation';

export const metadata = { title: 'Purchase' };

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const data = await purchaseDetail(id).catch(() => null);
  if (!data) notFound();
  const { purchase: p, events } = data;
  const rows: [string, React.ReactNode][] = [
    ['Student', <Link key="u" href={`/admin/users/${p.user_id}`} className="text-brand-600 hover:underline">{p.user_name}</Link>],
    ['Email', p.user_email],
    ['Phone', formatPhone(p.user_phone)],
    ['Test series', <Link key="t" href={`/admin/test-series/${p.test_series_id}`} className="text-brand-600 hover:underline">{p.test_title}</Link>],
    ['Amount charged', `${formatMoney(p.amount, p.currency)} (frozen at purchase time)`],
    ['Provider', p.provider],
    ['Order ID', <span key="o" className="font-mono text-xs">{p.order_id}</span>],
    ['Payment ID', <span key="p" className="font-mono text-xs">{p.payment_id ?? '—'}</span>],
    ['Status', <StatusBadge key="s" status={p.status} />],
    ['Failure reason', p.failure_reason ?? '—'],
    ['Created', formatDateTime(p.created_at)],
    ['Last updated', formatDateTime(p.updated_at)],
  ];
  return (
    <div className="max-w-3xl">
      <AdminHeader back={{ href: '/admin/purchases', label: 'Purchases' }} title="Purchase" description={p.order_id} />
      <Card className="p-6">
        <dl className="divide-y divide-line text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[160px_1fr] gap-4 py-2.5"><dt className="text-muted">{k}</dt><dd className="break-all">{v}</dd></div>
          ))}
        </dl>
      </Card>
      <h2 className="mb-3 mt-8 text-lg font-semibold">Verified webhook events</h2>
      <Card className="p-5 text-sm">
        {events.length === 0 ? <p className="text-muted">No webhook events recorded for this order.</p> : (
          <ul className="space-y-2">{events.map((e) => <li key={e.id} className="flex justify-between"><span className="font-mono text-xs">{e.event_type}</span><span className="text-muted">{formatDateTime(e.created_at)}</span></li>)}</ul>
        )}
      </Card>
    </div>
  );
}
