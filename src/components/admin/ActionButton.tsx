'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';

/**
 * Calls an admin API endpoint, optionally behind a confirmation dialog (PRD §32), then refreshes the page.
 */
export function ActionButton({
  endpoint,
  method = 'POST',
  body,
  label,
  confirm,
  variant = 'secondary',
  size = 'sm',
  redirectTo,
}: {
  endpoint: string;
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  label: string;
  confirm?: { title: string; message: string; confirmLabel?: string; danger?: boolean };
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await api(endpoint, { method, json: body ?? {} });
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      if (!confirm) setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant={variant} size={size} loading={busy && !open} onClick={() => (confirm ? setOpen(true) : run())}>
        {label}
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" onClick={() => !busy && setOpen(false)}>
          <Card className="animate-fade-up w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{confirm?.title ?? 'Action failed'}</h2>
            {confirm && <p className="mt-2 text-sm text-ink-2">{confirm.message}</p>}
            {error && <Alert className="mt-4">{error}</Alert>}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>{confirm ? 'Cancel' : 'Close'}</Button>
              {confirm && (
                <Button variant={confirm.danger ? 'danger' : 'primary'} onClick={run} loading={busy}>
                  {confirm.confirmLabel ?? label}
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
