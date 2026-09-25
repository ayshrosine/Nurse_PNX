import { route, ok, readJson } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { profileUpdateSchema } from '@/lib/validation';
import { updateProfile } from '@/lib/server/profile';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const user = await requireUser();
  return ok({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, created_at: user.created_at });
});

export const PUT = route(async (req) => {
  const user = await requireUser();
  return ok(await updateProfile(user, await readJson(req, profileUpdateSchema)));
});
