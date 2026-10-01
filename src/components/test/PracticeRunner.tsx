'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Card, cx } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { AnswerOption } from '@/types';

interface PracticeQuestion {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: AnswerOption;
  explanation: string | null;
  topic_name: string;
  subject_name: string;
}

const LETTERS: AnswerOption[] = ['A', 'B', 'C', 'D'];

export function PracticeRunner({ topicId }: { topicId: string }) {
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<AnswerOption | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState({ attempted: 0, correct: 0 });

  const fetchQuestions = useCallback(async (offset = 0) => {
    setLoading(true);
    try {
      const res = await api<{ questions: PracticeQuestion[]; total: number }>(
        `/api/practice?topicId=${topicId}&limit=10&offset=${offset}`,
      );
      setQuestions(res.questions);
      setTotal(res.total);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [topicId]);

  useEffect(() => { fetchQuestions(0); }, [fetchQuestions]);

  const q = questions[index];
  const topicName = questions[0]?.topic_name ?? 'Practice';
  const subjectName = questions[0]?.subject_name ?? '';

  const handleSelect = (letter: AnswerOption) => {
    if (revealed) return;
    setSelected(letter);
  };

  const handleCheck = async () => {
    if (!selected || !q) return;
    setRevealed(true);
    const isCorrect = selected === q.correct_answer;
    setStats((s) => ({ attempted: s.attempted + 1, correct: s.correct + (isCorrect ? 1 : 0) }));

    try {
      await api('/api/practice', {
        method: 'POST',
        json: { topicId, questionId: q.id, selectedAnswer: selected },
      });
    } catch {}
  };

  const handleNext = () => {
    if (index < questions.length - 1) {
      setIndex(index + 1);
    } else {
      // Load next batch
      fetchQuestions(index + 1);
      setIndex(0);
    }
    setSelected(null);
    setRevealed(false);
  };

  if (loading && questions.length === 0) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto size-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="mt-4 text-muted">Loading questions…</p>
        </div>
      </div>
    );
  }

  if (error || !q) {
    return (
      <div className="mx-auto max-w-xl py-16 px-4">
        <Alert>{error ?? 'No questions found for this topic yet.'}</Alert>
        <Link href="/exams" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
          ← Back to Exams
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Practice Mode</div>
          <h1 className="mt-1 text-xl font-semibold">{topicName}</h1>
          <p className="text-sm text-muted">{subjectName}</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted">Progress</div>
          <div className="font-serif text-2xl font-semibold tabular-nums">
            {stats.correct}/{stats.attempted}
          </div>
          <div className="text-xs text-muted">
            {stats.attempted > 0 ? `${Math.round((stats.correct / stats.attempted) * 100)}% accuracy` : 'Start practicing'}
          </div>
        </div>
      </div>

      {/* Question */}
      <Card className="p-6 sm:p-8">
        <div className="flex items-center justify-between text-sm text-muted mb-5">
          <span>Question {index + 1} of {questions.length}</span>
          <span>{total} total in this topic</span>
        </div>

        <p className="font-serif text-lg leading-relaxed text-ink sm:text-xl">{q.question_text}</p>

        <div className="mt-6 space-y-2.5" role="radiogroup">
          {LETTERS.map((letter) => {
            const isSelected = selected === letter;
            const isCorrect = revealed && letter === q.correct_answer;
            const isWrong = revealed && isSelected && letter !== q.correct_answer;

            return (
              <button
                key={letter}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleSelect(letter)}
                disabled={revealed}
                className={cx(
                  'flex w-full items-start gap-3 rounded-lg border px-4 py-3.5 text-left transition-all',
                  !revealed && isSelected && 'border-brand-500 bg-brand-50 ring-1 ring-brand-500',
                  !revealed && !isSelected && 'border-line-strong hover:border-brand-200 hover:bg-sunken/60',
                  isCorrect && 'border-ok bg-ok-50 ring-1 ring-ok',
                  isWrong && 'border-bad bg-bad-50 ring-1 ring-bad',
                  revealed && !isCorrect && !isWrong && 'border-line opacity-60',
                )}
              >
                <span className={cx(
                  'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                  !revealed && isSelected && 'border-brand-600 bg-brand-600 text-white',
                  !revealed && !isSelected && 'border-line-strong text-ink-2',
                  isCorrect && 'border-ok bg-ok text-white',
                  isWrong && 'border-bad bg-bad text-white',
                  revealed && !isCorrect && !isWrong && 'border-line-strong text-muted',
                )}>
                  {isCorrect ? '✓' : isWrong ? '✕' : letter}
                </span>
                <span className="pt-0.5 text-[0.95rem] text-ink">
                  {q[`option_${letter.toLowerCase()}` as 'option_a']}
                </span>
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {revealed && q.explanation && (
          <div className="mt-6 rounded-lg bg-brand-50 border border-brand-200/50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand-700 mb-2">Explanation</div>
            <p className="text-sm leading-relaxed text-ink-2">{q.explanation}</p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          {!revealed ? (
            <Button onClick={handleCheck} disabled={!selected} className="flex-1">
              Check Answer
            </Button>
          ) : (
            <Button onClick={handleNext} className="flex-1">
              {index < questions.length - 1 ? 'Next Question →' : 'Load More Questions →'}
            </Button>
          )}
        </div>
      </Card>

      {/* Stats bar */}
      {stats.attempted > 0 && (
        <div className="mt-6 flex items-center justify-between rounded-lg bg-sunken p-4 text-sm">
          <span className="text-muted">Session: {stats.attempted} attempted</span>
          <div className="flex gap-4">
            <span className="text-ok font-medium">{stats.correct} correct</span>
            <span className="text-bad font-medium">{stats.attempted - stats.correct} incorrect</span>
          </div>
        </div>
      )}
    </div>
  );
}
