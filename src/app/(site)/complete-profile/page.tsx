import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, Container } from '@/components/ui';
import { PhoneForm } from '@/components/auth/PhoneForm';
import { requireUserPage, safeNext } from '@/lib/server/session';

export const metadata: Metadata = { title: 'Complete your profile' };

export default async function CompleteProfilePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  const user = await requireUserPage('/complete-profile');
  if (user.phone) redirect(next);

  return (
    <Container className="flex justify-center py-16 sm:py-24">
      <div className="w-full max-w-md animate-slide-up">
        {/* Progress stepper */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">✓</span>
            <span className="text-sm font-medium text-brand-600">Sign in</span>
          </div>
          <div className="h-px w-10 bg-brand-200" aria-hidden="true" />
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">2</span>
            <span className="text-sm font-medium text-brand-600">Profile</span>
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-line bg-sunken/40 px-8 py-6">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">One last step</div>
            <h1 className="mt-2 text-2xl font-semibold">Complete your profile</h1>
            <p className="mt-2 text-sm text-muted">Add your mobile number so we can reach you about your purchases and results.</p>
          </div>
          <div className="p-8">
            <dl className="space-y-3 rounded-xl bg-sunken/60 p-4 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted">Name</dt><dd className="truncate font-medium">{user.name}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Email</dt><dd className="truncate font-medium">{user.email}</dd></div>
            </dl>
            <div className="mt-6"><PhoneForm next={next} /></div>
          </div>
        </Card>
      </div>
    </Container>
  );
}
