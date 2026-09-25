import Link from 'next/link';
import { Badge, StatusBadge, Table, Td, Th } from '@/components/ui';
import { AdminHeader } from '@/components/admin/shared';
import { query } from '@/lib/server/db';

export const metadata = { title: 'Questions' };

/** Question bank overview across all test series, with drafts awaiting review surfaced first. */
export default async function QuestionsOverview() {
  const rows = await query<{ id: string; title: string; status: string; approved: number; pending: number; rejected: number }>(
    `SELECT ts.id, ts.title, ts.status,
            COUNT(q.id) FILTER (WHERE q.review_status = 'APPROVED')::int AS approved,
            COUNT(q.id) FILTER (WHERE q.review_status = 'PENDING_REVIEW')::int AS pending,
            COUNT(q.id) FILTER (WHERE q.review_status = 'REJECTED')::int AS rejected
       FROM test_series ts LEFT JOIN questions q ON q.test_series_id = ts.id
      GROUP BY ts.id
      ORDER BY COUNT(q.id) FILTER (WHERE q.review_status = 'PENDING_REVIEW') DESC, ts.created_at DESC`,
  );
  const total = rows.reduce((n, r) => n + r.approved, 0);
  return (
    <>
      <AdminHeader title="Questions" description={`${total} approved questions across ${rows.length} test series. Questions are managed inside each test series.`} />
      <Table>
        <thead><tr><Th>Test series</Th><Th>Status</Th><Th className="text-right">Approved</Th><Th className="text-right">Awaiting review</Th><Th className="text-right">Rejected</Th><Th /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-sunken/40">
              <Td className="font-medium text-ink">{r.title}</Td>
              <Td><StatusBadge status={r.status} /></Td>
              <Td className="text-right tabular-nums">{r.approved}</Td>
              <Td className="text-right">{r.pending ? <Badge tone="warn">{r.pending}</Badge> : <span className="text-faint">0</span>}</Td>
              <Td className="text-right tabular-nums text-muted">{r.rejected}</Td>
              <Td className="whitespace-nowrap text-right">
                {r.pending > 0 && <Link href={`/admin/test-series/${r.id}/import`} className="mr-3 text-sm font-medium text-warn hover:underline">Review drafts</Link>}
                <Link href={`/admin/test-series/${r.id}/questions`} className="text-sm font-medium text-brand-600 hover:underline">Manage</Link>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
