import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

// ------------------------------------------------------------------ Button

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm',
  accent: 'bg-accent text-white hover:brightness-95 shadow-sm',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-sunken',
  ghost: 'text-ink-2 hover:bg-sunken hover:text-ink',
  danger: 'bg-bad text-white hover:brightness-95 shadow-sm',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra?: string) {
  return cx(
    'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 select-none whitespace-nowrap',
    'disabled:opacity-50 disabled:pointer-events-none',
    variants[variant],
    sizes[size],
    extra,
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={disabled || loading} {...props}>
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx('animate-spin', className ?? 'size-5')} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ------------------------------------------------------------------ Surfaces

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cx('rounded-card border border-line bg-surface transition-all duration-200', className)} {...props} />;
}

export function Container({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cx('mx-auto w-full max-w-6xl px-4 sm:px-6', className)} {...props} />;
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">{eyebrow}</div>}
        <h1 className="text-3xl font-semibold sm:text-[2.1rem]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ Badges

type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'bad' | 'accent';
const tones: Record<Tone, string> = {
  neutral: 'bg-sunken text-ink-2 ring-line',
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  ok: 'bg-ok-50 text-ok ring-ok/15',
  warn: 'bg-warn-50 text-warn ring-warn/20',
  bad: 'bg-bad-50 text-bad ring-bad/15',
  accent: 'bg-accent-50 text-accent ring-accent/15',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  PUBLISHED: 'ok', DRAFT: 'warn', ARCHIVED: 'neutral',
  SUCCESS: 'ok', PENDING: 'warn', FAILED: 'bad', CANCELLED: 'neutral', REFUNDED: 'accent',
  COMPLETED: 'ok', IN_PROGRESS: 'brand', ABANDONED: 'neutral',
  APPROVED: 'ok', PENDING_REVIEW: 'warn', REJECTED: 'bad',
  ACTIVE: 'ok', SUSPENDED: 'bad', ADMIN: 'accent', STUDENT: 'neutral',
  UPLOADED: 'neutral', EXTRACTING: 'brand', EXTRACTED: 'brand', GENERATING: 'brand', GENERATED: 'warn',
  EXTRACT_FAILED: 'bad', GENERATE_FAILED: 'bad',
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? 'neutral'}>{status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</Badge>;
}

// ------------------------------------------------------------------ Feedback

export function Alert({ tone = 'bad', title, children, className }: { tone?: 'bad' | 'ok' | 'warn' | 'brand'; title?: ReactNode; children?: ReactNode; className?: string }) {
  const t = { bad: 'border-bad/20 bg-bad-50 text-bad', ok: 'border-ok/20 bg-ok-50 text-ok', warn: 'border-warn/25 bg-warn-50 text-warn', brand: 'border-brand-100 bg-brand-50 text-brand-700' }[tone];
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={cx('rounded-lg border px-4 py-3 text-sm', t, className)}>
      {title && <div className="font-semibold">{title}</div>}
      {children && <div className={cx(title ? 'mt-0.5' : null, 'text-ink-2')}>{children}</div>}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-surface/60 px-6 py-12 text-center">
      <div className="font-serif text-lg text-ink">{title}</div>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-2 font-serif text-3xl text-ink tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-faint">{hint}</div>}
    </Card>
  );
}

// ------------------------------------------------------------------ Forms

export function Field({ label, htmlFor, error, hint, children, required }: { label: ReactNode; htmlFor: string; error?: string | null; hint?: ReactNode; children: ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-bad"> *</span>}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-bad">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase =
  'w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-faint transition-colors focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-100 disabled:bg-sunken disabled:text-muted aria-[invalid=true]:border-bad';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cx(inputBase, 'h-10', className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cx(inputBase, 'min-h-24 py-2 leading-relaxed', className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cx(inputBase, 'h-10 pr-8', className)} {...props} />;
}

// ------------------------------------------------------------------ Table

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('overflow-x-auto rounded-card border border-line bg-surface', className)}>
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cx('border-b border-line bg-sunken/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted', className)}>{children}</th>;
}
export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cx('border-b border-line px-4 py-3 align-middle text-ink-2 [tr:last-child_&]:border-b-0', className)}>{children}</td>;
}
