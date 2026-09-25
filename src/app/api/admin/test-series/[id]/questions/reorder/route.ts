import { route, ok, parseId, readJson } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { reorder } from '@/lib/server/services/questionService';
import { reorderSchema } from '@/lib/validation';

export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { questionIds } = await readJson(req, reorderSchema);
  await reorder(parseId(params.id, 'Test series'), questionIds, admin);
  return ok({ reordered: questionIds.length });
});
