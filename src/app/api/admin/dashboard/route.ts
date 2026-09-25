import { route, ok } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { dashboard } from '@/lib/server/services/adminService';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requireAdmin();
  return ok(await dashboard());
});
