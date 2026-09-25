'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Question } from '@/types';
import { Alert, Button, Card, EmptyState, StatusBadge, cx } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { QuestionEditor, emptyQuestion } from './QuestionEditor';

export function QuestionManager({ seriesId, initial }: { seriesId: string; initial: Question[] }) {
  const router = useRouter();
  const [questions, setQuestions] = useState(initial);
  const [editing, setEditing] = useState<string | 'new' | null>(initial.length === 0 ? 'new' : null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const approved = questions.filter((q) => q.review_status === 'APPROVED');
  const drafts = questions.filter((q) => q.review_status !== 'APPROVED');

  async function refresh() {
    setQuestions(await api<Question[]>(`/api/admin/test-series/${seriesId}/questions`));
    router.refresh();
  }

  async function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= approved.length) return;
    const order = approved.map((q) => q.id);
    [order[index], order[target]] = [order[target], order[index]];
    const previous = questions;
    const byId = new Map(questions.map((q) => [q.id, q]));
    setQuestions([...order.map((id) => byId.get(id)!), ...drafts]);
    setSavingOrder(true);
    setError(null);
    try {
      await api(`/api/admin/test-series/${seriesId}/questions/reorder`, { method: 'POST', json: { questionIds: order } });
    } catch (err) {
      setQuestions(previous);
      setError(errorMessage(err));
    } finally {
      setSavingOrder(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await api(`/api/admin/questions/${id}`, { method: 'DELETE' });
      setConfirmDelete(null);
      await refresh();
    } catch (err) {
      setConfirmDelete(null);
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Approved questions <span className="text-muted">({approved.length})</span></h2>
        <div className="flex items-center gap-3">
          {savingOrder && <span className="text-xs text-muted">Saving order…</span>}
          <Button size="sm" onClick={() => setEditing('new')} disabled={editing === 'new'}>Add question</Button>
        </div>
      </div>

      {editing === 'new' && (
        <Card className="border-brand-200 p-5">
          <div className="mb-4 font-sans text-sm font-semibold">New question</div>
          <QuestionEditor
            idPrefix="new"
            initial={emptyQuestion}
            saveLabel="Add question"
            onCancel={approved.length ? () => setEditing(null) : undefined}
            onSave={async (q) => {
              await api(`/api/admin/test-series/${seriesId}/questions`, { method: 'POST', json: q });
              setEditing(null);
              await refresh();
            }}
          />
        </Card>
      )}

      {approved.length === 0 && editing !== 'new' ? (
        <EmptyState
          title="No questions yet"
          description="Add questions one by one, or import them from an HTML/CSV/JSON file or a PDF/DOCX document."
          action={<Link href={`/admin/test-series/${seriesId}/import`} className="text-sm font-medium text-brand-600 hover:underline">Import questions →</Link>}
        />
      ) : (
        <ol className="space-y-3">
          {approved.map((q, i) => (
            <li key={q.id}>
              <Card className={cx('p-5', editing === q.id && 'border-brand-200')}>
                {editing === q.id ? (
                  <QuestionEditor
                    idPrefix={q.id}
                    initial={q}
                    onCancel={() => setEditing(null)}
                    onSave={async (input) => {
                      await api(`/api/admin/questions/${q.id}`, { method: 'PUT', json: input });
                      setEditing(null);
                      await refresh();
                    }}
                  />
                ) : (
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center gap-1 text-muted">
                      <button type="button" aria-label="Move up" disabled={i === 0 || savingOrder} onClick={() => move(i, -1)} className="rounded p-0.5 hover:bg-sunken disabled:opacity-30">▲</button>
                      <span className="text-sm font-semibold tabular-nums text-ink">{i + 1}</span>
                      <button type="button" aria-label="Move down" disabled={i === approved.length - 1 || savingOrder} onClick={() => move(i, 1)} className="rounded p-0.5 hover:bg-sunken disabled:opacity-30">▼</button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{q.question_text}</p>
                      <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                        {(['A', 'B', 'C', 'D'] as const).map((l) => (
                          <li key={l} className={cx(q.correct_answer === l ? 'font-medium text-ok' : 'text-ink-2')}>
                            {l}. {q[`option_${l.toLowerCase()}` as 'option_a']} {q.correct_answer === l && '✓'}
                          </li>
                        ))}
                      </ul>
                      {q.explanation && <p className="mt-2 text-xs text-muted">Explanation: {q.explanation}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {q.source !== 'MANUAL' && <span className="text-[11px] uppercase tracking-wide text-faint">{q.source.replace('_', ' ').toLowerCase()}</span>}
                      <Button size="sm" variant="ghost" onClick={() => setEditing(q.id)}>Edit</Button>
                      {confirmDelete === q.id ? (
                        <span className="flex gap-1">
                          <Button size="sm" variant="danger" onClick={() => remove(q.id)}>Confirm</Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>No</Button>
                        </span>
                      ) : (
                        <Button size="sm" variant="ghost" className="text-bad" onClick={() => setConfirmDelete(q.id)}>Delete</Button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ol>
      )}

      {drafts.length > 0 && (
        <div className="pt-4">
          <h2 className="text-lg font-semibold">Drafts &amp; rejected <span className="text-muted">({drafts.length})</span></h2>
          <p className="mt-1 text-sm text-muted">AI-generated drafts are invisible to students until approved on the import page.</p>
          <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
            {drafts.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <span className="min-w-0 truncate text-ink-2">{q.question_text}</span>
                <StatusBadge status={q.review_status} />
              </li>
            ))}
          </ul>
          <Link href={`/admin/test-series/${seriesId}/import`} className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline">Review drafts →</Link>
        </div>
      )}
    </div>
  );
}
