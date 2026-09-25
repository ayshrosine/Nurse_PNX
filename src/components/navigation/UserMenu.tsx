'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { signOut } from 'next-auth/react';

export function UserMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex size-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-200"
      >
        <span className="sr-only">Account menu</span>
        {initials || '?'}
      </button>
      {open && (
        <div role="menu" className="animate-fade-up absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          <div className="border-b border-line px-4 py-3">
            <div className="truncate text-sm font-medium text-ink">{name}</div>
            <div className="truncate text-xs text-muted">{email}</div>
          </div>
          <div className="py-1 text-sm">
            <Link role="menuitem" href="/dashboard" className="block px-4 py-2 text-ink-2 hover:bg-sunken" onClick={() => setOpen(false)}>Dashboard</Link>
            <Link role="menuitem" href="/profile" className="block px-4 py-2 text-ink-2 hover:bg-sunken" onClick={() => setOpen(false)}>Profile</Link>
            <button role="menuitem" type="button" className="block w-full px-4 py-2 text-left text-ink-2 hover:bg-sunken" onClick={() => signOut({ redirectTo: '/' })}>
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
