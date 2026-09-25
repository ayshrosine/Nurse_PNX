import { route, ok, parseId } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import * as svc from '@/lib/server/services/testSeriesService';

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const admin = await requireAdmin();
  const id = parseId(params.id, 'Test series');
  await svc.setStatus(id, 'PUBLISHED', admin);
  return ok(await svc.adminGet(id));
});
