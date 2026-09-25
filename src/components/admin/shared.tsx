import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button, cx } from '@/components/ui';

type Params = Record<string, string | undefined>;

export function withParams(base: string, params: Params, patch: Params) {
  const merged = { ...params, ...patch };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

export function Pagination({ base, params, page, totalPages, total }: { base: string; params: Params; page: number; totalPages: number; total: number }) {
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted">
      <span>{total} result{total === 1 ? '' : 's'}</span>
      <div className="flex items-center gap-2">
        <Link
          aria-disabled={page <= 1}
          className={cx('rounded-md border border-line bg-surface px-3 py-1.5', page <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-sunken')}
          href={withParams(base, params, { page: String(page - 1) })}
        >
          Previous
        </Link>
        <span className="tabular-nums">Page {page} of {totalPages}</span>
        <Link
          aria-disabled={page >= totalPages}
          className={cx('rounded-md border border-line bg-surface px-3 py-1.5', page >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-sunken')}
          href={withParams(base, params, { page: String(page + 1) })}
        >
          Next
        </Link>
      </div>
    </div>
  );
}

/** Plain GET form: filters live in the URL, so results are shareable and survive refresh. */
export function FilterBar({ action, children }: { action: string; children: ReactNode }) {
  return (
    <form action={action} method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-card border border-line bg-surface p-3">
      {children}
      <Button type="submit" size="sm" variant="secondary">Apply</Button>
      <Link href={action} className="text-sm text-muted hover:text-brand-600">Reset</Link>
    </form>
  );
}

export const filterInput =
  'h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-faint focus:border-brand-500 focus:outline-none';

export function AdminHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6">
      {back && <Link href={back.href} className="text-sm text-muted hover:text-brand-600">← {back.label}</Link>}
      <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold sm:text-[1.75rem]">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function parsePage(v: string | undefined) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 1;
}
