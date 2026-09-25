// Zod schemas shared by client forms (instant feedback) and Route Handlers (authoritative validation).
import { z } from 'zod';

export const uuidSchema = z.uuid({ message: 'Invalid id' });

export const answerOptionSchema = z.enum(['A', 'B', 'C', 'D']);
export const testStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export const purchaseStatusSchema = z.enum(['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED']);
export const attemptStatusSchema = z.enum(['IN_PROGRESS', 'COMPLETED', 'ABANDONED']);

/** Normalises common Indian formats ("98765 43210", "+91-9876543210", "09876543210") to E.164-ish. */
export function normalizePhone(raw: string): string {
  let p = raw.replace(/[\s\-().]/g, '');
  if (/^0[6-9]\d{9}$/.test(p)) p = p.slice(1);
  if (/^[6-9]\d{9}$/.test(p)) p = `+91${p}`;
  if (/^91[6-9]\d{9}$/.test(p)) p = `+${p}`;
  return p;
}

export const phoneSchema = z
  .string({ message: 'Phone number is required' })
  .trim()
  .min(1, 'Phone number is required')
  .transform(normalizePhone)
  // After normalisation, anything without a "+" country code was not a valid Indian mobile.
  .refine((p) => /^\+[0-9]{10,15}$/.test(p), 'Enter a valid phone number, e.g. 98765 43210')
  .refine((p) => !p.startsWith('+91') || /^\+91[6-9]\d{9}$/.test(p), 'Enter a valid 10-digit Indian mobile number');

export const profileUpdateSchema = z.object({ phone: phoneSchema }).strict();

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const testSeriesBaseSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be at most 200 characters'),
  description: optionalText(5000),
  is_free: z.boolean(),
  price: z.coerce.number().min(0, 'Price must be 0 or more').max(100000, 'Price is too high'),
  currency: z.literal('INR').default('INR'),
  duration_minutes: z.coerce
    .number()
    .int('Duration must be a whole number of minutes')
    .min(1, 'Duration must be greater than 0')
    .max(600, 'Duration must be at most 600 minutes'),
  instructions: optionalText(10000),
  status: testStatusSchema.default('DRAFT'),
});

export const testSeriesInputSchema = testSeriesBaseSchema
  .refine((v) => !v.is_free || v.price === 0, { message: 'Free tests must have price 0', path: ['price'] })
  .refine((v) => v.is_free || v.price > 0, { message: 'Paid tests need a price above 0', path: ['price'] });

export type TestSeriesInput = z.infer<typeof testSeriesInputSchema>;

export const questionInputSchema = z.object({
  question_text: z.string().trim().min(1, 'Question is required').max(5000),
  option_a: z.string().trim().min(1, 'Option A is required').max(1000),
  option_b: z.string().trim().min(1, 'Option B is required').max(1000),
  option_c: z.string().trim().min(1, 'Option C is required').max(1000),
  option_d: z.string().trim().min(1, 'Option D is required').max(1000),
  correct_answer: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(answerOptionSchema),
  explanation: optionalText(5000),
});

export type QuestionInput = z.infer<typeof questionInputSchema>;

export const reorderSchema = z.object({
  questionIds: z.array(uuidSchema).min(1).max(1000),
});

export const importSaveSchema = z.object({
  questions: z.array(questionInputSchema).min(1, 'Nothing to import').max(500, 'Import at most 500 questions at once'),
});

export const submitSchema = z.object({
  attemptId: uuidSchema,
  // Only question ids and selected options are read. Any score/isCorrect/percentage keys are ignored.
  answers: z
    .array(z.object({ questionId: uuidSchema, selectedAnswer: answerOptionSchema.nullable() }))
    .max(1000),
});

export const settingsSchema = z
  .object({
    ocr_provider: z.enum(['tesseract', 'ocrspace']),
    ai_provider: z.enum(['gemini', 'groq']),
    mcq_default_count: z.coerce.number().int().min(1).max(100),
  })
  .partial();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(200).optional(),
});
