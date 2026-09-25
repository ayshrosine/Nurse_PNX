'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, ButtonLink } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';

interface CheckoutOrder {
  purchase: { id: string };
  razorpay: { keyId: string; orderId: string; amount: number; currency: string };
  prefill: { name: string; email: string; contact: string | null };
  test: { id: string; title: string };
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', cb: (res: { error: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('Could not load Razorpay. Check your connection or disable ad blockers.')));
    if (!existing) {
      script.src = SCRIPT;
      script.async = true;
      document.body.appendChild(script);
    }
  });
}

type Phase = 'idle' | 'creating' | 'paying' | 'verifying' | 'success';

/**
 * Razorpay Checkout (Frontend doc §8). The Checkout success callback is NOT trusted: access is granted only
 * when POST /api/payments/razorpay/verify confirms the HMAC signature server-side.
 */
export function Checkout({ testSeriesId, configured, priceLabel }: { testSeriesId: string; configured: boolean; priceLabel: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  async function pay() {
    setError(null);
    setPhase('creating');
    try {
      const [order] = await Promise.all([
        api<CheckoutOrder>('/api/payments/razorpay/order', { method: 'POST', json: { testSeriesId } }),
        loadRazorpay(),
      ]);
      setOrderId(order.razorpay.orderId);
      const rzp = new window.Razorpay!({
        key: order.razorpay.keyId,
        order_id: order.razorpay.orderId,
        amount: order.razorpay.amount,
        currency: order.razorpay.currency,
        name: 'Nursing Level Up',
        description: order.test.title,
        prefill: { name: order.prefill.name, email: order.prefill.email, contact: order.prefill.contact ?? undefined },
        notes: { test_series_id: order.test.id },
        theme: { color: '#17655f' },
        handler: async (response: RazorpayResponse) => {
          setPhase('verifying');
          try {
            await api('/api/payments/razorpay/verify', { method: 'POST', json: response });
            setPhase('success');
            router.refresh();
          } catch (err) {
            setPhase('idle');
            setError(`${errorMessage(err)}. If money was deducted, access will be granted automatically once Razorpay confirms the payment.`);
          }
        },
        modal: {
          ondismiss: () => {
            setPhase((p) => (p === 'paying' ? 'idle' : p));
            api('/api/payments/razorpay/cancel', { method: 'POST', json: { orderId: order.razorpay.orderId, reason: 'dismissed' } }).catch(() => {});
          },
        },
      });
      rzp.on('payment.failed', (res) => {
        setError(res.error?.description ?? 'The payment failed. You can try again.');
      });
      setPhase('paying');
      rzp.open();
    } catch (err) {
      setPhase('idle');
      setError(errorMessage(err));
    }
  }

  if (phase === 'success') {
    return (
      <div className="space-y-4">
        <Alert tone="ok" title="Payment verified — access granted">
          Your test series is unlocked. Good luck!
        </Alert>
        <ButtonLink href={`/tests/${testSeriesId}`} size="lg" className="w-full">Start Test</ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!configured && (
        <Alert tone="warn" title="Payments are not available yet">
          Online payments haven’t been configured on this server. Please try again later.
        </Alert>
      )}
      {error && <Alert title="Payment not completed">{error}</Alert>}
      <Button size="lg" className="w-full" onClick={pay} disabled={!configured} loading={phase === 'creating' || phase === 'verifying' || phase === 'paying'}>
        {phase === 'verifying' ? 'Verifying payment…' : phase === 'paying' ? 'Complete payment in Razorpay…' : `Pay ${priceLabel}`}
      </Button>
      {orderId && <p className="text-center text-xs text-faint">Order ID: {orderId}</p>}
      <p className="text-center text-sm">
        <Link href={`/test-series/${testSeriesId}`} className="text-muted hover:text-brand-600">← Back to test details</Link>
      </p>
    </div>
  );
}
