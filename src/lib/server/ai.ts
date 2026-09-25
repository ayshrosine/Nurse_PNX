import 'server-only';
import { z } from 'zod';
import { questionInputSchema, type QuestionInput } from '../validation';
import { cleanText } from './importParsers';

// MCQ generation from extracted document text (Architecture doc §7 Step C).
// Gemini Flash is the default; Groq is used as an automatic fallback when Gemini fails or is unconfigured.

export type AiProvider = 'gemini' | 'groq';

const MAX_INPUT_CHARS = 60_000;

const aiQuestionSchema = z.object({
  question: z.string(),
  option_a: z.string(),
  option_b: z.string(),
  option_c: z.string(),
  option_d: z.string(),
  correct_answer: z.string(),
  explanation: z.string().optional().nullable(),
});

function buildPrompt(text: string, count: number) {
  return [
    `You are an experienced nursing educator writing exam multiple-choice questions for nursing students in India.`,
    `Using ONLY facts stated in the source text below, write exactly ${count} distinct MCQs.`,
    `Rules:`,
    `- Each question has exactly four options and exactly one correct answer.`,
    `- correct_answer must be one of "A", "B", "C", "D" (the letter of the correct option).`,
    `- Keep options similar in length and plausible; avoid "all of the above".`,
    `- explanation: one or two sentences explaining why the answer is correct.`,
    `Return ONLY a JSON array of objects with keys: question, option_a, option_b, option_c, option_d, correct_answer, explanation.`,
    ``,
    `SOURCE TEXT:`,
    `"""`,
    text.slice(0, MAX_INPUT_CHARS),
    `"""`,
  ].join('\n');
}

export class AiError extends Error {}

function parseAiJson(raw: string): QuestionInput[] {
  // Tolerate ```json fences or leading prose around the array.
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start < 0 || end <= start) throw new AiError('The AI response did not contain a JSON array');
  let data: unknown;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new AiError('The AI response was not valid JSON');
  }
  const list = z.array(aiQuestionSchema).safeParse(data);
  if (!list.success) throw new AiError('The AI response did not match the expected question format');
  const valid: QuestionInput[] = [];
  for (const q of list.data) {
    const parsed = questionInputSchema.safeParse({
      question_text: cleanText(q.question),
      option_a: cleanText(q.option_a),
      option_b: cleanText(q.option_b),
      option_c: cleanText(q.option_c),
      option_d: cleanText(q.option_d),
      correct_answer: cleanText(q.correct_answer).replace(/[^A-Da-d]/g, '').slice(0, 1),
      explanation: cleanText(q.explanation) || null,
    });
    if (parsed.success) valid.push(parsed.data);
  }
  if (valid.length === 0) throw new AiError('The AI returned no usable questions');
  return valid;
}

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AiError('GEMINI_API_KEY is not configured');
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new AiError(`Gemini request failed (${res.status})`);
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
}

async function callGroq(prompt: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new AiError('GROQ_API_KEY is not configured');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      temperature: 0.4,
      messages: [
        { role: 'system', content: 'You output only valid JSON arrays. No prose.' },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new AiError(`Groq request failed (${res.status})`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? '';
}

const CALLERS: Record<AiProvider, (p: string) => Promise<string>> = { gemini: callGemini, groq: callGroq };

async function generateWith(provider: AiProvider, prompt: string) {
  // One retry on malformed output (Backend doc §7.3).
  try {
    return parseAiJson(await CALLERS[provider](prompt));
  } catch (err) {
    if (!(err instanceof AiError) || /not configured|request failed/.test(err.message)) throw err;
    return parseAiJson(await CALLERS[provider](prompt));
  }
}

export async function generateMcqs(text: string, count: number, preferred: AiProvider) {
  const prompt = buildPrompt(text, count);
  const order: AiProvider[] = preferred === 'gemini' ? ['gemini', 'groq'] : ['groq', 'gemini'];
  const errors: string[] = [];
  for (const provider of order) {
    try {
      const questions = await generateWith(provider, prompt);
      return { provider, questions: questions.slice(0, count) };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  throw new AiError(errors.join(' · '));
}
