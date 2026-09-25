import Link from 'next/link';
import type { AccessState, PublicTestSeries } from '@/types';
import { Badge } from '@/components/ui';
import { formatPrice } from '@/lib/format';

const ACCESS: Record<AccessState, { label: string; tone: 'ok' | 'neutral' | 'warn' | 'brand' }> = {
  FREE: { label: 'Free', tone: 'ok' },
  LOGIN_REQUIRED: { label: 'Login required', tone: 'neutral' },
  PURCHASE_REQUIRED: { label: 'Purchase required', tone: 'warn' },
  PURCHASED: { label: 'Purchased', tone: 'brand' },
};

export function AccessBadge({ access }: { access: AccessState }) {
  const a = ACCESS[access];
  return <Badge tone={a.tone}>{a.label}</Badge>;
}

export function TestSeriesCard({ series }: { series: PublicTestSeries }) {
  return (
    <Link
      href={`/test-series/${series.id}`}
      className="group flex h-full flex-col rounded-2xl border border-line/70 bg-surface p-6 card-hover"
    >
      <div className="flex items-start justify-between gap-3">
        <AccessBadge access={series.access} />
        <span className={series.is_free ? 'text-sm font-semibold text-ok' : 'font-serif text-lg font-semibold text-ink'}>
          {formatPrice(series.price, series.is_free, series.currency)}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-semibold leading-snug transition-colors duration-200 group-hover:text-brand-600">
        {series.title}
      </h3>
      {series.description && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{series.description}</p>}
      <div className="mt-auto flex items-center gap-5 pt-6 text-sm text-ink-2">
        <span className="flex items-center gap-2">
          <svg className="size-4 text-brand-500/60" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M4 3h9l3 3v11H4z" opacity=".3" /><path d="M7 8h6v1.5H7zm0 3h6v1.5H7z" />
          </svg>
          {series.question_count} questions
        </span>
        <span className="flex items-center gap-2">
          <svg className="size-4 text-brand-500/60" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <circle cx="10" cy="10" r="7" opacity=".3" /><path d="M9.25 6h1.5v4.2l2.8 1.7-.8 1.3-3.5-2.1z" />
          </svg>
          {series.duration_minutes} min
        </span>
      </div>
    </Link>
  );
}
