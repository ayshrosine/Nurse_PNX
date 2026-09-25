import { route, ok, searchParams } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { listPurchases } from '@/lib/server/services/adminService';
import { paginationSchema, purchaseStatusSchema, uuidSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const filters = paginationSchema.extend({ status: purchaseStatusSchema.optional(), testSeriesId: uuidSchema.optional() });

export const GET = route(async (req) => {
  await requireAdmin();
  return ok(await listPurchases(filters.parse(searchParams(req))));
});
