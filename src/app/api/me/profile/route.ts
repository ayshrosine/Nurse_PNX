import { route, ok, readJson } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { profileUpdateSchema } from '@/lib/validation';
import { updateProfile } from '@/lib/server/profile';

/** PUT /api/me/profile — only the phone is editable; name/email are Google-managed. */
export const PUT = route(async (req) => {
  const user = await requireUser();
  return ok(await updateProfile(user, await readJson(req, profileUpdateSchema)));
});
