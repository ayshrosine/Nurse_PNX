'use client';

import { useState } from 'react';
import { cx } from '@/components/ui';

// Landing-page demo only: a fixed, unscored example that never talks to the backend (Frontend doc §3).
const SAMPLE = {
  question: 'A patient on heparin therapy for deep vein thrombosis is being monitored. Which laboratory value best reflects the effectiveness of heparin?',
  options: ['Prothrombin time (PT)', 'International normalised ratio (INR)', 'Activated partial thromboplastin time (aPTT)', 'Platelet count'],
  answer: 2,
  explanation: 'aPTT monitors unfractionated heparin; the usual target is 1.5–2.5 times the control value. PT/INR are used for warfarin.',
};

export function SampleQuestion() {
  const [picked, setPicked] = useState<number | null>(null);
  const revealed = picked !== null;

  return (
    <div className="glass rounded-2xl p-6 shadow-lg shadow-brand-800/5 sm:p-8">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted">
        <span className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-brand-500 animate-pulse-soft" />
          Sample question
        </span>
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-brand-600">Pharmacology</span>
      </div>
      <p className="mt-5 font-serif text-lg leading-relaxed text-ink sm:text-xl">{SAMPLE.question}</p>
      <div className="mt-6 space-y-2.5" role="radiogroup" aria-label="Options">
        {SAMPLE.options.map((opt, i) => {
          const correct = revealed && i === SAMPLE.answer;
          const wrong = revealed && i === picked && i !== SAMPLE.answer;
          return (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={picked === i}
              disabled={revealed}
              onClick={() => setPicked(i)}
              className={cx(
                'flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition-all duration-200',
                !revealed && 'border-line-strong bg-white/60 hover:border-brand-500 hover:bg-brand-50/60 hover:shadow-sm',
                correct && 'border-ok/40 bg-ok-50 text-ink shadow-sm shadow-ok/10',
                wrong && 'border-bad/40 bg-bad-50 text-ink shadow-sm shadow-bad/10',
                revealed && !correct && !wrong && 'border-line/60 text-muted bg-transparent',
              )}
            >
              <span
                className={cx(
                  'flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition-all duration-200',
                  correct ? 'bg-ok text-white shadow-sm' : wrong ? 'bg-bad text-white shadow-sm' : 'border border-line-strong bg-surface text-ink-2',
                )}
              >
                {'ABCD'[i]}
              </span>
              <span className="leading-snug">{opt}</span>
            </button>
          );
        })}
      </div>
      {revealed && (
        <div className="animate-slide-up mt-5 rounded-xl bg-sunken/80 px-4 py-3.5 text-sm text-ink-2">
          <span className={cx('font-semibold', picked === SAMPLE.answer ? 'text-ok' : 'text-bad')}>
            {picked === SAMPLE.answer ? 'Correct! ' : 'Not quite. '}
          </span>
          {SAMPLE.explanation}
          <button type="button" onClick={() => setPicked(null)} className="ml-2 font-medium text-brand-600 underline-offset-2 hover:underline transition-colors">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
