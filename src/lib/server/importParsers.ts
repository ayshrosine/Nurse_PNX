// Server-side parsers for question imports (PRD §6.9, §35). Uploaded content is never rendered or executed:
// HTML is parsed with cheerio, reduced to plain text, and every extracted field is stripped of markup.
import * as cheerio from 'cheerio';
import sanitizeHtml from 'sanitize-html';
import Papa from 'papaparse';
import { questionInputSchema, type QuestionInput } from '../validation';

export interface ParseIssue {
  index: number;
  message: string;
  excerpt: string;
}

export interface ParseResult {
  questions: QuestionInput[];
  issues: ParseIssue[];
  format: 'html-structured' | 'html-table' | 'text' | 'json' | 'csv';
}

const ENTITY_MAP: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&#39;': "'" };

/** Removes all markup and control characters, collapses whitespace. Output is plain text only. */
export function cleanText(input: unknown): string {
  if (input === null || input === undefined) return '';
  const stripped = sanitizeHtml(String(input), { allowedTags: [], allowedAttributes: {}, disallowedTagsMode: 'discard' });
  return stripped
    .replace(/&(lt|gt|amp|quot|#39);/g, (m) => ENTITY_MAP[m])
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface RawQuestion {
  question?: string;
  options: string[];
  answer?: string;
  explanation?: string;
}

function finalize(raw: RawQuestion[], format: ParseResult['format']): ParseResult {
  const questions: QuestionInput[] = [];
  const issues: ParseIssue[] = [];
  raw.forEach((r, i) => {
    const question = cleanText(r.question);
    const options = r.options.map(cleanText);
    const excerpt = question.slice(0, 120) || options.join(' / ').slice(0, 120);
    if (options.length !== 4) {
      issues.push({ index: i + 1, message: `Expected 4 options, found ${options.length}`, excerpt });
      return;
    }
    const answer = resolveAnswer(cleanText(r.answer), options);
    if (!answer) {
      issues.push({ index: i + 1, message: 'Correct answer missing or not one of A/B/C/D', excerpt });
      return;
    }
    const parsed = questionInputSchema.safeParse({
      question_text: question,
      option_a: options[0],
      option_b: options[1],
      option_c: options[2],
      option_d: options[3],
      correct_answer: answer,
      explanation: cleanText(r.explanation) || null,
    });
    if (!parsed.success) {
      issues.push({ index: i + 1, message: parsed.error.issues[0]?.message ?? 'Invalid question', excerpt });
      return;
    }
    questions.push(parsed.data);
  });
  return { questions, issues, format };
}

/** Accepts "B", "b", "(b)", "Option B", "B) text", "2" or the full text of the correct option. */
export function resolveAnswer(answer: string, options: string[]): 'A' | 'B' | 'C' | 'D' | null {
  if (!answer) return null;
  const a = answer.trim();
  const letter = a.match(/^(?:option\s*)?\(?([a-d])\)?(?:[.):\s]|$)/i);
  if (letter) return letter[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
  if (/^[1-4]$/.test(a)) return (['A', 'B', 'C', 'D'] as const)[Number(a) - 1];
  const idx = options.findIndex((o) => o.toLowerCase() === a.toLowerCase());
  return idx >= 0 ? (['A', 'B', 'C', 'D'] as const)[idx] : null;
}

// ------------------------------------------------------------------ plain text

const Q_START = /^(?:Q(?:uestion)?\s*)?(\d{1,4})\s*[.):\-]\s*(.+)$/i;
const OPTION = /^\(?([A-Da-d])\s*[).:\-]\s*(.+)$/;
const ANSWER = /^(?:correct\s*)?(?:answer|ans|key)\s*[:.\-]\s*(.+)$/i;
const EXPLANATION = /^(?:explanation|rationale|reason)\s*[:.\-]\s*(.+)$/i;

/**
 * Parses the common exam format:
 *   1. Question text
 *   A) option   (also "a.", "(a)", "A:")
 *   ...
 *   Answer: B
 *   Explanation: optional
 */
export function parseTextMcqs(text: string): ParseResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const raw: RawQuestion[] = [];
  let current: RawQuestion | null = null;
  let lastField: 'question' | 'option' | 'explanation' | null = null;

  for (const line of lines) {
    const ans = line.match(ANSWER);
    const exp = line.match(EXPLANATION);
    const opt = line.match(OPTION);
    const q = line.match(Q_START);
    if (current && ans) {
      current.answer = ans[1];
      lastField = null;
    } else if (current && exp) {
      current.explanation = exp[1];
      lastField = 'explanation';
    } else if (current && opt && current.options.length < 4 && current.answer === undefined) {
      current.options.push(opt[2]);
      lastField = 'option';
    } else if (q) {
      current = { question: q[2], options: [] };
      raw.push(current);
      lastField = 'question';
    } else if (current && lastField === 'question' && current.options.length === 0) {
      current.question += ` ${line}`;
    } else if (current && lastField === 'explanation') {
      current.explanation += ` ${line}`;
    } else if (current && lastField === 'option') {
      current.options[current.options.length - 1] += ` ${line}`;
    }
  }
  return finalize(raw, 'text');
}

// ------------------------------------------------------------------ HTML

const BLOCK_TAGS = 'p, div, li, br, tr, h1, h2, h3, h4, h5, h6, section, article, td, th, dt, dd, pre, blockquote';

export function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, noscript, iframe, object, embed, template, svg, head').remove();
  $(BLOCK_TAGS).each((_, el) => {
    $(el).prepend('\n').append('\n');
  });
  return $.root().text().replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n');
}

/**
 * Supported HTML layouts, tried in order:
 * 1. Structured: elements with class "question" (or [data-question]) containing .question-text, .option×4,
 *    and either .answer or an option marked [data-correct] / .correct.
 * 2. Table: a header row with Question | A | B | C | D | Answer [| Explanation].
 * 3. Plain numbered text (see parseTextMcqs).
 */
export function parseHtmlMcqs(html: string): ParseResult {
  const $ = cheerio.load(html);
  $('script, style, noscript, iframe, object, embed, template').remove();

  const blocks = $('.question, [data-question]').filter((_, el) => $(el).find('.option, [data-option]').length > 0);
  if (blocks.length > 0) {
    const raw: RawQuestion[] = blocks.toArray().map((el) => {
      const block = $(el);
      const optionEls = block.find('.option, [data-option]').toArray();
      const correctIdx = optionEls.findIndex((o) => $(o).is('[data-correct], .correct') && $(o).attr('data-correct') !== 'false');
      const questionText = block.find('.question-text, [data-question-text], .stem').first().text() ||
        block.clone().children('.option, [data-option], .answer, .explanation, ul, ol').remove().end().text();
      return {
        question: questionText,
        options: optionEls.map((o) => $(o).text().replace(/^\s*\(?[A-Da-d][).:]\s*/, '')),
        answer: correctIdx >= 0 ? 'ABCD'[correctIdx] : block.find('.answer, [data-answer]').first().text().replace(/^\s*(answer|ans)\s*[:.\-]\s*/i, ''),
        explanation: block.find('.explanation, [data-explanation]').first().text().replace(/^\s*explanation\s*[:.\-]\s*/i, ''),
      };
    });
    return finalize(raw, 'html-structured');
  }

  const table = $('table').filter((_, t) => {
    const header = $(t).find('tr').first().text().toLowerCase();
    return header.includes('question') && header.includes('answer');
  }).first();
  if (table.length) {
    const rows = table.find('tr').toArray();
    const headers = $(rows[0]).find('th, td').toArray().map((c) => $(c).text().trim().toLowerCase());
    const col = (names: string[]) => headers.findIndex((h) => names.includes(h.replace(/^option\s*/, '')));
    const idx = {
      q: headers.findIndex((h) => h.includes('question')),
      a: col(['a']), b: col(['b']), c: col(['c']), d: col(['d']),
      ans: headers.findIndex((h) => h.includes('answer') || h === 'correct'),
      exp: headers.findIndex((h) => h.includes('explanation') || h.includes('rationale')),
    };
    const raw = rows.slice(1).map((r) => {
      const cells = $(r).find('td, th').toArray().map((c) => $(c).text());
      return {
        question: cells[idx.q],
        options: [cells[idx.a], cells[idx.b], cells[idx.c], cells[idx.d]].filter((x) => x !== undefined),
        answer: cells[idx.ans],
        explanation: idx.exp >= 0 ? cells[idx.exp] : undefined,
      };
    }).filter((r) => cleanText(r.question));
    return finalize(raw, 'html-table');
  }

  const result = parseTextMcqs(htmlToText(html));
  return { ...result, format: 'text' };
}

// ------------------------------------------------------------------ JSON / CSV

type Loose = Record<string, unknown>;
const pick = (o: Loose, keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return String(o[k]);
  return undefined;
};

function fromLooseObject(o: Loose): RawQuestion {
  const lower: Loose = Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase().replace(/[\s-]+/g, '_'), v]));
  const optionsArray = Array.isArray(lower.options) ? (lower.options as unknown[]).map(String) : null;
  return {
    question: pick(lower, ['question_text', 'question', 'q', 'stem']),
    options: optionsArray ?? [
      pick(lower, ['option_a', 'a', 'optiona']),
      pick(lower, ['option_b', 'b', 'optionb']),
      pick(lower, ['option_c', 'c', 'optionc']),
      pick(lower, ['option_d', 'd', 'optiond']),
    ].filter((x): x is string => x !== undefined),
    answer: pick(lower, ['correct_answer', 'answer', 'correct', 'ans', 'key']),
    explanation: pick(lower, ['explanation', 'rationale', 'reason']),
  };
}

export function parseJsonMcqs(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { questions: [], issues: [{ index: 0, message: 'File is not valid JSON', excerpt: '' }], format: 'json' };
  }
  const list = Array.isArray(data) ? data : Array.isArray((data as Loose)?.questions) ? ((data as Loose).questions as unknown[]) : null;
  if (!list) {
    return { questions: [], issues: [{ index: 0, message: 'Expected an array of questions or { "questions": [...] }', excerpt: '' }], format: 'json' };
  }
  return finalize(list.filter((x): x is Loose => typeof x === 'object' && x !== null).map(fromLooseObject), 'json');
}

export function parseCsvMcqs(text: string): ParseResult {
  const parsed = Papa.parse<Loose>(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: true });
  if (!parsed.meta.fields?.some((f) => /question/i.test(f))) {
    return { questions: [], issues: [{ index: 0, message: 'CSV needs a header row with question, option_a…option_d, correct_answer', excerpt: '' }], format: 'csv' };
  }
  return finalize(parsed.data.map(fromLooseObject), 'csv');
}

export function parseImportFile(filename: string, content: string): ParseResult {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'json') return parseJsonMcqs(content);
  if (ext === 'csv') return parseCsvMcqs(content);
  if (ext === 'txt') return parseTextMcqs(content);
  return parseHtmlMcqs(content);
}
