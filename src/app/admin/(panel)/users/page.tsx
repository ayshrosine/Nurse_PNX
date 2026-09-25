import Link from 'next/link';
import { StatusBadge, Table, Td, Th, Badge } from '@/components/ui';
import { AdminHeader, FilterBar, Pagination, filterInput, parsePage } from '@/components/admin/shared';
import { listUsers } from '@/lib/server/services/adminService';
import { formatDate, formatDateTime, formatPhone } from '@/lib/format';

export const metadata = { title: 'Users' };

type SP = { q?: string; role?: string; status?: string; profile?: string; page?: string };

export default async function UsersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const data = await listUsers({
    page: parsePage(sp.page),
    pageSize: 20,
    q: sp.q?.slice(0, 200) || undefined,
    role: sp.role === 'ADMIN' || sp.role === 'STUDENT' ? sp.role : undefined,
    status: sp.status === 'ACTIVE' || sp.status === 'SUSPENDED' ? sp.status : undefined,
    profile: sp.profile === 'complete' || sp.profile === 'incomplete' ? sp.profile : undefined,
  });

  return (
    <>
      <AdminHeader title="Users" description="Students and administrators registered on the platform." />
      <FilterBar action="/admin/users">
        <input name="q" defaultValue={sp.q} placeholder="Search name, email or phone" className={`${filterInput} w-64`} aria-label="Search" />
        <select name="role" defaultValue={sp.role ?? ''} className={filterInput} aria-label="Role">
          <option value="">All roles</option><option value="STUDENT">Students</option><option value="ADMIN">Admins</option>
        </select>
        <select name="status" defaultValue={sp.status ?? ''} className={filterInput} aria-label="Status">
          <option value="">Any status</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option>
        </select>
        <select name="profile" defaultValue={sp.profile ?? ''} className={filterInput} aria-label="Profile">
          <option value="">Any profile</option><option value="complete">Phone added</option><option value="incomplete">Phone missing</option>
        </select>
      </FilterBar>
      <Table>
        <thead>
          <tr><Th>Name</Th><Th>Phone</Th><Th>Role</Th><Th>Registered</Th><Th>Last activity</Th><Th className="text-right">Attempts</Th><Th className="text-right">Purchases</Th><Th>Status</Th></tr>
        </thead>
        <tbody>
          {data.items.map((u) => (
            <tr key={u.id} className="hover:bg-sunken/40">
              <Td>
                <Link href={`/admin/users/${u.id}`} className="font-medium text-ink hover:text-brand-600">{u.name}</Link>
                <div className="text-xs text-muted">{u.email}</div>
              </Td>
              <Td>{u.phone ? formatPhone(u.phone) : <Badge tone="warn">Missing</Badge>}</Td>
              <Td><StatusBadge status={u.role} /></Td>
              <Td>{formatDate(u.created_at)}</Td>
              <Td>{formatDateTime(u.last_activity_at)}</Td>
              <Td className="text-right tabular-nums">{u.attempt_count}</Td>
              <Td className="text-right tabular-nums">{u.purchase_count}</Td>
              <Td><StatusBadge status={u.status} /></Td>
            </tr>
          ))}
          {data.items.length === 0 && <tr><Td colSpan={8} className="py-10 text-center text-muted">No users match these filters.</Td></tr>}
        </tbody>
      </Table>
      <Pagination base="/admin/users" params={sp} page={data.page} totalPages={data.totalPages} total={data.total} />
    </>
  );
}
