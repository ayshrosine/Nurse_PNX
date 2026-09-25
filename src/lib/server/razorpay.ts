import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError } from '../errors';

// Thin Razorpay REST client (https://razorpay.com/docs/api/). Only the server ever holds the key secret.

export function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function config() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new ApiError(503, 'NOT_CONFIGURED', 'Online payments are not configured yet. Please try again later.');
  }
  // RAZORPAY_API_BASE exists so automated tests can point at a local stub; production uses the default.
  const base = process.env.RAZORPAY_API_BASE || 'https://api.razorpay.com/v1';
  return { keyId, keySecret, base };
}

export function publicKeyId() {
  return config().keyId;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

/** Amounts are in the smallest currency unit (paise). */
export async function createOrder(input: {
  amountPaise: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrder> {
  const { keyId, keySecret, base } = config();
  let res: Response;
  try {
    res = await fetch(`${base}/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: input.amountPaise, currency: input.currency, receipt: input.receipt, notes: input.notes }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.error('[razorpay] order request failed', err);
    throw new ApiError(502, 'UPSTREAM_ERROR', 'Could not reach the payment provider. Please try again.');
  }
  if (!res.ok) {
    console.error('[razorpay] order creation failed', res.status, await res.text().catch(() => ''));
    throw new ApiError(502, 'UPSTREAM_ERROR', 'The payment provider rejected the order. Please try again.');
  }
  return (await res.json()) as RazorpayOrder;
}

function safeEqualHex(expected: string, actual: string) {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(actual, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Checkout signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string) {
  const { keySecret } = config();
  const expected = createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqualHex(expected, signature);
}

/** Webhook signature: HMAC_SHA256(raw request body, webhook_secret). */
export function verifyWebhookSignature(rawBody: string, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new ApiError(503, 'NOT_CONFIGURED', 'Webhook secret is not configured');
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqualHex(expected, signature);
}
