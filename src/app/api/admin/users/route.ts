import { z } from 'zod';
import { route, ok, searchParams } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { listUsers } from '@/lib/server/services/adminService';
import { paginationSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const filters = paginationSchema.extend({
  role: z.enum(['STUDENT', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  profile: z.enum(['complete', 'incomplete']).optional(),
});

export const GET = route(async (req) => {
  await requireAdmin();
  return ok(await listUsers(filters.parse(searchParams(req))));
});
