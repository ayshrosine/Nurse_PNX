import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Card, Container } from '@/components/ui';
import { Checkout } from '@/components/payments/Checkout';
import { requireStudentPage } from '@/lib/server/session';
import { getPublished } from '@/lib/server/services/testSeriesService';
import { razorpayConfigured } from '@/lib/server/razorpay';
import { formatPrice } from '@/lib/format';
import { uuidSchema } from '@/lib/validation';

export const metadata: Metadata = { title: 'Unlock test series' };
export const dynamic = 'force-dynamic';

export default async function UnlockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const user = await requireStudentPage(`/unlock/${id}`);
  const series = await getPublished(id, user);
  if (!series) notFound();
  if (series.has_access) redirect(`/test-series/${id}`);

  return (
    <Container className="flex justify-center py-12 sm:py-16">
      <Card className="w-full max-w-lg overflow-hidden">
        <div className="border-b border-line bg-sunken/60 p-6 sm:p-8">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Unlock</div>
          <h1 className="mt-2 text-2xl font-semibold leading-snug">{series.title}</h1>
          <p className="mt-2 text-sm text-muted">{series.question_count} questions · {series.duration_minutes} minutes · unlimited attempts</p>
        </div>
        <div className="p-6 sm:p-8">
          <div className="flex items-baseline justify-between">
            <span className="text-ink-2">Total</span>
            <span className="font-serif text-3xl font-semibold">{formatPrice(series.price, series.is_free, series.currency)}</span>
          </div>
          <ul className="mt-5 space-y-2 text-sm text-ink-2">
            <li>✓ Lifetime access to this test series</li>
            <li>✓ Detailed explanations for every question</li>
            <li>✓ Progress tracking on your dashboard</li>
          </ul>
          <div className="mt-7">
            <Checkout
              testSeriesId={series.id}
              configured={razorpayConfigured()}
              priceLabel={formatPrice(series.price, series.is_free, series.currency)}
            />
          </div>
          <p className="mt-6 text-xs leading-relaxed text-faint">
            Payments are processed by Razorpay (UPI, cards, net banking, wallets). Access is granted only after
            the payment is verified by our server. By paying you agree that digital test access is non-transferable.
            For payment issues, contact support with your order ID.
          </p>
        </div>
      </Card>
    </Container>
  );
}
