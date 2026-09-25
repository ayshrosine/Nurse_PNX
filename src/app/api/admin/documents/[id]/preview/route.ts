import { route, ok, parseId } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { preview } from '@/lib/server/services/documentService';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  return ok(await preview(parseId(params.id, 'Document')));
});
