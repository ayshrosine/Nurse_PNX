import { z } from 'zod';
import { route, ok, parseId, readJson } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { userDetail, setUserStatus } from '@/lib/server/services/adminService';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  return ok(await userDetail(parseId(params.id, 'User')));
});

/** Only account status can be changed here. Role is never writable through the API (PRD §28). */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const body = await readJson(req, z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) }).strict());
  return ok(await setUserStatus(admin, parseId(params.id, 'User'), body.status));
});
