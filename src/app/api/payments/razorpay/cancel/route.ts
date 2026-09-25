import { z } from 'zod';
import { route, ok, readJson } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { markAbandoned } from '@/lib/server/services/purchaseService';

const schema = z.object({
  orderId: z.string().min(1).max(100),
  reason: z.enum(['dismissed', 'failed']).default('dismissed'),
  description: z.string().max(500).optional(),
});

/** Client-reported checkout dismissal/failure. Can only downgrade the caller's own PENDING order. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson(req, schema);
  const row = await markAbandoned(user, body.orderId, body.reason === 'failed' ? 'FAILED' : 'CANCELLED', body.description);
  return ok({ status: row?.status ?? 'UNCHANGED' });
});
