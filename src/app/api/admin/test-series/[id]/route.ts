import { route, ok, parseId, readJson } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import * as svc from '@/lib/server/services/testSeriesService';
import { testSeriesInputSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  return ok(await svc.adminGet(parseId(params.id, 'Test series')));
});

export const PUT = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const id = parseId(params.id, 'Test series');
  await svc.update(id, await readJson(req, testSeriesInputSchema), admin);
  return ok(await svc.adminGet(id));
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const admin = await requireAdmin();
  await svc.remove(parseId(params.id, 'Test series'), admin);
  return ok({ deleted: true });
});
