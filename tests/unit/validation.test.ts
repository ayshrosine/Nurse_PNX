import { describe, expect, it } from 'vitest';
import { phoneSchema, profileUpdateSchema, questionInputSchema, submitSchema, testSeriesInputSchema } from '@/lib/validation';

describe('phoneSchema', () => {
  it.each([
    ['98765 43210', '+919876543210'],
    ['+91-98765-43210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['+14155550123', '+14155550123'],
  ])('normalises %s', (input, out) => expect(phoneSchema.parse(input)).toBe(out));

  it.each(['12345', '5876543210', 'abcdefghij', '', '+91 12345 67890'])('rejects %s', (input) =>
    expect(phoneSchema.safeParse(input).success).toBe(false));
});

describe('profileUpdateSchema', () => {
  it('rejects extra keys such as role', () => {
    expect(profileUpdateSchema.safeParse({ phone: '9876543210', role: 'ADMIN' }).success).toBe(false);
  });
});

describe('testSeriesInputSchema', () => {
  const base = { title: 'T', description: null, is_free: true, price: 0, duration_minutes: 10, instructions: null, status: 'DRAFT' };
  it('accepts a valid free test', () => expect(testSeriesInputSchema.safeParse(base).success).toBe(true));
  it('rejects a free test with a price', () => expect(testSeriesInputSchema.safeParse({ ...base, price: 5 }).success).toBe(false));
  it('rejects a paid test priced 0', () => expect(testSeriesInputSchema.safeParse({ ...base, is_free: false }).success).toBe(false));
  it('rejects zero duration and empty title', () => {
    expect(testSeriesInputSchema.safeParse({ ...base, duration_minutes: 0 }).success).toBe(false);
    expect(testSeriesInputSchema.safeParse({ ...base, title: '  ' }).success).toBe(false);
  });
  it('rejects an unknown status', () => expect(testSeriesInputSchema.safeParse({ ...base, status: 'LIVE' }).success).toBe(false));
});

describe('questionInputSchema', () => {
  const q = { question_text: 'Q', option_a: 'a', option_b: 'b', option_c: 'c', option_d: 'd', correct_answer: 'b' };
  it('upper-cases the answer', () => expect(questionInputSchema.parse(q).correct_answer).toBe('B'));
  it('rejects answers outside A–D', () => expect(questionInputSchema.safeParse({ ...q, correct_answer: 'E' }).success).toBe(false));
  it('requires every option', () => expect(questionInputSchema.safeParse({ ...q, option_d: '' }).success).toBe(false));
});

describe('submitSchema', () => {
  it('strips client-supplied score fields', () => {
    const parsed = submitSchema.parse({
      attemptId: '00000000-0000-4000-8000-000000000001',
      answers: [{ questionId: '00000000-0000-4000-8000-000000000002', selectedAnswer: 'A', isCorrect: true }],
      score: 100,
      percentage: 100,
    });
    expect(parsed).not.toHaveProperty('score');
    expect(parsed.answers[0]).not.toHaveProperty('isCorrect');
  });
});
