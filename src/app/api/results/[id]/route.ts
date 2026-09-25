import { route, ok, parseId } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { getResult } from '@/lib/server/services/attemptService';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  return ok(await getResult(user, parseId(params.id, 'Result')));
});
