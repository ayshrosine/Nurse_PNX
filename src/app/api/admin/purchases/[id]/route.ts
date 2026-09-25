import { route, ok, parseId } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { purchaseDetail } from '@/lib/server/services/adminService';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  return ok(await purchaseDetail(parseId(params.id, 'Purchase')));
});
