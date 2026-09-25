import { describe, expect, it } from 'vitest';
import { scoreAttempt } from '@/lib/server/scoring';
import type { AnswerOption } from '@/types';

const key = new Map<string, AnswerOption>([['q1', 'A'], ['q2', 'B'], ['q3', 'C'], ['q4', 'D']]);
const ids = ['q1', 'q2', 'q3', 'q4'];

describe('scoreAttempt', () => {
  it('counts correct, incorrect and unanswered', () => {
    const r = scoreAttempt(ids, key, new Map<string, AnswerOption | null>([['q1', 'A'], ['q2', 'C'], ['q3', null]]));
    expect(r).toMatchObject({ total: 4, correct: 1, incorrect: 1, unanswered: 2, score: 1, percentage: 25 });
    expect(r.answers.map((a) => a.isCorrect)).toEqual([true, false, null, null]);
  });

  it('ignores selections for questions not in the attempt', () => {
    const r = scoreAttempt(['q1'], key, new Map<string, AnswerOption | null>([['q1', 'A'], ['q2', 'B'], ['evil', 'A']]));
    expect(r).toMatchObject({ total: 1, correct: 1, percentage: 100 });
    expect(r.answers).toHaveLength(1);
  });

  it('rounds percentage to 2 decimals', () => {
    const r = scoreAttempt(['q1', 'q2', 'q3'], key, new Map<string, AnswerOption | null>([['q1', 'A']]));
    expect(r.percentage).toBe(33.33);
  });

  it('handles an empty attempt without dividing by zero', () => {
    expect(scoreAttempt([], key, new Map()).percentage).toBe(0);
  });
});
