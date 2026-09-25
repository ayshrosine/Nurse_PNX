import Link from 'next/link';
import { StatusBadge, Table, Td, Th } from '@/components/ui';
import { AdminHeader, FilterBar, Pagination, filterInput, parsePage } from '@/components/admin/shared';
import { listAttempts } from '@/lib/server/services/adminService';
import { formatDateTime, formatDuration, formatPercent } from '@/lib/format';

export const metadata = { title: 'Attempts' };

const STATUSES = ['IN_PROGRESS', 'COMPLETED', 'ABANDONED'];

export default async function AttemptsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const data = await listAttempts({
    page: parsePage(sp.page),
    pageSize: 25,
    q: sp.q?.slice(0, 200) || undefined,
    status: STATUSES.includes(sp.status ?? '') ? sp.status : undefined,
  });
  return (
    <>
      <AdminHeader title="Attempts" description="Every test attempt, scored server-side." />
      <FilterBar action="/admin/attempts">
        <input name="q" defaultValue={sp.q} placeholder="Student, email or test" className={`${filterInput} w-64`} aria-label="Search" />
        <select name="status" defaultValue={sp.status ?? ''} className={filterInput} aria-label="Status">
          <option value="">All statuses</option><option value="COMPLETED">Completed</option><option value="IN_PROGRESS">In progress</option><option value="ABANDONED">Abandoned</option>
        </select>
      </FilterBar>
      <Table>
        <thead><tr><Th>Student</Th><Th>Test</Th><Th>Date</Th><Th className="text-right">Score</Th><Th className="text-right">%</Th><Th className="text-right">✓ / ✕ / —</Th><Th>Time</Th><Th>Status</Th></tr></thead>
        <tbody>
          {data.items.map((a) => (
            <tr key={a.id} className="hover:bg-sunken/40">
              <Td>
                <Link href={`/admin/attempts/${a.id}`} className="font-medium text-ink hover:text-brand-600">{a.user_name}</Link>
                <div className="text-xs text-muted">{a.user_email}</div>
              </Td>
              <Td>{a.test_title}</Td>
              <Td className="whitespace-nowrap">{formatDateTime(a.started_at)}</Td>
              <Td className="text-right tabular-nums">{a.score !== null ? `${a.score}/${a.total_questions}` : '—'}</Td>
              <Td className="text-right tabular-nums">{formatPercent(a.percentage)}</Td>
              <Td className="text-right tabular-nums text-muted">{a.status === 'COMPLETED' ? `${a.correct_answers} / ${a.incorrect_answers} / ${a.unanswered}` : '—'}</Td>
              <Td>{formatDuration(a.time_taken_seconds)}</Td>
              <Td><StatusBadge status={a.status} /></Td>
            </tr>
          ))}
          {data.items.length === 0 && <tr><Td colSpan={8} className="py-10 text-center text-muted">No attempts match these filters.</Td></tr>}
        </tbody>
      </Table>
      <Pagination base="/admin/attempts" params={sp} page={data.page} totalPages={data.totalPages} total={data.total} />
    </>
  );
}
