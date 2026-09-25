import { route, ok, parseId } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { getForUser } from '@/lib/server/services/purchaseService';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  return ok(await getForUser(user, parseId(params.id, 'Purchase')));
});
