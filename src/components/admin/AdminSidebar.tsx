'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { cx } from '@/components/ui';
import { LogoMark } from '@/components/navigation/Logo';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: 'M3 10h6V3H3zm8 7h6V10h-6zM3 17h6v-5H3zm8-9h6V3h-6z' },
  { href: '/admin/users', label: 'Users', icon: 'M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-6 8c0-3 3-5 6-5s6 2 6 5z' },
  { href: '/admin/test-series', label: 'Test Series', icon: 'M4 3h9l3 3v11H4zm3 5h6v1.5H7zm0 3h6v1.5H7z' },
  { href: '/admin/questions', label: 'Questions', icon: 'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 12.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm1-4v.5H9V9.5c0-1.5 2-1.6 2-3a1 1 0 0 0-2 0H7a3 3 0 1 1 6 0c0 2-2 2.3-2 4z' },
  { href: '/admin/purchases', label: 'Purchases', icon: 'M3 5h14v10H3zm0 3h14v2H3z' },
  { href: '/admin/attempts', label: 'Attempts', icon: 'M5 3h10v14H5zm2 4h6v1.5H7zm0 3h6v1.5H7zm0 3h4v1.5H7z' },
  { href: '/admin/settings', label: 'Settings', icon: 'M10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM9 1h2l.4 2.2 1.7.7 1.8-1.3 1.4 1.4-1.3 1.8.7 1.7L18 9v2l-2.2.4-.7 1.7 1.3 1.8-1.4 1.4-1.8-1.3-1.7.7L11 19H9l-.4-2.2-1.7-.7-1.8 1.3-1.4-1.4 1.3-1.8-.7-1.7L2 11V9l2.2-.4.7-1.7-1.3-1.8 1.4-1.4 1.8 1.3 1.7-.7z' },
];

export function AdminSidebar({ name, email }: { name: string; email: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));

  return (
    <>
      <div className="flex h-14 items-center justify-between border-b border-line bg-surface px-4 lg:hidden">
        <Link href="/admin" className="flex items-center gap-2 font-serif font-semibold"><LogoMark className="size-7" /> Admin</Link>
        <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-sunken" aria-expanded={open}>
          Menu
        </button>
      </div>
      <aside className={cx('flex-col border-r border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh', open ? 'flex' : 'hidden')}>
        <Link href="/admin" className="hidden items-center gap-2.5 px-5 py-5 lg:flex">
          <LogoMark className="size-8" />
          <div>
            <div className="font-serif text-[0.95rem] font-semibold leading-tight">Nursing Level Up</div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted">Admin</div>
          </div>
        </Link>
        <nav className="flex-1 space-y-0.5 px-3 py-3 lg:py-0" aria-label="Admin">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={cx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive(item.href) ? 'bg-brand-50 text-brand-700' : 'text-ink-2 hover:bg-sunken hover:text-ink',
              )}
            >
              <svg className="size-[18px] shrink-0 opacity-80" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d={item.icon} /></svg>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line p-4">
          <div className="truncate text-sm font-medium">{name}</div>
          <div className="truncate text-xs text-muted">{email}</div>
          <div className="mt-3 flex gap-3 text-sm">
            <Link href="/" className="text-muted hover:text-brand-600">View site</Link>
            <button type="button" onClick={() => signOut({ redirectTo: '/admin/login' })} className="text-muted hover:text-bad">Logout</button>
          </div>
        </div>
      </aside>
    </>
  );
}
