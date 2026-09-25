import { createHash } from 'node:crypto';
import { toErrorResponse, ApiError } from '@/lib/errors';
import { verifyWebhookSignature } from '@/lib/server/razorpay';
import { handleWebhook } from '@/lib/server/services/purchaseService';

/**
 * Razorpay → server webhook. No session: authenticity comes from the HMAC signature over the raw body,
 * verified with RAZORPAY_WEBHOOK_SECRET. Configure events: payment.captured, payment.failed, order.paid, refund.processed.
 */
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    if (raw.length > 1_000_000) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Payload too large');
    const signature = req.headers.get('x-razorpay-signature') ?? '';
    if (!signature || !verifyWebhookSignature(raw, signature)) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Invalid webhook signature');
    }
    const body = JSON.parse(raw);
    // Razorpay sends x-razorpay-event-id; fall back to a hash of the body for idempotency.
    const eventId = req.headers.get('x-razorpay-event-id') || createHash('sha256').update(raw).digest('hex');
    const result = await handleWebhook(eventId, body);
    return Response.json({ success: true, data: result });
  } catch (err) {
    return toErrorResponse(err);
  }
}
