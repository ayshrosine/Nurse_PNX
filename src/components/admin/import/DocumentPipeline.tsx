'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DocumentRow, DocumentStatus, PlatformSettings, Question } from '@/types';
import { Alert, Button, Card, Input, Select, Spinner, StatusBadge, cx } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { QuestionEditor } from '../QuestionEditor';

type DocDetail = DocumentRow & { text_preview: string | null; text_length: number | null };
type Availability = Record<string, boolean>;

const STEPS: { key: string; label: string; done: DocumentStatus[]; active: DocumentStatus[] }[] = [
  { key: 'upload', label: 'Uploaded', done: ['UPLOADED', 'EXTRACTING', 'EXTRACTED', 'EXTRACT_FAILED', 'GENERATING', 'GENERATED', 'GENERATE_FAILED', 'APPROVED'], active: [] },
  { key: 'extract', label: 'Text extracted', done: ['EXTRACTED', 'GENERATING', 'GENERATED', 'GENERATE_FAILED', 'APPROVED'], active: ['EXTRACTING'] },
  { key: 'generate', label: 'Questions drafted', done: ['GENERATED', 'APPROVED'], active: ['GENERATING'] },
  { key: 'approve', label: 'Approved', done: ['APPROVED'], active: [] },
];

const MAX_BYTES = 25 * 1024 * 1024;

export function DocumentPipeline({ seriesId, initialDocs, settings: initialSettings, availability }: {
  seriesId: string;
  initialDocs: DocumentRow[];
  settings: PlatformSettings;
  availability: Availability;
}) {
  const [docs, setDocs] = useState(initialDocs);
  const [selected, setSelected] = useState<string | null>(initialDocs[0]?.id ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState(initialSettings);
  const [dragOver, setDragOver] = useState(false);

  const reloadList = useCallback(async () => {
    setDocs(await api<DocumentRow[]>(`/api/admin/test-series/${seriesId}/documents`));
  }, [seriesId]);

  async function upload(file: File) {
    setError(null);
    const ext = file.name.toLowerCase().split('.').pop();
    if (!['pdf', 'docx', 'html', 'htm'].includes(ext ?? '')) return setError('Only .pdf, .docx and .html files are accepted.');
    if (file.size > MAX_BYTES) return setError('Files must be 25 MB or smaller.');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('testSeriesId', seriesId);
      const doc = await api<DocumentRow>('/api/admin/documents/upload', { method: 'POST', body: form });
      await api(`/api/admin/documents/${doc.id}/extract`, { method: 'POST', json: {} });
      await reloadList();
      setSelected(doc.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function saveSetting(patch: Partial<PlatformSettings>) {
    const res = await api<{ settings: PlatformSettings }>('/api/admin/settings', { method: 'PUT', json: patch });
    setSettings(res.settings);
  }

  return (
    <Card className="p-6">
      <h2 className="font-sans text-base font-semibold">Generate from a document</h2>
      <p className="mt-1 text-sm text-muted">
        Upload study material (.pdf, .docx, .html). Text is extracted (OCR for scanned PDFs), then MCQs are drafted by AI —
        or parsed directly if the document already contains questions. Drafts stay hidden from students until you approve them.
      </p>

      <div className="mt-5 grid gap-4 rounded-lg border border-line bg-sunken/50 p-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium">OCR engine</span>
          <Select className="mt-1" value={settings.ocr_provider} onChange={(e) => saveSetting({ ocr_provider: e.target.value as PlatformSettings['ocr_provider'] })}>
            <option value="tesseract">Tesseract.js — free, self-hosted (default)</option>
            <option value="ocrspace">OCR.space — free tier, better on poor scans{availability.ocrspace ? '' : ' (demo key)'}</option>
          </Select>
        </label>
        <label className="text-sm">
          <span className="font-medium">MCQ generator</span>
          <Select className="mt-1" value={settings.ai_provider} onChange={(e) => saveSetting({ ai_provider: e.target.value as PlatformSettings['ai_provider'] })}>
            <option value="gemini">Gemini Flash — best quality{availability.gemini ? '' : ' (not configured)'}</option>
            <option value="groq">Groq Llama — fastest{availability.groq ? '' : ' (not configured)'}</option>
          </Select>
        </label>
        {!availability.gemini && !availability.groq && (
          <p className="text-xs text-warn sm:col-span-2">
            No AI key is configured (GEMINI_API_KEY / GROQ_API_KEY). You can still use “Parse existing MCQs” for documents that already contain questions.
          </p>
        )}
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
        className={cx('mt-5 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors',
          dragOver ? 'border-brand-500 bg-brand-50' : 'border-line-strong bg-paper hover:border-brand-500')}
      >
        {uploading ? <Spinner className="size-6 text-brand-600" /> : <span className="text-sm font-medium text-ink">Drop a file here, or click to choose</span>}
        <span className="mt-1 text-xs text-muted">.pdf, .docx or .html · up to 25 MB</span>
        <input type="file" accept=".pdf,.docx,.html,.htm" className="sr-only" disabled={uploading} data-testid="document-file"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
      </label>
      {error && <Alert className="mt-4">{error}</Alert>}

      {docs.length > 0 && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[240px_1fr]">
          <ul className="space-y-1" aria-label="Documents">
            {docs.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => setSelected(d.id)}
                  className={cx('w-full rounded-lg border px-3 py-2 text-left text-sm', selected === d.id ? 'border-brand-200 bg-brand-50' : 'border-transparent hover:bg-sunken')}>
                  <div className="truncate font-medium">{d.original_filename}</div>
                  <div className="mt-1 flex items-center justify-between gap-2"><StatusBadge status={d.status} />{d.pending_count ? <span className="text-xs text-muted">{d.pending_count} drafts</span> : null}</div>
                </button>
              </li>
            ))}
          </ul>
          {selected && <DocumentPanel key={selected} id={selected} seriesId={seriesId} onChange={reloadList} onDeleted={() => { setSelected(null); reloadList(); }} />}
        </div>
      )}
    </Card>
  );
}

function DocumentPanel({ id, seriesId, onChange, onDeleted }: { id: string; seriesId: string; onChange: () => void; onDeleted: () => void }) {
  const router = useRouter();
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [drafts, setDrafts] = useState<Question[]>([]);
  const [count, setCount] = useState(20);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);
  const lastStatus = useRef<DocumentStatus | null>(null);

  const load = useCallback(async () => {
    const d = await api<DocDetail>(`/api/admin/documents/${id}`);
    setDoc(d);
    if (lastStatus.current && lastStatus.current !== d.status) onChange();
    lastStatus.current = d.status;
    if (['GENERATED', 'APPROVED', 'GENERATE_FAILED'].includes(d.status)) setDrafts(await api<Question[]>(`/api/admin/documents/${id}/preview`));
    return d;
  }, [id, onChange]);

  useEffect(() => {
    Promise.resolve().then(load).catch((e) => setError(errorMessage(e)));
  }, [load]);

  // Poll while a background step is running (Frontend doc §14 step 2).
  useEffect(() => {
    if (!doc || !['EXTRACTING', 'GENERATING'].includes(doc.status)) return;
    const t = setInterval(() => load().catch(() => {}), 2000);
    return () => clearInterval(t);
  }, [doc, load]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (!doc) return <div className="flex items-center justify-center p-10"><Spinner className="text-brand-600" /></div>;
  const working = doc.status === 'EXTRACTING' || doc.status === 'GENERATING';
  const pending = drafts.filter((d) => d.review_status === 'PENDING_REVIEW');
  const canGenerate = ['EXTRACTED', 'GENERATED', 'GENERATE_FAILED'].includes(doc.status);

  return (
    <div className="min-w-0 rounded-lg border border-line p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{doc.original_filename}</div>
          <div className="text-xs text-muted">
            {doc.file_type} · {(doc.size_bytes / 1024).toFixed(0)} KB · {formatDateTime(doc.created_at)}
            {doc.ocr_provider && ` · OCR: ${doc.ocr_provider}`}{doc.ai_provider && ` · ${doc.ai_provider}`}
          </div>
        </div>
        {!working && (
          <Button size="sm" variant="ghost" className="text-bad" onClick={() => run('delete', async () => {
            if (!confirm('Delete this document and its unapproved drafts? Approved questions stay in the test series.')) return;
            await api(`/api/admin/documents/${id}`, { method: 'DELETE' });
            onDeleted();
          })}>Delete</Button>
        )}
      </div>

      <ol className="mt-4 flex flex-wrap gap-2" aria-label="Pipeline status">
        {STEPS.map((s) => {
          const done = s.done.includes(doc.status);
          const active = s.active.includes(doc.status);
          const failed = (s.key === 'extract' && doc.status === 'EXTRACT_FAILED') || (s.key === 'generate' && doc.status === 'GENERATE_FAILED');
          return (
            <li key={s.key} className={cx('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
              failed ? 'bg-bad-50 text-bad' : done ? 'bg-ok-50 text-ok' : active ? 'bg-brand-50 text-brand-700' : 'bg-sunken text-muted')}>
              {active ? <Spinner className="size-3" /> : failed ? '✕' : done ? '✓' : '○'} {s.label}
            </li>
          );
        })}
      </ol>

      {doc.error_message && <Alert className="mt-4" title="Last step failed">{doc.error_message}</Alert>}
      {error && <Alert className="mt-4">{error}</Alert>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {['UPLOADED', 'EXTRACT_FAILED'].includes(doc.status) && (
          <Button size="sm" loading={busy === 'extract'} onClick={() => run('extract', () => api(`/api/admin/documents/${id}/extract`, { method: 'POST', json: {} }))}>
            {doc.status === 'EXTRACT_FAILED' ? 'Retry extraction' : 'Extract text'}
          </Button>
        )}
        {canGenerate && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted">Questions</span>
              <Input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Number(e.target.value))} className="h-8 w-20" />
            </label>
            <Button size="sm" loading={busy === 'ai'} onClick={() => run('ai', () => api(`/api/admin/documents/${id}/generate`, { method: 'POST', json: { mode: 'ai', count } }))}>
              {doc.status === 'GENERATED' ? 'Regenerate with AI' : 'Generate with AI'}
            </Button>
            <Button size="sm" variant="secondary" loading={busy === 'parse'} onClick={() => run('parse', () => api(`/api/admin/documents/${id}/generate`, { method: 'POST', json: { mode: 'parse' } }))}>
              Parse existing MCQs
            </Button>
          </>
        )}
        {doc.text_preview && (
          <Button size="sm" variant="ghost" onClick={() => setShowText((s) => !s)}>{showText ? 'Hide' : 'Show'} extracted text</Button>
        )}
      </div>

      {showText && doc.text_preview && (
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-sunken p-3 text-xs text-ink-2">
          {doc.text_preview}{(doc.text_length ?? 0) > doc.text_preview.length && `\n… (${doc.text_length} characters total)`}
        </pre>
      )}

      {drafts.length > 0 && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-sans text-sm font-semibold">Review drafts <span className="text-muted">({pending.length} pending)</span></h3>
            {pending.length > 0 && (
              <Button size="sm" loading={busy === 'approve'} data-testid="approve-drafts"
                onClick={() => run('approve', async () => {
                  await api(`/api/admin/documents/${id}/approve`, { method: 'POST', json: {} });
                  onChange();
                  router.push(`/admin/test-series/${seriesId}/questions`);
                  router.refresh();
                })}>
                Approve {pending.length} &amp; add to test series
              </Button>
            )}
          </div>
          <ol className="mt-3 space-y-2">
            {drafts.map((q, i) => (
              <li key={q.id} className={cx('rounded-lg border p-4', q.review_status === 'REJECTED' ? 'border-line bg-sunken/60 opacity-70' : 'border-line')}>
                {editing === q.id ? (
                  <QuestionEditor idPrefix={q.id} initial={q} onCancel={() => setEditing(null)}
                    onSave={async (input) => { await api(`/api/admin/questions/${q.id}`, { method: 'PUT', json: input }); setEditing(null); await load(); }} />
                ) : (
                  <div className="flex gap-3 text-sm">
                    <span className="font-semibold text-muted">{i + 1}.</span>
                    <div className="min-w-0 flex-1">
                      <p className={cx('font-medium', q.review_status === 'REJECTED' ? 'text-muted line-through' : 'text-ink')}>{q.question_text}</p>
                      <ul className="mt-1.5 grid gap-0.5 text-xs sm:grid-cols-2">
                        {(['A', 'B', 'C', 'D'] as const).map((l) => (
                          <li key={l} className={q.correct_answer === l ? 'font-medium text-ok' : 'text-ink-2'}>{l}) {q[`option_${l.toLowerCase()}` as 'option_a']}</li>
                        ))}
                      </ul>
                      {q.explanation && <p className="mt-1.5 text-xs text-muted">{q.explanation}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {q.review_status === 'PENDING_REVIEW' ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(q.id)}>Edit</Button>
                          <Button size="sm" variant="ghost" className="text-bad" onClick={() => run(`rej-${q.id}`, () => api(`/api/admin/questions/${q.id}/review`, { method: 'POST', json: { status: 'REJECTED' } }))}>Reject</Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => run(`res-${q.id}`, () => api(`/api/admin/questions/${q.id}/review`, { method: 'POST', json: { status: 'PENDING_REVIEW' } }))}>Restore</Button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
