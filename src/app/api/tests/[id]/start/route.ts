import { route, ok, parseId } from '@/lib/server/http';
import { requireCompleteProfile } from '@/lib/server/session';
import { start } from '@/lib/server/services/attemptService';
import { rateLimit } from '@/lib/server/rateLimit';

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireCompleteProfile();
  rateLimit('start:' + user.id, 30, 60_000);
  return ok(await start(user, parseId(params.id, 'Test')));
});
