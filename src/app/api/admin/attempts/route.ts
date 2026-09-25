import { route, ok, searchParams } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { listAttempts } from '@/lib/server/services/adminService';
import { attemptStatusSchema, paginationSchema, uuidSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const filters = paginationSchema.extend({
  status: attemptStatusSchema.optional(),
  testSeriesId: uuidSchema.optional(),
  userId: uuidSchema.optional(),
});

export const GET = route(async (req) => {
  await requireAdmin();
  return ok(await listAttempts(filters.parse(searchParams(req))));
});
