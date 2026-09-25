import type { Metadata } from 'next';
import { Card, Container, PageHeader, Badge } from '@/components/ui';
import { PhoneForm } from '@/components/auth/PhoneForm';
import { requireUserPage } from '@/lib/server/session';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const user = await requireUserPage('/profile');
  return (
    <Container className="max-w-3xl py-12">
      <PageHeader title="Your profile" description="Your name and email come from your Google account." />
      <div className="grid gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Account</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">Name</dt><dd className="mt-1 font-medium">{user.name}</dd></div>
            <div><dt className="text-muted">Email</dt><dd className="mt-1 font-medium break-all">{user.email}</dd></div>
            <div><dt className="text-muted">Member since</dt><dd className="mt-1 font-medium">{formatDate(user.created_at)}</dd></div>
            <div><dt className="text-muted">Sign-in</dt><dd className="mt-1"><Badge tone="brand">{user.google_id ? 'Google' : 'Email'}</Badge></dd></div>
          </dl>
          <p className="mt-4 text-xs text-faint">To change your name or email, update your Google account.</p>
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Phone number</h2>
          <div className="mt-4 max-w-sm"><PhoneForm initial={user.phone} submitLabel="Update phone" /></div>
        </Card>
      </div>
    </Container>
  );
}
