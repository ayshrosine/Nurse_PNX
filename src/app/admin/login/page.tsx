import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui';
import { LoginPanel } from '@/components/auth/LoginPanel';
import { LogoMark } from '@/components/navigation/Logo';
import { devLoginEnabled, googleConfigured } from '@/lib/server/auth';
import { getCurrentUser } from '@/lib/server/session';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Admin login' };

/**
 * Admin entry point (PRD §6.1). Visiting this URL grants nothing: after sign-in, /admin re-checks role = ADMIN
 * in Postgres and students are bounced back here with an error.
 */
export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const user = await getCurrentUser();
  if (user?.role === 'ADMIN') redirect('/admin');

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-800 px-4">
      <Card className="w-full max-w-md p-8 sm:p-10">
        <div className="flex items-center gap-3">
          <LogoMark className="size-9" />
          <div>
            <div className="font-serif text-lg font-semibold leading-tight">Nursing Level Up</div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted">Admin console</div>
          </div>
        </div>
        <h1 className="mt-8 text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted">Only accounts with the admin role can continue.</p>
        {user && !error && (
          <p className="mt-4 rounded-lg bg-warn-50 p-3 text-sm text-warn">
            You’re signed in as {user.email}, which is not an admin account.
          </p>
        )}
        <div className="mt-6">
          <LoginPanel next="/admin" admin googleConfigured={googleConfigured} devLoginEnabled={devLoginEnabled} error={error} />
        </div>
        <Link href="/" className="mt-8 block text-center text-sm text-muted hover:text-brand-600">← Back to the student site</Link>
      </Card>
    </div>
  );
}
