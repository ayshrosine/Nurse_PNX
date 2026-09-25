import type { NextRequest } from 'next/server';
import { signIn } from '@/lib/server/auth';
import { safeNext } from '@/lib/server/session';

/** GET /api/auth/google?next=/path — starts Google OAuth (PRD §12). */
export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get('next'));
  await signIn('google', { redirectTo: '/auth/continue?next=' + encodeURIComponent(next) });
}
