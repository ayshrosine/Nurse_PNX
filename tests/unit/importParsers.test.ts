import { describe, expect, it } from 'vitest';
import { cleanText, parseCsvMcqs, parseHtmlMcqs, parseJsonMcqs, parseTextMcqs, resolveAnswer } from '@/lib/server/importParsers';

describe('cleanText', () => {
  it('strips tags and scripts but keeps plain characters', () => {
    expect(cleanText('<b>Hello</b> <script>alert(1)</script>world &amp; 5 &lt; 6')).toBe('Hello world & 5 < 6');
    expect(cleanText('<img src=x onerror=alert(1)>Dose')).toBe('Dose');
  });
});

describe('resolveAnswer', () => {
  const opts = ['Alpha', 'Beta', 'Gamma', 'Delta'];
  it.each([
    ['B', 'B'], ['b', 'B'], ['(c)', 'C'], ['Option D', 'D'], ['A) Alpha', 'A'], ['2', 'B'], ['gamma', 'C'], ['E', null], ['', null],
  ])('%s → %s', (input, expected) => expect(resolveAnswer(input, opts)).toBe(expected));
});

describe('parseTextMcqs', () => {
  it('parses numbered questions with multi-line text and explanations', () => {
    const r = parseTextMcqs(`1. Normal adult respiratory rate
is best described as:
A) 6–10 /min
B) 12–20 /min
C) 22–28 /min
D) 30–40 /min
Answer: B
Explanation: Adults breathe 12–20 times per minute.

Q2) Antidote for heparin?
(a) Vitamin K
(b) Protamine sulphate
(c) Naloxone
(d) Flumazenil
Ans: b`);
    expect(r.issues).toEqual([]);
    expect(r.questions).toHaveLength(2);
    expect(r.questions[0]).toMatchObject({ question_text: 'Normal adult respiratory rate is best described as:', correct_answer: 'B', explanation: 'Adults breathe 12–20 times per minute.' });
    expect(r.questions[1]).toMatchObject({ option_b: 'Protamine sulphate', correct_answer: 'B', explanation: null });
  });

  it('reports questions with missing answers or options', () => {
    const r = parseTextMcqs('1. Q?\nA) a\nB) b\nC) c\nD) d\n2. Q2?\nA) a\nB) b\nAnswer: A');
    expect(r.questions).toHaveLength(0);
    expect(r.issues.map((i) => i.message)).toEqual(['Correct answer missing or not one of A/B/C/D', 'Expected 4 options, found 2']);
  });
});

describe('parseHtmlMcqs', () => {
  it('parses structured markup and never keeps markup or scripts', () => {
    const html = `<div class="question"><p class="question-text">What is <b>BCG</b> route?<script>alert(1)</script></p>
      <ul><li class="option">IM</li><li class="option">SC</li><li class="option" data-correct>Intradermal</li><li class="option">Oral</li></ul>
      <p class="explanation">Explanation: BCG is intradermal.</p></div>`;
    const r = parseHtmlMcqs(html);
    expect(r.format).toBe('html-structured');
    expect(r.questions[0]).toMatchObject({ question_text: 'What is BCG route?', option_c: 'Intradermal', correct_answer: 'C', explanation: 'BCG is intradermal.' });
    expect(JSON.stringify(r)).not.toMatch(/script|alert|<b>/);
  });

  it('parses a question table', () => {
    const r = parseHtmlMcqs(`<table><tr><th>Question</th><th>A</th><th>B</th><th>C</th><th>D</th><th>Answer</th><th>Explanation</th></tr>
      <tr><td>Normal FHR?</td><td>80</td><td>110–160</td><td>200</td><td>60</td><td>B</td><td>Baseline 110–160.</td></tr></table>`);
    expect(r.format).toBe('html-table');
    expect(r.questions[0]).toMatchObject({ question_text: 'Normal FHR?', correct_answer: 'B', explanation: 'Baseline 110–160.' });
  });

  it('falls back to numbered text inside HTML', () => {
    const r = parseHtmlMcqs('<p>1. First step of nursing process?</p><p>A. Planning</p><p>B. Assessment</p><p>C. Evaluation</p><p>D. Diagnosis</p><p>Answer: B</p>');
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0].correct_answer).toBe('B');
  });
});

describe('JSON and CSV', () => {
  it('parses JSON arrays with option arrays or option_x keys', () => {
    const r = parseJsonMcqs(JSON.stringify({ questions: [
      { question: 'Q1?', options: ['a', 'b', 'c', 'd'], answer: 'd' },
      { question_text: 'Q2?', option_a: 'a', option_b: 'b', option_c: 'c', option_d: 'd', correct_answer: 'A', explanation: 'x' },
    ] }));
    expect(r.questions.map((q) => q.correct_answer)).toEqual(['D', 'A']);
  });

  it('rejects invalid JSON gracefully', () => {
    expect(parseJsonMcqs('{nope').issues[0].message).toMatch(/not valid JSON/);
  });

  it('parses CSV with quoted commas', () => {
    const r = parseCsvMcqs('question,option_a,option_b,option_c,option_d,correct_answer\n"Which, of these?",a,b,c,d,C\n');
    expect(r.questions[0]).toMatchObject({ question_text: 'Which, of these?', correct_answer: 'C' });
  });
});
