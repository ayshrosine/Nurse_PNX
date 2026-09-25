import { route, ok, parseId } from '@/lib/server/http';
import { getCurrentUser } from '@/lib/server/session';
import { getPublished } from '@/lib/server/services/testSeriesService';
import { Errors } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const series = await getPublished(parseId(params.id, 'Test series'), await getCurrentUser());
  if (!series) throw Errors.notFound('Test series');
  return ok(series);
});
