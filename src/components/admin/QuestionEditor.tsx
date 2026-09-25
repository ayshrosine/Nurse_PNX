'use client';

import { useState } from 'react';
import { Alert, Button, Field, Input, Textarea, cx } from '@/components/ui';
import { questionInputSchema, type QuestionInput } from '@/lib/validation';

export type QuestionDraft = {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string | null;
};

export const emptyQuestion: QuestionDraft = { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A', explanation: '' };

/** Shared by manual entry, import preview and AI draft review (Frontend doc §14 step 4). */
export function QuestionEditor({
  initial,
  onSave,
  onCancel,
  saveLabel = 'Save question',
  idPrefix,
}: {
  initial: QuestionDraft;
  onSave: (q: QuestionInput) => Promise<void> | void;
  onCancel?: () => void;
  saveLabel?: string;
  idPrefix: string;
}) {
  const [q, setQ] = useState<QuestionDraft>({ ...initial, explanation: initial.explanation ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const parsed = questionInputSchema.safeParse(q);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      await onSave(parsed.data);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  const id = (k: string) => `${idPrefix}-${k}`;
  return (
    <div className="space-y-4">
      {formError && <Alert>{formError}</Alert>}
      <Field label="Question" htmlFor={id('text')} error={errors.question_text} required>
        <Textarea id={id('text')} rows={3} value={q.question_text} onChange={(e) => setQ({ ...q, question_text: e.target.value })} />
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Options <span className="font-normal text-muted">— select the correct answer</span></legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['A', 'B', 'C', 'D'] as const).map((letter) => {
            const key = `option_${letter.toLowerCase()}` as 'option_a';
            const correct = q.correct_answer === letter;
            return (
              <div key={letter}>
                <div className={cx('flex items-center gap-2 rounded-lg border p-1.5 pl-2', correct ? 'border-ok bg-ok-50' : 'border-line-strong bg-surface', errors[key] && 'border-bad')}>
                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-sm font-semibold" title="Mark as correct answer">
                    <input type="radio" name={id('correct')} checked={correct} onChange={() => setQ({ ...q, correct_answer: letter })} className="accent-[var(--color-ok)]" aria-label={`${letter} is correct`} />
                    {letter}
                  </label>
                  <Input id={id(key)} aria-label={`Option ${letter}`} className="h-9 border-0 focus:ring-0" value={q[key]} onChange={(e) => setQ({ ...q, [key]: e.target.value })} />
                </div>
                {errors[key] && <p className="mt-1 text-xs text-bad">{errors[key]}</p>}
              </div>
            );
          })}
        </div>
      </fieldset>
      <Field label="Explanation" htmlFor={id('exp')} hint="Shown to students after they submit.">
        <Textarea id={id('exp')} rows={2} value={q.explanation ?? ''} onChange={(e) => setQ({ ...q, explanation: e.target.value })} />
      </Field>
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>}
        <Button type="button" size="sm" onClick={save} loading={busy}>{saveLabel}</Button>
      </div>
    </div>
  );
}
