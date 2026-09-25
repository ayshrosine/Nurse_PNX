import Link from 'next/link';
import { Card, Stat, StatusBadge } from '@/components/ui';
import { AdminHeader } from '@/components/admin/shared';
import { dashboard } from '@/lib/server/services/adminService';
import { formatDate, formatDateTime, formatMoney, formatPercent } from '@/lib/format';

export const metadata = { title: 'Dashboard' };

export default async function AdminDashboard() {
  const { stats, recentUsers, recentPurchases, recentAttempts } = await dashboard();
  return (
    <>
      <AdminHeader title="Dashboard" description="Platform overview. Revenue counts successful purchases only." />
      {stats.pending_review > 0 && (
        <Link href="/admin/questions" className="mb-6 block rounded-card border border-warn/30 bg-warn-50 px-4 py-3 text-sm text-warn hover:brightness-[0.98]">
          <strong>{stats.pending_review}</strong> AI-generated question{stats.pending_review === 1 ? '' : 's'} awaiting review →
        </Link>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Students" value={stats.total_students} hint={`+${stats.new_students_7d} in the last 7 days`} />
        <Stat label="Revenue" value={formatMoney(stats.revenue)} hint={`${stats.successful_purchases} successful of ${stats.total_purchases} purchases`} />
        <Stat label="Attempts" value={stats.total_attempts} hint={`${stats.completed_attempts} completed · avg ${formatPercent(stats.average_percentage)}`} />
        <Stat label="Test series" value={stats.total_test_series} hint={`${stats.published_tests} published · ${stats.paid_tests} paid`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="p-5">
          <PanelTitle title="Recent registrations" href="/admin/users" />
          <ul className="divide-y divide-line text-sm">
            {recentUsers.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/admin/users/${u.id}`} className="min-w-0">
                  <div className="truncate font-medium text-ink hover:text-brand-600">{u.name}</div>
                  <div className="truncate text-xs text-muted">{u.email}</div>
                </Link>
                <span className="shrink-0 text-xs text-muted">{formatDate(u.created_at)}</span>
              </li>
            ))}
            {recentUsers.length === 0 && <li className="py-6 text-center text-muted">No students yet</li>}
          </ul>
        </Card>
        <Card className="p-5">
          <PanelTitle title="Recent purchases" href="/admin/purchases" />
          <ul className="divide-y divide-line text-sm">
            {recentPurchases.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/admin/purchases/${p.id}`} className="min-w-0">
                  <div className="truncate font-medium text-ink hover:text-brand-600">{p.user_name}</div>
                  <div className="truncate text-xs text-muted">{p.test_title}</div>
                </Link>
                <div className="shrink-0 text-right">
                  <div className="tabular-nums">{formatMoney(p.amount, p.currency)}</div>
                  <StatusBadge status={p.status} />
                </div>
              </li>
            ))}
            {recentPurchases.length === 0 && <li className="py-6 text-center text-muted">No purchases yet</li>}
          </ul>
        </Card>
        <Card className="p-5">
          <PanelTitle title="Recent attempts" href="/admin/attempts" />
          <ul className="divide-y divide-line text-sm">
            {recentAttempts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/admin/attempts/${a.id}`} className="min-w-0">
                  <div className="truncate font-medium text-ink hover:text-brand-600">{a.user_name}</div>
                  <div className="truncate text-xs text-muted">{a.test_title} · {formatDateTime(a.started_at)}</div>
                </Link>
                <div className="shrink-0">{a.status === 'COMPLETED' ? <span className="tabular-nums">{formatPercent(a.percentage)}</span> : <StatusBadge status={a.status} />}</div>
              </li>
            ))}
            {recentAttempts.length === 0 && <li className="py-6 text-center text-muted">No attempts yet</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}

function PanelTitle({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="font-sans text-sm font-semibold">{title}</h2>
      <Link href={href} className="text-xs font-medium text-brand-600 hover:underline">View all</Link>
    </div>
  );
}
