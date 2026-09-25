import type { Metadata } from 'next';
import { requireAdminPage } from '@/lib/server/session';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Admin · Nursing Level Up' } };
export const dynamic = 'force-dynamic';

/** Every admin page renders only after the role is re-checked in Postgres (Frontend doc §13). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[240px_1fr]">
      <AdminSidebar name={admin.name} email={admin.email} />
      <div className="min-w-0">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
