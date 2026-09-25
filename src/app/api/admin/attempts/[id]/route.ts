import { route, ok, parseId } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { getResult } from '@/lib/server/services/attemptService';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const admin = await requireAdmin();
  return ok(await getResult(admin, parseId(params.id, 'Attempt')));
});
