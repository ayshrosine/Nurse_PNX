'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import { testSeriesInputSchema } from '@/lib/validation';
import type { TestSeries } from '@/types';

const DEFAULT_INSTRUCTIONS = [
  'Each question has exactly one correct answer.',
  'There is no negative marking.',
  'You can move between questions and mark any of them for review.',
  'The test submits automatically when the timer reaches zero.',
].join('\n');

export function TestSeriesForm({ initial }: { initial?: TestSeries }) {
  const router = useRouter();
  const editing = Boolean(initial);
  const [values, setValues] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    is_free: initial?.is_free ?? true,
    price: String(initial?.price ?? 0),
    duration_minutes: String(initial?.duration_minutes ?? 30),
    instructions: initial?.instructions ?? DEFAULT_INSTRUCTIONS,
    status: initial?.status ?? 'DRAFT',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...values,
      price: values.is_free ? 0 : Number(values.price),
      duration_minutes: Number(values.duration_minutes),
      currency: 'INR' as const,
    };
    const check = testSeriesInputSchema.safeParse(payload);
    if (!check.success) {
      setErrors(Object.fromEntries(check.error.issues.map((i) => [i.path.join('.'), i.message])));
      return;
    }
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      const saved = await api<TestSeries>(editing ? `/api/admin/test-series/${initial!.id}` : '/api/admin/test-series', {
        method: editing ? 'PUT' : 'POST',
        json: payload,
      });
      router.push(editing ? `/admin/test-series/${saved.id}` : `/admin/test-series/${saved.id}/questions`);
      router.refresh();
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card className="space-y-5 p-6">
        {formError && <Alert>{formError}</Alert>}
        <Field label="Title" htmlFor="title" error={errors.title} required>
          <Input id="title" value={values.title} onChange={set('title')} maxLength={200} aria-invalid={Boolean(errors.title)} />
        </Field>
        <Field label="Description" htmlFor="description" error={errors.description} hint="Shown on the catalog card and detail page.">
          <Textarea id="description" value={values.description} onChange={set('description')} rows={3} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Pricing" htmlFor="is_free">
            <Select id="is_free" value={values.is_free ? 'free' : 'paid'} onChange={(e) => setValues((v) => ({ ...v, is_free: e.target.value === 'free', price: e.target.value === 'free' ? '0' : v.price === '0' ? '199' : v.price }))}>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </Select>
          </Field>
          <Field label="Price (INR)" htmlFor="price" error={errors.price} hint={editing ? 'Changing the price never alters past purchases.' : undefined}>
            <Input id="price" type="number" min={0} step="1" value={values.is_free ? '0' : values.price} onChange={set('price')} disabled={values.is_free} aria-invalid={Boolean(errors.price)} />
          </Field>
          <Field label="Duration (minutes)" htmlFor="duration" error={errors.duration_minutes} required>
            <Input id="duration" type="number" min={1} max={600} value={values.duration_minutes} onChange={set('duration_minutes')} aria-invalid={Boolean(errors.duration_minutes)} />
          </Field>
        </div>
        <Field label="Instructions" htmlFor="instructions" error={errors.instructions} hint="One instruction per line.">
          <Textarea id="instructions" value={values.instructions} onChange={set('instructions')} rows={5} />
        </Field>
        <Field label="Status" htmlFor="status" error={errors.status} hint={editing ? 'Publishing requires at least one approved question.' : 'New test series start as drafts; publish after adding questions.'}>
          <Select id="status" value={values.status} onChange={set('status')} disabled={!editing}>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </Field>
        <div className="flex justify-end gap-2 border-t border-line pt-5">
          <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={busy}>{editing ? 'Save changes' : 'Create and add questions'}</Button>
        </div>
      </Card>
    </form>
  );
}
