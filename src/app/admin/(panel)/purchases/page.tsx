import Link from 'next/link';
import { StatusBadge, Table, Td, Th } from '@/components/ui';
import { AdminHeader, FilterBar, Pagination, filterInput, parsePage } from '@/components/admin/shared';
import { listPurchases } from '@/lib/server/services/adminService';
import { formatDateTime, formatMoney } from '@/lib/format';

export const metadata = { title: 'Purchases' };

const STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED'];

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const data = await listPurchases({
    page: parsePage(sp.page),
    pageSize: 25,
    q: sp.q?.slice(0, 200) || undefined,
    status: STATUSES.includes(sp.status ?? '') ? sp.status : undefined,
  });
  return (
    <>
      <AdminHeader title="Purchases" description={`Revenue for this view: ${formatMoney(data.summary.revenue)} (successful payments only).`} />
      <FilterBar action="/admin/purchases">
        <input name="q" defaultValue={sp.q} placeholder="Student, email, order or payment ID" className={`${filterInput} w-72`} aria-label="Search" />
        <select name="status" defaultValue={sp.status ?? ''} className={filterInput} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
        </select>
      </FilterBar>
      <Table>
        <thead><tr><Th>Student</Th><Th>Test</Th><Th className="text-right">Amount</Th><Th>Provider</Th><Th>Order / Payment</Th><Th>Status</Th><Th>Date</Th></tr></thead>
        <tbody>
          {data.items.map((p) => (
            <tr key={p.id} className="hover:bg-sunken/40">
              <Td>
                <Link href={`/admin/purchases/${p.id}`} className="font-medium text-ink hover:text-brand-600">{p.user_name}</Link>
                <div className="text-xs text-muted">{p.user_email}</div>
              </Td>
              <Td>{p.test_title}</Td>
              <Td className="text-right tabular-nums">{formatMoney(p.amount, p.currency)}</Td>
              <Td>{p.provider}</Td>
              <Td className="font-mono text-xs"><div>{p.order_id}</div><div className="text-muted">{p.payment_id ?? '—'}</div></Td>
              <Td><StatusBadge status={p.status} /></Td>
              <Td className="whitespace-nowrap">{formatDateTime(p.created_at)}</Td>
            </tr>
          ))}
          {data.items.length === 0 && <tr><Td colSpan={7} className="py-10 text-center text-muted">No purchases match these filters.</Td></tr>}
        </tbody>
      </Table>
      <Pagination base="/admin/purchases" params={sp} page={data.page} totalPages={data.totalPages} total={data.total} />
    </>
  );
}
