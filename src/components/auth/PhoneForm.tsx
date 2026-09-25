'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Field, Input } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { phoneSchema } from '@/lib/validation';

export function PhoneForm({ initial, next, submitLabel = 'Save and continue' }: { initial?: string | null; next?: string; submitLabel?: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState(initial ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    // Client check is for instant feedback only; the server validates again.
    const check = phoneSchema.safeParse(phone);
    if (!check.success) {
      setError(check.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api('/api/me/profile', { method: 'PUT', json: { phone } });
      if (next) {
        router.replace(next);
        router.refresh();
      } else {
        setSaved(true);
        router.refresh();
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Mobile number" htmlFor="phone" error={error} hint="10-digit Indian mobile number, e.g. 98765 43210" required>
        <div className="flex">
          <span className="inline-flex items-center rounded-l-lg border border-r-0 border-line-strong bg-sunken px-3 text-sm text-muted">+91</span>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            className="rounded-l-none"
            value={phone.replace(/^\+91/, '')}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'phone-error' : undefined}
            placeholder="98765 43210"
          />
        </div>
      </Field>
      {saved && <Alert tone="ok">Phone number saved.</Alert>}
      <Button type="submit" loading={busy}>{submitLabel}</Button>
    </form>
  );
}
