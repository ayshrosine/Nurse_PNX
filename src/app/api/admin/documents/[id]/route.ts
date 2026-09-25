import { route, ok, parseId } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { getWithPreview, remove } from '@/lib/server/services/documentService';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  return ok(await getWithPreview(parseId(params.id, 'Document')));
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const admin = await requireAdmin();
  await remove(admin, parseId(params.id, 'Document'));
  return ok({ deleted: true });
});
