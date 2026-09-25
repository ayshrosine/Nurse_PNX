'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Field, Input, cx } from '@/components/ui';

function GoogleIcon() {
  return (
    <svg className="size-5" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.6 15.1 18.9 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="size-4 text-faint" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
    </svg>
  );
}

export function LoginPanel({
  next,
  googleConfigured,
  devLoginEnabled,
  error,
  admin = false,
}: {
  next: string;
  googleConfigured: boolean;
  devLoginEnabled: boolean;
  error?: string | null;
  admin?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<'google' | 'dev' | null>(null);
  const [email, setEmail] = useState(admin ? 'admin@example.test' : 'student1@example.test');
  const [devError, setDevError] = useState<string | null>(null);
  const redirectTo = `/auth/continue?next=${encodeURIComponent(next)}`;

  async function devLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy('dev');
    setDevError(null);
    const res = await signIn('dev', { email, redirect: false, redirectTo });
    if (res?.error) {
      setDevError('Sign-in failed. The account may be suspended.');
      setBusy(null);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert title="Couldn't sign you in">
          {error === 'forbidden'
            ? 'This account does not have admin access.'
            : error === 'AccessDenied'
              ? 'Access was denied. If this email is already linked to another Google account, contact support.'
              : 'Please try again.'}
        </Alert>
      )}

      {/* Google sign-in button */}
      <button
        type="button"
        disabled={!googleConfigured || busy !== null}
        onClick={() => {
          setBusy('google');
          signIn('google', { redirectTo });
        }}
        className={cx(
          'flex w-full items-center justify-center gap-3 rounded-xl border-2 px-6 py-3.5 text-sm font-semibold transition-all duration-200',
          'border-line-strong bg-surface text-ink hover:border-brand-200 hover:bg-brand-50/40 hover:shadow-sm',
          'disabled:opacity-50 disabled:pointer-events-none',
          busy === 'google' && 'opacity-70',
        )}
      >
        {busy === 'google' ? (
          <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" /><path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
        ) : (
          <GoogleIcon />
        )}
        Continue with Google
      </button>

      {!googleConfigured && (
        <p className="text-center text-xs text-muted">
          Google sign-in isn&apos;t configured yet. Set <code className="rounded bg-sunken px-1.5 py-0.5 text-xs">GOOGLE_CLIENT_ID</code> and <code className="rounded bg-sunken px-1.5 py-0.5 text-xs">GOOGLE_CLIENT_SECRET</code> in your environment.
        </p>
      )}

      {/* Trust indicators */}
      <div className="flex items-center justify-center gap-4 text-xs text-faint">
        <span className="flex items-center gap-1.5">
          <LockIcon />
          Secure sign-in
        </span>
        <span className="h-3 w-px bg-line" aria-hidden="true" />
        <span>No password needed</span>
      </div>

      {/* Dev login */}
      {devLoginEnabled && (
        <>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="text-xs font-medium text-faint">Development only</span>
            <div className="h-px flex-1 bg-line" />
          </div>
          <form onSubmit={devLogin} className="space-y-3 rounded-xl border border-dashed border-warn/30 bg-warn-50/40 p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-warn">Dev login</div>
            <p className="text-xs text-ink-2">
              Signs in as an existing account, or creates a new student.
            </p>
            <Field label="Email" htmlFor="dev-email" error={devError}>
              <Input id="dev-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </Field>
            <Button type="submit" size="sm" variant="secondary" loading={busy === 'dev'} disabled={busy !== null}>
              Sign in as dev user
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
