import { route, ok } from '@/lib/server/http';
import { getCurrentUser } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

/** GET /api/auth/me — the signed-in user as the server sees it, or null. */
export const GET = route(async () => {
  const user = await getCurrentUser();
  return ok(user ? { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, profileComplete: Boolean(user.phone) } : null);
});
