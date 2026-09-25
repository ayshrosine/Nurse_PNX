'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AnswerOption, StudentQuestion } from '@/types';
import { Alert, Button, Card, cx } from '@/components/ui';
import { LogoMark } from '@/components/navigation/Logo';
import { api, ApiClientError, errorMessage } from '@/lib/api';

interface StartResponse {
  attempt: { id: string; started_at: string; expires_at: string; server_now: string; duration_minutes: number; resumed: boolean };
  test: { id: string; title: string; instructions: string | null };
  questions: StudentQuestion[];
  saved_answers: { questionId: string; selectedAnswer: AnswerOption | null }[];
}

const LETTERS: AnswerOption[] = ['A', 'B', 'C', 'D'];

function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function TestRunner({
  testSeriesId,
  title,
  durationMinutes,
  questionCount,
  instructions,
}: {
  testSeriesId: string;
  title: string;
  durationMinutes: number;
  questionCount: number;
  instructions: string | null;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<'intro' | 'starting' | 'running' | 'submitting' | 'error'>('intro');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StartResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerOption | null>>({});
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(durationMinutes * 60_000);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'offline'>('idle');

  const clockOffset = useRef(0); // server_now - client_now, so the timer follows the server clock
  const dirty = useRef<Set<string>>(new Set());
  const submittedRef = useRef(false);

  const questions = useMemo(() => data?.questions ?? [], [data]);
  const current = questions[index];
  const storageKey = data ? `nlu-attempt-${data.attempt.id}` : null;

  // ---------------------------------------------------------------- start / resume
  async function begin() {
    setPhase('starting');
    setError(null);
    try {
      const res = await api<StartResponse>(`/api/tests/${testSeriesId}/start`, { method: 'POST' });
      clockOffset.current = new Date(res.attempt.server_now).getTime() - Date.now();
      const restored: Record<string, AnswerOption | null> = {};
      for (const a of res.saved_answers) restored[a.questionId] = a.selectedAnswer;
      // Local backup covers answers chosen after the last successful autosave (e.g. a refresh while offline).
      try {
        const local = JSON.parse(sessionStorage.getItem(`nlu-attempt-${res.attempt.id}`) ?? 'null');
        if (local?.answers) Object.assign(restored, local.answers);
        if (local?.marked) setMarked(new Set(local.marked));
      } catch {}
      setAnswers(restored);
      setVisited(new Set(res.questions[0] ? [res.questions[0].id] : []));
      setData(res);
      setRemaining(new Date(res.attempt.expires_at).getTime() - (Date.now() + clockOffset.current));
      setPhase('running');
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'PURCHASE_REQUIRED') return router.replace(`/unlock/${testSeriesId}`);
      if (err instanceof ApiClientError && err.code === 'PROFILE_INCOMPLETE') return router.replace(`/complete-profile?next=/tests/${testSeriesId}`);
      if (err instanceof ApiClientError && err.status === 401) return router.replace(`/login?next=/tests/${testSeriesId}`);
      setError(errorMessage(err));
      setPhase('error');
    }
  }

  // ---------------------------------------------------------------- submit
  const submit = useCallback(async (auto = false) => {
    if (!data || submittedRef.current) return;
    submittedRef.current = true;
    setConfirmOpen(false);
    setPhase('submitting');
    const payload = {
      attemptId: data.attempt.id,
      answers: data.questions.map((q) => ({ questionId: q.id, selectedAnswer: answers[q.id] ?? null })),
    };
    for (let tryNo = 0; tryNo < 3; tryNo++) {
      try {
        await api(`/api/tests/${testSeriesId}/submit`, { method: 'POST', json: payload });
        try { sessionStorage.removeItem(`nlu-attempt-${data.attempt.id}`); } catch {}
        router.replace(`/results/${data.attempt.id}`);
        return;
      } catch (err) {
        // Already submitted (e.g. double click or another tab) — the result exists.
        if (err instanceof ApiClientError && err.status === 409) {
          router.replace(`/results/${data.attempt.id}`);
          return;
        }
        if (tryNo === 2 || (err instanceof ApiClientError && err.status !== 0 && err.status < 500)) {
          submittedRef.current = false;
          setPhase('running');
          setError(`${auto ? 'Time is up, but the' : 'The'} submission failed: ${errorMessage(err)}. Your answers are saved — please try again.`);
          return;
        }
        await new Promise((r) => setTimeout(r, 1500 * (tryNo + 1)));
      }
    }
  }, [answers, data, router, testSeriesId]);

  // ---------------------------------------------------------------- timer
  useEffect(() => {
    if (phase !== 'running' || !data) return;
    const expires = new Date(data.attempt.expires_at).getTime();
    const tick = () => {
      const left = expires - (Date.now() + clockOffset.current);
      setRemaining(left);
      if (left <= 0) submit(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [phase, data, submit]);

  // ---------------------------------------------------------------- persistence
  useEffect(() => {
    if (!storageKey) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ answers, marked: [...marked] })); } catch {}
  }, [answers, marked, storageKey]);

  useEffect(() => {
    if (phase !== 'running' || !data || dirty.current.size === 0) return;
    const t = setTimeout(async () => {
      const ids = [...dirty.current];
      dirty.current.clear();
      setSaveState('saving');
      try {
        await api(`/api/tests/${testSeriesId}/answers`, {
          method: 'POST',
          json: { attemptId: data.attempt.id, answers: ids.map((id) => ({ questionId: id, selectedAnswer: answers[id] ?? null })) },
        });
        setSaveState('saved');
      } catch {
        ids.forEach((id) => dirty.current.add(id));
        setSaveState('offline');
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [answers, phase, data, testSeriesId]);

  useEffect(() => {
    if (phase !== 'running') return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase]);

  // ---------------------------------------------------------------- actions
  const choose = useCallback((qid: string, letter: AnswerOption) => {
    dirty.current.add(qid);
    setAnswers((prev) => ({ ...prev, [qid]: prev[qid] === letter ? null : letter }));
  }, []);

  const goTo = useCallback((i: number) => {
    if (!data) return;
    const next = Math.max(0, Math.min(data.questions.length - 1, i));
    setIndex(next);
    setVisited((v) => new Set(v).add(data.questions[next].id));
    setNavOpen(false);
  }, [data]);

  useEffect(() => {
    if (phase !== 'running' || !current || confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const k = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(k)) choose(current.id, k as AnswerOption);
      else if (['1', '2', '3', '4'].includes(k)) choose(current.id, LETTERS[Number(k) - 1]);
      else if (e.key === 'ArrowRight') goTo(index + 1);
      else if (e.key === 'ArrowLeft') goTo(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, current, index, confirmOpen, choose, goTo]);

  const counts = useMemo(() => {
    const answered = questions.filter((q) => answers[q.id]).length;
    return { answered, unanswered: questions.length - answered, marked: questions.filter((q) => marked.has(q.id)).length };
  }, [questions, answers, marked]);

  // ---------------------------------------------------------------- screens
  if (phase === 'intro' || phase === 'starting' || phase === 'error') {
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-10">
        <Link href={`/test-series/${testSeriesId}`} className="mb-6 flex items-center gap-2 text-sm text-muted hover:text-brand-600">
          <LogoMark className="size-6" /> ← Back to test details
        </Link>
        <Card className="p-7 sm:p-9">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Before you begin</div>
          <h1 className="mt-2 text-2xl font-semibold leading-snug">{title}</h1>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-sunken p-3"><div className="text-muted">Questions</div><div className="font-serif text-xl">{questionCount}</div></div>
            <div className="rounded-lg bg-sunken p-3"><div className="text-muted">Time limit</div><div className="font-serif text-xl">{durationMinutes} min</div></div>
          </div>
          {instructions && (
            <ul className="mt-5 space-y-1.5 text-sm text-ink-2">
              {instructions.split('\n').filter(Boolean).map((l, i) => <li key={i}>• {l}</li>)}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted">Tip: use keys A–D (or 1–4) to answer and ←/→ to move between questions.</p>
          {error && <Alert className="mt-5">{error}</Alert>}
          <Button size="lg" className="mt-6 w-full" onClick={begin} loading={phase === 'starting'} data-testid="begin-test">
            {phase === 'error' ? 'Try again' : 'Begin test'}
          </Button>
        </Card>
      </div>
    );
  }

  if (!data || !current) return null;
  const lowTime = remaining < 60_000;
  const q = current;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <LogoMark className="size-7 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{data.test.title}</div>
            <div className="text-xs text-muted">
              {counts.answered}/{questions.length} answered
              <span className="ml-2 hidden sm:inline">
                {saveState === 'saving' ? '· Saving…' : saveState === 'saved' ? '· All changes saved' : saveState === 'offline' ? '· Offline — will retry' : ''}
              </span>
            </div>
          </div>
          <div
            className={cx('rounded-lg px-3 py-1.5 font-mono text-base font-semibold tabular-nums', lowTime ? 'bg-bad-50 text-bad' : 'bg-sunken text-ink')}
            role="timer"
            aria-live={lowTime ? 'assertive' : 'off'}
            aria-label="Time remaining"
          >
            {formatClock(remaining)}
          </div>
          <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={phase === 'submitting'}>Submit</Button>
        </div>
        <div className="h-1 bg-sunken">
          <div className="h-1 bg-brand-500 transition-all" style={{ width: `${(counts.answered / questions.length) * 100}%` }} />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 lg:grid-cols-[1fr_280px]">
        {/* Question */}
        <section aria-labelledby="question-text">
          {error && <Alert className="mb-4">{error}</Alert>}
          <Card className="p-5 sm:p-8">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-muted">Question {index + 1} of {questions.length}</span>
              <button
                type="button"
                onClick={() => setMarked((m) => { const n = new Set(m); if (n.has(q.id)) n.delete(q.id); else n.add(q.id); return n; })}
                className={cx('flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors', marked.has(q.id) ? 'bg-warn-50 text-warn' : 'text-muted hover:bg-sunken')}
                aria-pressed={marked.has(q.id)}
              >
                <svg className="size-4" viewBox="0 0 20 20" fill={marked.has(q.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 3h10v14l-5-3.5L5 17z" /></svg>
                {marked.has(q.id) ? 'Marked for review' : 'Mark for review'}
              </button>
            </div>
            <p id="question-text" className="mt-5 font-serif text-lg leading-relaxed text-ink sm:text-xl">{q.question_text}</p>
            <div className="mt-6 space-y-2.5" role="radiogroup" aria-labelledby="question-text">
              {LETTERS.map((letter) => {
                const selected = answers[q.id] === letter;
                return (
                  <button
                    key={letter}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => choose(q.id, letter)}
                    className={cx(
                      'flex w-full items-start gap-3 rounded-lg border px-4 py-3.5 text-left transition-colors',
                      selected ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-line-strong hover:border-brand-200 hover:bg-sunken/60',
                    )}
                  >
                    <span className={cx('flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                      selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-line-strong text-ink-2')}>{letter}</span>
                    <span className="pt-0.5 text-[0.95rem] text-ink">{q[`option_${letter.toLowerCase()}` as 'option_a']}</span>
                  </button>
                );
              })}
            </div>
          </Card>
          <div className="mt-4 flex items-center justify-between gap-2">
            <Button variant="secondary" onClick={() => goTo(index - 1)} disabled={index === 0}>← Previous</Button>
            <Button variant="ghost" className="lg:hidden" onClick={() => setNavOpen(true)}>All questions</Button>
            {index < questions.length - 1 ? (
              <Button onClick={() => goTo(index + 1)}>Next →</Button>
            ) : (
              <Button onClick={() => setConfirmOpen(true)}>Finish</Button>
            )}
          </div>
        </section>

        {/* Navigator */}
        <aside className={cx('lg:block', navOpen ? 'fixed inset-0 z-30 flex items-end bg-ink/40 lg:static lg:bg-transparent' : 'hidden')} onClick={() => setNavOpen(false)}>
          <Card className="w-full rounded-b-none p-5 lg:sticky lg:top-24 lg:rounded-b-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-sans text-sm font-semibold">Questions</h2>
              <button type="button" className="text-sm text-muted lg:hidden" onClick={() => setNavOpen(false)}>Close</button>
            </div>
            <div className="mt-4 grid grid-cols-6 gap-2 lg:grid-cols-5">
              {questions.map((item, i) => {
                const answered = Boolean(answers[item.id]);
                const isMarked = marked.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`Question ${i + 1}${answered ? ', answered' : ''}${isMarked ? ', marked for review' : ''}`}
                    aria-current={i === index}
                    className={cx(
                      'relative flex aspect-square items-center justify-center rounded-md border text-sm font-medium tabular-nums transition-colors',
                      answered ? 'border-brand-600 bg-brand-600 text-white' : visited.has(item.id) ? 'border-line-strong bg-sunken text-ink-2' : 'border-line text-muted',
                      i === index && 'ring-2 ring-accent ring-offset-1',
                    )}
                  >
                    {i + 1}
                    {isMarked && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-warn ring-2 ring-surface" />}
                  </button>
                );
              })}
            </div>
            <ul className="mt-5 space-y-1.5 text-xs text-muted">
              <li className="flex items-center gap-2"><span className="size-3 rounded-sm bg-brand-600" /> Answered ({counts.answered})</li>
              <li className="flex items-center gap-2"><span className="size-3 rounded-sm border border-line-strong bg-sunken" /> Not answered ({counts.unanswered})</li>
              <li className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-warn" /> Marked for review ({counts.marked})</li>
            </ul>
          </Card>
        </aside>
      </div>

      {/* Submit confirmation */}
      {(confirmOpen || phase === 'submitting') && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="submit-title">
          <Card className="animate-fade-up w-full max-w-sm p-6">
            <h2 id="submit-title" className="text-xl font-semibold">{phase === 'submitting' ? 'Submitting…' : 'Submit your test?'}</h2>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg bg-brand-50 p-2"><dt className="text-xs text-brand-700">Answered</dt><dd className="font-serif text-xl">{counts.answered}</dd></div>
              <div className="rounded-lg bg-sunken p-2"><dt className="text-xs text-muted">Unanswered</dt><dd className="font-serif text-xl">{counts.unanswered}</dd></div>
              <div className="rounded-lg bg-warn-50 p-2"><dt className="text-xs text-warn">Marked</dt><dd className="font-serif text-xl">{counts.marked}</dd></div>
            </dl>
            {counts.unanswered > 0 && phase !== 'submitting' && (
              <p className="mt-3 text-sm text-muted">Unanswered questions score zero. You can go back and answer them.</p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              {phase !== 'submitting' && <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Keep working</Button>}
              <Button onClick={() => submit(false)} loading={phase === 'submitting'} data-testid="confirm-submit">Submit test</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
