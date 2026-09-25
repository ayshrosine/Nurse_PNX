'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Textarea, cx } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { QuestionInput } from '@/lib/validation';
import { QuestionEditor } from '../QuestionEditor';

interface ParseResponse {
  filename: string;
  format: string;
  questions: QuestionInput[];
  issues: { index: number; message: string; excerpt: string }[];
}

const SAMPLE = `1. Normal adult respiratory rate is:
A) 6–10 /min
B) 12–20 /min
C) 22–28 /min
D) 30–40 /min
Answer: B
Explanation: Adults breathe 12–20 times per minute at rest.`;

/**
 * Upload → server parse → validate → PREVIEW → admin edits → save (PRD §6.9). The file is parsed on the
 * server; the preview shows extracted plain text only, never the uploaded HTML.
 */
export function StructuredImport({ seriesId }: { seriesId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [pasted, setPasted] = useState('');
  const [result, setResult] = useState<ParseResponse | null>(null);
  const [items, setItems] = useState<QuestionInput[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState<'parse' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function parse() {
    setError(null);
    setBusy('parse');
    try {
      let res: ParseResponse;
      if (mode === 'file') {
        if (!file) throw new Error('Choose a file first');
        const form = new FormData();
        form.append('file', file);
        res = await api<ParseResponse>(`/api/admin/test-series/${seriesId}/import/html`, { method: 'POST', body: form });
      } else {
        res = await api<ParseResponse>(`/api/admin/test-series/${seriesId}/import/html`, { method: 'POST', json: { html: pasted } });
      }
      setResult(res);
      setItems(res.questions);
      setEditing(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy('save');
    setError(null);
    try {
      await api(`/api/admin/test-series/${seriesId}/import/save`, { method: 'POST', json: { questions: items, filename: result?.filename } });
      router.push(`/admin/test-series/${seriesId}/questions`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="font-sans text-base font-semibold">Structured import</h2>
      <p className="mt-1 text-sm text-muted">
        HTML, CSV, JSON or text files that already contain questions with answers. Supports numbered text
        (“1. … A) … Answer: B”), HTML tables with Question/A/B/C/D/Answer columns, <code className="text-xs">.question</code>/<code className="text-xs">.option</code> markup,
        and CSV/JSON with <code className="text-xs">question, option_a…option_d, correct_answer, explanation</code>.
      </p>

      {!result && (
        <div className="mt-5 space-y-4">
          <div className="inline-flex rounded-lg border border-line bg-sunken p-0.5 text-sm">
            {(['file', 'paste'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={cx('rounded-md px-3 py-1.5 font-medium', mode === m ? 'bg-surface shadow-sm' : 'text-muted')}>
                {m === 'file' ? 'Upload file' : 'Paste text / HTML'}
              </button>
            ))}
          </div>
          {mode === 'file' ? (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-line-strong bg-paper px-6 py-8 text-center hover:border-brand-500">
              <span className="text-sm font-medium text-ink">{file ? file.name : 'Choose a .html, .csv, .json or .txt file'}</span>
              <span className="mt-1 text-xs text-muted">Max 2 MB</span>
              <input type="file" accept=".html,.htm,.csv,.json,.txt" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} data-testid="structured-file" />
            </label>
          ) : (
            <Textarea rows={8} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={SAMPLE} aria-label="Paste questions" className="font-mono text-xs" />
          )}
          {error && <Alert>{error}</Alert>}
          <Button onClick={parse} loading={busy === 'parse'} disabled={mode === 'file' ? !file : !pasted.trim()}>Parse and preview</Button>
        </div>
      )}

      {result && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-sunken px-4 py-3 text-sm">
            <span>
              <strong>{items.length}</strong> question{items.length === 1 ? '' : 's'} ready from <em>{result.filename}</em>
              {result.issues.length > 0 && <span className="text-bad"> · {result.issues.length} skipped</span>}
            </span>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setItems([]); }}>Start over</Button>
          </div>
          {result.issues.length > 0 && (
            <Alert tone="warn" title="Some entries could not be imported">
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {result.issues.slice(0, 10).map((i) => <li key={i.index}>#{i.index}: {i.message}{i.excerpt && ` — “${i.excerpt}”`}</li>)}
                {result.issues.length > 10 && <li>…and {result.issues.length - 10} more</li>}
              </ul>
            </Alert>
          )}
          <ol className="space-y-2">
            {items.map((q, i) => (
              <li key={i} className="rounded-lg border border-line p-4">
                {editing === i ? (
                  <QuestionEditor idPrefix={`imp-${i}`} initial={q} saveLabel="Update" onCancel={() => setEditing(null)}
                    onSave={(updated) => { setItems((all) => all.map((x, j) => (j === i ? updated : x))); setEditing(null); }} />
                ) : (
                  <div className="flex gap-3 text-sm">
                    <span className="font-semibold text-muted">{i + 1}.</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{q.question_text}</p>
                      <p className="mt-1 text-xs text-muted">
                        {(['A', 'B', 'C', 'D'] as const).map((l) => `${l}) ${q[`option_${l.toLowerCase()}` as 'option_a']}`).join('   ')}
                      </p>
                      <p className="mt-1 text-xs font-medium text-ok">Answer: {q.correct_answer}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(i)}>Edit</Button>
                      <Button size="sm" variant="ghost" className="text-bad" onClick={() => setItems((all) => all.filter((_, j) => j !== i))}>Remove</Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ol>
          {error && <Alert>{error}</Alert>}
          <div className="flex justify-end">
            <Button onClick={save} loading={busy === 'save'} disabled={items.length === 0} data-testid="save-import">
              Save {items.length} question{items.length === 1 ? '' : 's'} to test series
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
