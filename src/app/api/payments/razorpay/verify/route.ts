import { z } from 'zod';
import { route, ok, readJson } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { verifyCheckout } from '@/lib/server/services/purchaseService';
import { rateLimit } from '@/lib/server/rateLimit';

const schema = z.object({
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i, 'Invalid signature'),
});

/** Only a valid HMAC signature turns a purchase into SUCCESS. The Checkout callback alone grants nothing. */
export const POST = route(async (req) => {
  const user = await requireUser();
  rateLimit('verify:' + user.id, 20, 60_000);
  const purchase = await verifyCheckout(user, await readJson(req, schema));
  return ok({ purchaseId: purchase.id, status: purchase.status, testSeriesId: purchase.test_series_id });
});
