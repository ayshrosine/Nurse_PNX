import { redirect } from 'next/navigation';
import { getCurrentUser, safeNext } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

/**
 * Post-login router (PRD §5.2): decided server-side from the database, not client state.
 * Not signed in → /login; phone missing → /complete-profile; admin → /admin (unless a target was given); else → next.
 */
export default async function ContinuePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: rawNext } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  
  if (user.role === 'ADMIN') {
    redirect('/admin');
  }

  const next = safeNext(rawNext, '/dashboard');
  if (!user.phone) redirect(`/complete-profile?next=${encodeURIComponent(next)}`);
  
  redirect(next);
}
