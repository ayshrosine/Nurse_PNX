import type { Metadata } from 'next';
import { ButtonLink, Card, Container } from '@/components/ui';
import { listActiveProducts } from '@/lib/server/services/productService';
import { getCurrentUser } from '@/lib/server/session';

export const metadata: Metadata = { title: 'Packs & Pricing' };
export const dynamic = 'force-dynamic';

export default async function PacksPage() {
  const user = await getCurrentUser();
  const products = await listActiveProducts();

  return (
    <Container className="py-12 lg:py-16">
      <div className="animate-slide-up text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-200/60 bg-brand-50/60 px-4 py-1.5 text-xs font-medium text-brand-700">
          💰 Pricing
        </div>
        <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">Choose Your Pack</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          Start free, upgrade when you&apos;re ready. All packs include detailed explanations and progress tracking.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p, i) => {
          const price = p.price_paise / 100;
          const mrp = p.mrp_paise / 100;
          const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
          const isPopular = i === 1; // middle plan highlighted

          return (
            <Card
              key={p.id}
              className={`animate-slide-up stagger-${i + 1} relative flex flex-col p-0 ${isPopular ? 'ring-2 ring-brand-500 ring-offset-2' : ''}`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-1 text-xs font-semibold text-white">
                  Most Popular
                </div>
              )}

              <div className={`px-6 py-8 ${isPopular ? 'bg-gradient-to-br from-brand-700 to-brand-500 text-white rounded-t-card' : ''}`}>
                <h3 className={`text-lg font-semibold ${isPopular ? 'text-white' : 'text-ink'}`}>{p.name}</h3>
                {p.description && (
                  <p className={`mt-1 text-sm ${isPopular ? 'text-brand-100' : 'text-muted'}`}>{p.description}</p>
                )}
                <div className="mt-4 flex items-baseline gap-2">
                  <span className={`font-serif text-4xl font-semibold ${isPopular ? 'text-white' : 'text-ink'}`}>₹{price}</span>
                  {discount > 0 && (
                    <>
                      <span className={`text-sm line-through ${isPopular ? 'text-brand-200' : 'text-muted'}`}>₹{mrp}</span>
                      <span className="rounded-full bg-ok-50 px-2 py-0.5 text-xs font-semibold text-ok">{discount}% off</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-1 flex-col px-6 pb-6 pt-4">
                <ul className="flex-1 space-y-2.5 text-sm text-ink-2">
                  {(p.features ?? []).map((f, fi) => (
                    <li key={fi} className="flex items-start gap-2.5">
                      <svg className="mt-0.5 size-4 shrink-0 text-ok" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <ButtonLink
                  href={user ? `/test-series` : '/login?next=/packs'}
                  size="lg"
                  variant={isPopular ? 'primary' : 'secondary'}
                  className="mt-6 w-full text-center"
                >
                  {user ? 'Get Started' : 'Sign In to Buy'}
                </ButtonLink>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Free tier callout */}
      <div className="mx-auto mt-12 max-w-2xl animate-slide-up">
        <Card className="flex flex-col items-center gap-4 border-brand-200/40 bg-brand-50/30 p-8 text-center sm:flex-row sm:text-left">
          <span className="text-4xl">🎓</span>
          <div>
            <h3 className="font-semibold text-ink">Not ready to pay?</h3>
            <p className="mt-1 text-sm text-muted">
              Start with our free test series and daily quiz. Upgrade anytime — your progress is always saved.
            </p>
          </div>
          <ButtonLink href="/test-series" variant="secondary" className="shrink-0">Browse Free Tests</ButtonLink>
        </Card>
      </div>
    </Container>
  );
}
