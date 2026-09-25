import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginPanel } from '@/components/auth/LoginPanel';
import { devLoginEnabled, googleConfigured } from '@/lib/server/auth';
import { getCurrentUser, safeNext } from '@/lib/server/session';

export const metadata: Metadata = { title: 'Log in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNext(rawNext);
  if (await getCurrentUser()) redirect(`/auth/continue?next=${encodeURIComponent(next)}`);

  return (
    <div className="flex min-h-dvh">
      {/* Left decorative panel — hidden on mobile */}
      <div className="relative hidden flex-1 overflow-hidden bg-gradient-to-br from-brand-800 to-brand-600 lg:flex lg:flex-col lg:justify-between">
        {/* Floating decorative elements */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute right-10 top-20 size-40 rounded-full bg-white/5 blur-2xl animate-float-slow" />
          <div className="absolute bottom-20 left-10 size-56 rounded-full bg-brand-200/10 blur-3xl animate-float-slow stagger-3" />
          <div className="absolute left-1/2 top-1/3 size-32 rounded-full bg-accent/5 blur-2xl animate-float stagger-2" />
        </div>

        <div className="relative flex flex-1 flex-col justify-center px-12 py-16 xl:px-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 32 32" className="size-10" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="rgba(255,255,255,0.15)" />
              <path d="M13 8h6v5h5v6h-5v5h-6v-5H8v-6h5z" fill="#faf8f4" />
              <path d="M8 26.5h16" stroke="#b4532a" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="font-serif text-xl font-semibold text-white">
              Nursing <span className="text-brand-200">Level Up</span>
            </span>
          </div>

          <div className="mt-14">
            <h1 className="text-4xl font-semibold leading-tight text-white xl:text-5xl">
              Practice smarter.
              <br />
              <span className="text-brand-200">Prepare better.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-brand-100/80">
              Timed, exam-level MCQ test series crafted for nursing students and aspirants — with detailed explanations for every answer.
            </p>
          </div>

          {/* Feature highlights */}
          <ul className="mt-12 space-y-4">
            {[
              { icon: '✦', text: 'Free tests to get started instantly' },
              { icon: '◈', text: 'Exam conditions with real timer & navigator' },
              { icon: '◉', text: 'Detailed explanations for every question' },
            ].map((f) => (
              <li key={f.text} className="flex items-center gap-3 text-sm text-brand-100/90">
                <span className="flex size-8 items-center justify-center rounded-lg bg-white/10 text-xs text-brand-200">{f.icon}</span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative px-12 py-8 text-xs text-brand-200/60 xl:px-16">
          © {new Date().getFullYear()} Nursing Level Up
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:max-w-xl lg:px-16 xl:px-20">
        {/* Mobile logo */}
        <div className="mb-10 flex items-center gap-2.5 lg:hidden">
          <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#11504b" />
            <path d="M13 8h6v5h5v6h-5v5h-6v-5H8v-6h5z" fill="#faf8f4" />
            <path d="M8 26.5h16" stroke="#b4532a" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="font-serif text-lg font-semibold text-ink">
            Nursing <span className="text-brand-600">Level Up</span>
          </span>
        </div>

        <div className="w-full max-w-md animate-slide-up">
          <h2 className="text-3xl font-semibold text-ink">Welcome</h2>
          <p className="mt-2 text-muted">
            Sign in to start tests, track progress, and review your results.
          </p>

          <div className="mt-10">
            <LoginPanel next={next} googleConfigured={googleConfigured} devLoginEnabled={devLoginEnabled} error={error} />
          </div>

          <p className="mt-10 text-center text-xs leading-relaxed text-faint">
            We only use your Google name and email to create your account.
            <br />
            Your phone number is asked for separately after sign-in.
          </p>
        </div>
      </div>
    </div>
  );
}
