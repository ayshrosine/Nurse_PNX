import Link from 'next/link';
import { ButtonLink, StatusBadge, Table, Td, Th } from '@/components/ui';
import { AdminHeader, FilterBar, Pagination, filterInput, parsePage } from '@/components/admin/shared';
import { adminList } from '@/lib/server/services/testSeriesService';
import { formatDate, formatPrice } from '@/lib/format';
import type { TestStatus } from '@/types';

export const metadata = { title: 'Test Series' };

export default async function AdminTestSeriesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const status = ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(sp.status ?? '') ? (sp.status as TestStatus) : undefined;
  const data = await adminList({ page: parsePage(sp.page), pageSize: 20, q: sp.q?.slice(0, 200) || undefined, status });

  return (
    <>
      <AdminHeader
        title="Test series"
        description="Create a draft, add or import questions, then publish. Published series appear on the site immediately."
        actions={<ButtonLink href="/admin/test-series/create">New test series</ButtonLink>}
      />
      <FilterBar action="/admin/test-series">
        <input name="q" defaultValue={sp.q} placeholder="Search title" className={`${filterInput} w-64`} aria-label="Search" />
        <select name="status" defaultValue={sp.status ?? ''} className={filterInput} aria-label="Status">
          <option value="">All statuses</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option>
        </select>
      </FilterBar>
      <Table>
        <thead>
          <tr><Th>Title</Th><Th>Price</Th><Th className="text-right">Questions</Th><Th className="text-right">Attempts</Th><Th className="text-right">Sales</Th><Th>Status</Th><Th>Created</Th><Th /></tr>
        </thead>
        <tbody>
          {data.items.map((s) => (
            <tr key={s.id} className="hover:bg-sunken/40">
              <Td><Link href={`/admin/test-series/${s.id}`} className="font-medium text-ink hover:text-brand-600">{s.title}</Link></Td>
              <Td>{formatPrice(s.price, s.is_free, s.currency)}</Td>
              <Td className="text-right tabular-nums">{s.question_count}</Td>
              <Td className="text-right tabular-nums">{s.attempt_count}</Td>
              <Td className="text-right tabular-nums">{s.is_free ? '—' : s.purchase_count}</Td>
              <Td><StatusBadge status={s.status} /></Td>
              <Td>{formatDate(s.created_at)}</Td>
              <Td className="whitespace-nowrap text-right">
                <Link href={`/admin/test-series/${s.id}/questions`} className="text-sm font-medium text-brand-600 hover:underline">Questions</Link>
                <span className="mx-2 text-line-strong">|</span>
                <Link href={`/admin/test-series/${s.id}/edit`} className="text-sm font-medium text-brand-600 hover:underline">Edit</Link>
              </Td>
            </tr>
          ))}
          {data.items.length === 0 && <tr><Td colSpan={8} className="py-10 text-center text-muted">No test series found.</Td></tr>}
        </tbody>
      </Table>
      <Pagination base="/admin/test-series" params={sp} page={data.page} totalPages={data.totalPages} total={data.total} />
    </>
  );
}
