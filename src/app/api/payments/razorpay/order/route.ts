import { z } from 'zod';
import { route, created, readJson } from '@/lib/server/http';
import { requireCompleteProfile } from '@/lib/server/session';
import { createCheckout } from '@/lib/server/services/purchaseService';
import { rateLimit } from '@/lib/server/rateLimit';
import { uuidSchema } from '@/lib/validation';

export const POST = route(async (req) => {
  const user = await requireCompleteProfile();
  rateLimit('order:' + user.id, 10, 60_000);
  const { testSeriesId } = await readJson(req, z.object({ testSeriesId: uuidSchema }));
  return created(await createCheckout(user, testSeriesId));
});
