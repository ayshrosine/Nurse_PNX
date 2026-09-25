import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, Stat, StatusBadge, Table, Td, Th } from '@/components/ui';
import { AdminHeader } from '@/components/admin/shared';
import { ActionButton } from '@/components/admin/ActionButton';
import { userDetail } from '@/lib/server/services/adminService';
import { getCurrentUser } from '@/lib/server/session';
import { formatDate, formatDateTime, formatDuration, formatMoney, formatPercent, formatPhone } from '@/lib/format';
import { uuidSchema } from '@/lib/validation';

export const metadata = { title: 'User' };

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const detail = await userDetail(id).catch(() => null);
  if (!detail) notFound();
  const me = await getCurrentUser();
  const { user, purchases, attempts, progress } = detail;

  return (
    <>
      <AdminHeader
        back={{ href: '/admin/users', label: 'Users' }}
        title={user.name}
        description={user.email}
        actions={
          me?.id !== user.id && (
            user.status === 'ACTIVE' ? (
              <ActionButton endpoint={`/api/admin/users/${user.id}`} method="PATCH" body={{ status: 'SUSPENDED' }} label="Suspend account" variant="danger"
                confirm={{ title: 'Suspend this account?', message: 'The user is signed out on their next request and cannot sign in. Their purchases and results are kept.', danger: true, confirmLabel: 'Suspend' }} />
            ) : (
              <ActionButton endpoint={`/api/admin/users/${user.id}`} method="PATCH" body={{ status: 'ACTIVE' }} label="Reactivate account" variant="primary" />
            )
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="p-5">
          <h2 className="font-sans text-sm font-semibold">Identity</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Name" value={user.name} />
            <Row label="Email" value={user.email} />
            <Row label="Phone" value={formatPhone(user.phone)} />
            <Row label="Role" value={<StatusBadge status={user.role} />} />
            <Row label="Status" value={<StatusBadge status={user.status} />} />
            <Row label="Sign-in" value={user.google_id ? 'Google' : 'Not linked yet'} />
            <Row label="Registered" value={formatDateTime(user.created_at)} />
            <Row label="Last login" value={formatDateTime(user.last_login_at)} />
          </dl>
        </Card>
        <div className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Tests attempted" value={progress.tests_attempted} />
          <Stat label="Completed" value={progress.tests_completed} hint={`${progress.distinct_tests} different tests`} />
          <Stat label="Average score" value={formatPercent(progress.average_percentage)} />
          <Stat label="Best score" value={formatPercent(progress.best_percentage)} hint={`Accuracy ${formatPercent(progress.accuracy)}`} />
        </div>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Purchases</h2>
      <Table>
        <thead><tr><Th>Test</Th><Th>Amount</Th><Th>Status</Th><Th>Provider</Th><Th>Order ID</Th><Th>Date</Th></tr></thead>
        <tbody>
          {purchases.map((p) => (
            <tr key={p.id}>
              <Td><Link className="font-medium text-ink hover:text-brand-600" href={`/admin/purchases/${p.id}`}>{p.test_title}</Link></Td>
              <Td className="tabular-nums">{formatMoney(p.amount, p.currency)}</Td>
              <Td><StatusBadge status={p.status} /></Td>
              <Td>{p.provider}</Td>
              <Td className="font-mono text-xs">{p.order_id}</Td>
              <Td>{formatDate(p.created_at)}</Td>
            </tr>
          ))}
          {purchases.length === 0 && <tr><Td colSpan={6} className="py-8 text-center text-muted">No purchases</Td></tr>}
        </tbody>
      </Table>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Attempts</h2>
      <Table>
        <thead><tr><Th>Test</Th><Th>Date</Th><Th>Score</Th><Th>Percentage</Th><Th>Time</Th><Th>Status</Th></tr></thead>
        <tbody>
          {attempts.map((a) => (
            <tr key={a.id}>
              <Td><Link className="font-medium text-ink hover:text-brand-600" href={`/admin/attempts/${a.id}`}>{a.test_title}</Link></Td>
              <Td>{formatDateTime(a.started_at)}</Td>
              <Td className="tabular-nums">{a.score !== null ? `${a.score}/${a.total_questions}` : '—'}</Td>
              <Td className="tabular-nums">{formatPercent(a.percentage)}</Td>
              <Td>{formatDuration(a.time_taken_seconds)}</Td>
              <Td><StatusBadge status={a.status} /></Td>
            </tr>
          ))}
          {attempts.length === 0 && <tr><Td colSpan={6} className="py-8 text-center text-muted">No attempts</Td></tr>}
        </tbody>
      </Table>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium break-all">{value}</dd>
    </div>
  );
}
