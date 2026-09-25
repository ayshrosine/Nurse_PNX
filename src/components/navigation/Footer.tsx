import Link from 'next/link';
import { Logo } from './Logo';

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line/50">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-[2fr_1fr_1fr] sm:px-6">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
            Exam-level MCQ practice for nursing students and aspirants. Practice smarter, prepare better.
          </p>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">Practice</div>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link className="text-ink-2 transition-colors hover:text-brand-600" href="/test-series">All test series</Link></li>
            <li><Link className="text-ink-2 transition-colors hover:text-brand-600" href="/dashboard">Your dashboard</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">Account</div>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link className="text-ink-2 transition-colors hover:text-brand-600" href="/login">Log in</Link></li>
            <li><Link className="text-ink-2 transition-colors hover:text-brand-600" href="/profile">Profile</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line/40">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-faint sm:px-6">
          © {new Date().getFullYear()} Nursing Level Up. Payments are processed securely by Razorpay.
        </div>
      </div>
    </footer>
  );
}
