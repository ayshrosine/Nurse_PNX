// One-off generator for the Route Handler files under src/app/api. Kept in the repo so the route surface
// is visible in one place; re-running it overwrites the generated files.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app', 'api');

const R = (s) => s.trim() + '\n';

const files = {
  // ------------------------------------------------------------------ auth
  'auth/[...nextauth]/route.ts': R(`
import { handlers } from '@/lib/server/auth';

export const { GET, POST } = handlers;
`),
  'auth/me/route.ts': R(`
import { route, ok } from '@/lib/server/http';
import { getCurrentUser } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

/** GET /api/auth/me — the signed-in user as the server sees it, or null. */
export const GET = route(async () => {
  const user = await getCurrentUser();
  return ok(user ? { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, profileComplete: Boolean(user.phone) } : null);
});
`),
  'auth/logout/route.ts': R(`
import { route, ok } from '@/lib/server/http';
import { signOut } from '@/lib/server/auth';

export const POST = route(async () => {
  await signOut({ redirect: false });
  return ok({ loggedOut: true });
});
`),
  'auth/google/route.ts': R(`
import type { NextRequest } from 'next/server';
import { signIn } from '@/lib/server/auth';
import { safeNext } from '@/lib/server/session';

/** GET /api/auth/google?next=/path — starts Google OAuth (PRD §12). */
export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get('next'));
  await signIn('google', { redirectTo: '/auth/continue?next=' + encodeURIComponent(next) });
}
`),

  // ------------------------------------------------------------------ public
  'health/route.ts': R(`
import { query } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await query('SELECT 1');
    return Response.json({ success: true, data: { status: 'ok', database: 'ok' } });
  } catch {
    return Response.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Database unavailable' } }, { status: 503 });
  }
}
`),
  'test-series/route.ts': R(`
import { route, ok } from '@/lib/server/http';
import { getCurrentUser } from '@/lib/server/session';
import { listPublished } from '@/lib/server/services/testSeriesService';

export const dynamic = 'force-dynamic';

/** Public catalog: PUBLISHED only, with the viewer's access state computed server-side. */
export const GET = route(async () => ok(await listPublished(await getCurrentUser())));
`),
  'test-series/[id]/route.ts': R(`
import { route, ok, parseId } from '@/lib/server/http';
import { getCurrentUser } from '@/lib/server/session';
import { getPublished } from '@/lib/server/services/testSeriesService';
import { Errors } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const series = await getPublished(parseId(params.id, 'Test series'), await getCurrentUser());
  if (!series) throw Errors.notFound('Test series');
  return ok(series);
});
`),

  // ------------------------------------------------------------------ student
  'me/route.ts': R(`
import { route, ok, readJson } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { profileUpdateSchema } from '@/lib/validation';
import { updateProfile } from '@/lib/server/profile';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const user = await requireUser();
  return ok({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, created_at: user.created_at });
});

export const PUT = route(async (req) => {
  const user = await requireUser();
  return ok(await updateProfile(user, await readJson(req, profileUpdateSchema)));
});
`),
  'me/profile/route.ts': R(`
import { route, ok, readJson } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { profileUpdateSchema } from '@/lib/validation';
import { updateProfile } from '@/lib/server/profile';

/** PUT /api/me/profile — only the phone is editable; name/email are Google-managed. */
export const PUT = route(async (req) => {
  const user = await requireUser();
  return ok(await updateProfile(user, await readJson(req, profileUpdateSchema)));
});
`),
  'me/purchases/route.ts': R(`
import { route, ok } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { listForUser } from '@/lib/server/services/purchaseService';

export const dynamic = 'force-dynamic';

export const GET = route(async () => ok(await listForUser((await requireUser()).id)));
`),
  'me/attempts/route.ts': R(`
import { route, ok } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { listForUser } from '@/lib/server/services/attemptService';

export const dynamic = 'force-dynamic';

export const GET = route(async () => ok(await listForUser((await requireUser()).id)));
`),
  'me/progress/route.ts': R(`
import { route, ok } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { progressForUser } from '@/lib/server/services/attemptService';

export const dynamic = 'force-dynamic';

export const GET = route(async () => ok(await progressForUser((await requireUser()).id)));
`),
  'tests/[id]/start/route.ts': R(`
import { route, ok, parseId } from '@/lib/server/http';
import { requireCompleteProfile } from '@/lib/server/session';
import { start } from '@/lib/server/services/attemptService';
import { rateLimit } from '@/lib/server/rateLimit';

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireCompleteProfile();
  rateLimit('start:' + user.id, 30, 60_000);
  return ok(await start(user, parseId(params.id, 'Test')));
});
`),
  'tests/[id]/answers/route.ts': R(`
import { route, ok, parseId, readJson } from '@/lib/server/http';
import { requireCompleteProfile } from '@/lib/server/session';
import { saveAnswers } from '@/lib/server/services/attemptService';
import { submitSchema } from '@/lib/validation';
import { rateLimit } from '@/lib/server/rateLimit';

/** Autosave of selections during a test. Never scores. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireCompleteProfile();
  rateLimit('autosave:' + user.id, 120, 60_000);
  const body = await readJson(req, submitSchema);
  return ok(await saveAnswers(user, parseId(params.id, 'Test'), body.attemptId, body.answers));
});
`),
  'tests/[id]/submit/route.ts': R(`
import { route, ok, parseId, readJson } from '@/lib/server/http';
import { requireCompleteProfile } from '@/lib/server/session';
import { submit } from '@/lib/server/services/attemptService';
import { submitSchema } from '@/lib/validation';

/** Server-side scoring. Only { attemptId, answers: [{ questionId, selectedAnswer }] } is read from the body. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireCompleteProfile();
  const body = await readJson(req, submitSchema);
  return ok(await submit(user, parseId(params.id, 'Test'), body.attemptId, body.answers));
});
`),
  'results/[id]/route.ts': R(`
import { route, ok, parseId } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { getResult } from '@/lib/server/services/attemptService';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  return ok(await getResult(user, parseId(params.id, 'Result')));
});
`),

  // ------------------------------------------------------------------ purchases / payments
  'purchases/create/route.ts': R(`
import { z } from 'zod';
import { route, created, readJson } from '@/lib/server/http';
import { requireCompleteProfile } from '@/lib/server/session';
import { createCheckout } from '@/lib/server/services/purchaseService';
import { rateLimit } from '@/lib/server/rateLimit';
import { uuidSchema } from '@/lib/validation';

/** Creates a PENDING purchase + Razorpay order. The amount comes from the database, never the client. */
export const POST = route(async (req) => {
  const user = await requireCompleteProfile();
  rateLimit('order:' + user.id, 10, 60_000);
  const { testSeriesId } = await readJson(req, z.object({ testSeriesId: uuidSchema }));
  return created(await createCheckout(user, testSeriesId));
});
`),
  'purchases/[id]/route.ts': R(`
import { route, ok, parseId } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { getForUser } from '@/lib/server/services/purchaseService';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  return ok(await getForUser(user, parseId(params.id, 'Purchase')));
});
`),
  'payments/razorpay/order/route.ts': R(`
import { z } from 'zod';
import { route, created, readJson } from '@/lib/server/http';
import { requireCompleteProfile } from '@/lib/server/session';
import { createCheckout } from '@/lib/server/services/purchaseService';
import { rateLimit } from '@/lib/server/rateLimit';
import { uuidSchema } from '@/lib/validation';

export const POST = route(async (req) => {
  const user = await requireCompleteProfile();
  rateLimit('order:' + user.id, 10, 60_000);
  const { testSeriesId } = await readJson(req, z.object({ testSeriesId: uuidSchema }));
  return created(await createCheckout(user, testSeriesId));
});
`),
  'payments/razorpay/verify/route.ts': R(`
import { z } from 'zod';
import { route, ok, readJson } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { verifyCheckout } from '@/lib/server/services/purchaseService';
import { rateLimit } from '@/lib/server/rateLimit';

const schema = z.object({
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i, 'Invalid signature'),
});

/** Only a valid HMAC signature turns a purchase into SUCCESS. The Checkout callback alone grants nothing. */
export const POST = route(async (req) => {
  const user = await requireUser();
  rateLimit('verify:' + user.id, 20, 60_000);
  const purchase = await verifyCheckout(user, await readJson(req, schema));
  return ok({ purchaseId: purchase.id, status: purchase.status, testSeriesId: purchase.test_series_id });
});
`),
  'payments/razorpay/cancel/route.ts': R(`
import { z } from 'zod';
import { route, ok, readJson } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { markAbandoned } from '@/lib/server/services/purchaseService';

const schema = z.object({
  orderId: z.string().min(1).max(100),
  reason: z.enum(['dismissed', 'failed']).default('dismissed'),
  description: z.string().max(500).optional(),
});

/** Client-reported checkout dismissal/failure. Can only downgrade the caller's own PENDING order. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson(req, schema);
  const row = await markAbandoned(user, body.orderId, body.reason === 'failed' ? 'FAILED' : 'CANCELLED', body.description);
  return ok({ status: row?.status ?? 'UNCHANGED' });
});
`),
  'payments/razorpay/webhook/route.ts': R(`
import { createHash } from 'node:crypto';
import { toErrorResponse, ApiError } from '@/lib/errors';
import { verifyWebhookSignature } from '@/lib/server/razorpay';
import { handleWebhook } from '@/lib/server/services/purchaseService';

/**
 * Razorpay → server webhook. No session: authenticity comes from the HMAC signature over the raw body,
 * verified with RAZORPAY_WEBHOOK_SECRET. Configure events: payment.captured, payment.failed, order.paid, refund.processed.
 */
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    if (raw.length > 1_000_000) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Payload too large');
    const signature = req.headers.get('x-razorpay-signature') ?? '';
    if (!signature || !verifyWebhookSignature(raw, signature)) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Invalid webhook signature');
    }
    const body = JSON.parse(raw);
    // Razorpay sends x-razorpay-event-id; fall back to a hash of the body for idempotency.
    const eventId = req.headers.get('x-razorpay-event-id') || createHash('sha256').update(raw).digest('hex');
    const result = await handleWebhook(eventId, body);
    return Response.json({ success: true, data: result });
  } catch (err) {
    return toErrorResponse(err);
  }
}
`),

  // ------------------------------------------------------------------ admin
  'admin/dashboard/route.ts': R(`
import { route, ok } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { dashboard } from '@/lib/server/services/adminService';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requireAdmin();
  return ok(await dashboard());
});
`),
  'admin/users/route.ts': R(`
import { z } from 'zod';
import { route, ok, searchParams } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { listUsers } from '@/lib/server/services/adminService';
import { paginationSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const filters = paginationSchema.extend({
  role: z.enum(['STUDENT', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  profile: z.enum(['complete', 'incomplete']).optional(),
});

export const GET = route(async (req) => {
  await requireAdmin();
  return ok(await listUsers(filters.parse(searchParams(req))));
});
`),
  'admin/users/[id]/route.ts': R(`
import { z } from 'zod';
import { route, ok, parseId, readJson } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { userDetail, setUserStatus } from '@/lib/server/services/adminService';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  return ok(await userDetail(parseId(params.id, 'User')));
});

/** Only account status can be changed here. Role is never writable through the API (PRD §28). */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const body = await readJson(req, z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) }).strict());
  return ok(await setUserStatus(admin, parseId(params.id, 'User'), body.status));
});
`),
  'admin/test-series/route.ts': R(`
import { route, ok, created, readJson, searchParams } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import * as svc from '@/lib/server/services/testSeriesService';
import { paginationSchema, testSeriesInputSchema, testStatusSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const filters = paginationSchema.extend({ status: testStatusSchema.optional() });

export const GET = route(async (req) => {
  await requireAdmin();
  return ok(await svc.adminList(filters.parse(searchParams(req))));
});

export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const id = await svc.create(await readJson(req, testSeriesInputSchema), admin);
  return created(await svc.adminGet(id));
});
`),
  'admin/test-series/[id]/route.ts': R(`
import { route, ok, parseId, readJson } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import * as svc from '@/lib/server/services/testSeriesService';
import { testSeriesInputSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  return ok(await svc.adminGet(parseId(params.id, 'Test series')));
});

export const PUT = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const id = parseId(params.id, 'Test series');
  await svc.update(id, await readJson(req, testSeriesInputSchema), admin);
  return ok(await svc.adminGet(id));
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const admin = await requireAdmin();
  await svc.remove(parseId(params.id, 'Test series'), admin);
  return ok({ deleted: true });
});
`),
  ...Object.fromEntries(
    [['publish', 'PUBLISHED'], ['unpublish', 'DRAFT'], ['archive', 'ARCHIVED']].map(([name, status]) => [
      'admin/test-series/[id]/' + name + '/route.ts',
      R(`
import { route, ok, parseId } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import * as svc from '@/lib/server/services/testSeriesService';

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const admin = await requireAdmin();
  const id = parseId(params.id, 'Test series');
  await svc.setStatus(id, '${status}', admin);
  return ok(await svc.adminGet(id));
});
`),
    ]),
  ),
  'admin/test-series/[id]/questions/route.ts': R(`
import { route, ok, created, parseId, readJson, searchParams } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import * as questions from '@/lib/server/services/questionService';
import { questionInputSchema } from '@/lib/validation';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (req, { params }) => {
  await requireAdmin();
  const { review } = z.object({ review: z.enum(['PENDING_REVIEW', 'APPROVED', 'REJECTED']).optional() }).parse(searchParams(req));
  return ok(await questions.listForAdmin(parseId(params.id, 'Test series'), review));
});

export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  return created(await questions.create(parseId(params.id, 'Test series'), await readJson(req, questionInputSchema), admin));
});
`),
  'admin/test-series/[id]/questions/reorder/route.ts': R(`
import { route, ok, parseId, readJson } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { reorder } from '@/lib/server/services/questionService';
import { reorderSchema } from '@/lib/validation';

export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { questionIds } = await readJson(req, reorderSchema);
  await reorder(parseId(params.id, 'Test series'), questionIds, admin);
  return ok({ reordered: questionIds.length });
});
`),
  'admin/test-series/[id]/import/html/route.ts': R(`
import { route, ok, parseId } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { parseImportFile } from '@/lib/server/importParsers';
import { rateLimit } from '@/lib/server/rateLimit';
import { ApiError, Errors } from '@/lib/errors';
import { queryOne } from '@/lib/server/db';

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ['html', 'htm', 'json', 'csv', 'txt'];

/**
 * Step 1 of the structured import (PRD §6.9): upload → parse → validate → PREVIEW. Nothing is saved here;
 * the admin reviews/edits the preview and confirms via POST .../import/save.
 * Accepts multipart "file" (.html/.htm/.json/.csv/.txt) or JSON { html } for pasted content.
 */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  rateLimit('import:' + admin.id, 30, 60_000);
  const id = parseId(params.id, 'Test series');
  if (!(await queryOne('SELECT 1 FROM test_series WHERE id = $1', [id]))) throw Errors.notFound('Test series');

  const type = req.headers.get('content-type') ?? '';
  let filename = 'pasted.html';
  let content: string;
  if (type.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw Errors.validation('Choose a file to import');
    if (file.size === 0) throw Errors.validation('The file is empty');
    if (file.size > MAX_BYTES) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Import files must be 2 MB or smaller');
    const ext = file.name.toLowerCase().split('.').pop() ?? '';
    if (!ALLOWED.includes(ext)) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Supported formats: .html, .json, .csv, .txt');
    filename = file.name;
    content = await file.text();
    if (content.includes('\\u0000')) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'This does not look like a text file');
  } else {
    const body = (await req.json().catch(() => null)) as { html?: unknown } | null;
    if (!body || typeof body.html !== 'string' || !body.html.trim()) throw Errors.validation('Paste some HTML to import');
    if (body.html.length > MAX_BYTES) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Pasted content is too large');
    content = body.html;
  }
  const result = parseImportFile(filename, content);
  return ok({ filename, ...result });
});
`),
  'admin/test-series/[id]/import/save/route.ts': R(`
import { z } from 'zod';
import { route, created, parseId, readJson } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { importQuestions } from '@/lib/server/services/questionService';
import { importSaveSchema } from '@/lib/validation';

/** Step 2: saves the admin-confirmed (possibly edited) preview. Re-validated server-side. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const body = await readJson(req, importSaveSchema.extend({ filename: z.string().max(255).optional() }));
  const ids = await importQuestions(parseId(params.id, 'Test series'), body.questions, admin, body.filename);
  return created({ imported: ids.length });
});
`),
  'admin/test-series/[id]/documents/route.ts': R(`
import { route, ok, parseId } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { listForSeries } from '@/lib/server/services/documentService';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  return ok(await listForSeries(parseId(params.id, 'Test series')));
});
`),
  'admin/questions/[id]/route.ts': R(`
import { route, ok, parseId, readJson } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import * as questions from '@/lib/server/services/questionService';
import { questionInputSchema } from '@/lib/validation';
import { Errors } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  const q = await questions.getById(parseId(params.id, 'Question'));
  if (!q) throw Errors.notFound('Question');
  return ok(q);
});

export const PUT = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  return ok(await questions.update(parseId(params.id, 'Question'), await readJson(req, questionInputSchema), admin));
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const admin = await requireAdmin();
  await questions.remove(parseId(params.id, 'Question'), admin);
  return ok({ deleted: true });
});
`),
  'admin/questions/[id]/review/route.ts': R(`
import { z } from 'zod';
import { route, ok, parseId, readJson } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { setReviewStatus, getById } from '@/lib/server/services/questionService';
import { Errors } from '@/lib/errors';

/** Reject a single AI draft (or restore a rejected one to review) without discarding the batch. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const id = parseId(params.id, 'Question');
  const { status } = await readJson(req, z.object({ status: z.enum(['REJECTED', 'PENDING_REVIEW']) }));
  const q = await getById(id);
  if (!q) throw Errors.notFound('Question');
  if (q.review_status === 'APPROVED') throw Errors.conflict('Approved questions are edited or deleted, not re-reviewed');
  return ok(await setReviewStatus(id, status, admin));
});
`),
  'admin/documents/upload/route.ts': R(`
import { route, created } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { upload, MAX_UPLOAD_BYTES } from '@/lib/server/services/documentService';
import { detectFileType } from '@/lib/server/extract';
import { rateLimit } from '@/lib/server/rateLimit';
import { ApiError, Errors } from '@/lib/errors';
import { uuidSchema } from '@/lib/validation';

export const runtime = 'nodejs';

/** Multipart: file (.pdf/.docx/.html ≤ 25 MB) + testSeriesId. Extension, MIME and magic bytes are all checked. */
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  rateLimit('upload:' + admin.id, 20, 10 * 60_000);
  const form = await req.formData().catch(() => {
    throw Errors.badRequest('Expected multipart/form-data');
  });
  const file = form.get('file');
  const seriesId = uuidSchema.safeParse(form.get('testSeriesId'));
  if (!seriesId.success) throw Errors.validation('testSeriesId is required');
  if (!(file instanceof File) || file.size === 0) throw Errors.validation('Choose a file to upload');
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Files must be 25 MB or smaller');
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileType = detectFileType(file.name, file.type, buffer);
  if (!fileType) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Only valid .pdf, .docx or .html files are accepted');
  return created(await upload(admin, { testSeriesId: seriesId.data, filename: file.name, mime: file.type, fileType, buffer }));
});
`),
  'admin/documents/[id]/route.ts': R(`
import { route, ok, parseId } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { getWithPreview, remove } from '@/lib/server/services/documentService';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  return ok(await getWithPreview(parseId(params.id, 'Document')));
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const admin = await requireAdmin();
  await remove(admin, parseId(params.id, 'Document'));
  return ok({ deleted: true });
});
`),
  'admin/documents/[id]/extract/route.ts': R(`
import { after } from 'next/server';
import { route, ok, parseId } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { beginExtract, runExtract } from '@/lib/server/services/documentService';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Starts extraction/OCR in the background and returns 202-style immediately; poll GET /api/admin/documents/:id. */
export const POST = route<{ id: string }>(async (_req, { params }) => {
  const admin = await requireAdmin();
  const doc = await beginExtract(parseId(params.id, 'Document'));
  after(() => runExtract(admin, doc));
  return ok({ id: doc.id, status: 'EXTRACTING' }, { status: 202 });
});
`),
  'admin/documents/[id]/generate/route.ts': R(`
import { after } from 'next/server';
import { z } from 'zod';
import { route, ok, parseId } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { beginGenerate, runGenerate } from '@/lib/server/services/documentService';
import { rateLimit } from '@/lib/server/rateLimit';

export const runtime = 'nodejs';
export const maxDuration = 300;

const schema = z.object({
  mode: z.enum(['ai', 'parse']).default('ai'),
  count: z.coerce.number().int().min(1).max(100).optional(),
});

export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  rateLimit('generate:' + admin.id, 10, 10 * 60_000);
  const body = schema.parse(await req.json().catch(() => ({})));
  const doc = await beginGenerate(parseId(params.id, 'Document'));
  after(() => runGenerate(admin, doc, body));
  return ok({ id: doc.id, status: 'GENERATING' }, { status: 202 });
});
`),
  'admin/documents/[id]/preview/route.ts': R(`
import { route, ok, parseId } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { preview } from '@/lib/server/services/documentService';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  return ok(await preview(parseId(params.id, 'Document')));
});
`),
  'admin/documents/[id]/approve/route.ts': R(`
import { z } from 'zod';
import { route, ok, parseId } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { approve } from '@/lib/server/services/documentService';
import { uuidSchema } from '@/lib/validation';

export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const body = z.object({ questionIds: z.array(uuidSchema).max(500).optional() }).parse(await req.json().catch(() => ({})));
  return ok(await approve(admin, parseId(params.id, 'Document'), body.questionIds));
});
`),
  'admin/purchases/route.ts': R(`
import { route, ok, searchParams } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { listPurchases } from '@/lib/server/services/adminService';
import { paginationSchema, purchaseStatusSchema, uuidSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const filters = paginationSchema.extend({ status: purchaseStatusSchema.optional(), testSeriesId: uuidSchema.optional() });

export const GET = route(async (req) => {
  await requireAdmin();
  return ok(await listPurchases(filters.parse(searchParams(req))));
});
`),
  'admin/purchases/[id]/route.ts': R(`
import { route, ok, parseId } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { purchaseDetail } from '@/lib/server/services/adminService';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  return ok(await purchaseDetail(parseId(params.id, 'Purchase')));
});
`),
  'admin/attempts/route.ts': R(`
import { route, ok, searchParams } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { listAttempts } from '@/lib/server/services/adminService';
import { attemptStatusSchema, paginationSchema, uuidSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const filters = paginationSchema.extend({
  status: attemptStatusSchema.optional(),
  testSeriesId: uuidSchema.optional(),
  userId: uuidSchema.optional(),
});

export const GET = route(async (req) => {
  await requireAdmin();
  return ok(await listAttempts(filters.parse(searchParams(req))));
});
`),
  'admin/attempts/[id]/route.ts': R(`
import { route, ok, parseId } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { getResult } from '@/lib/server/services/attemptService';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const admin = await requireAdmin();
  return ok(await getResult(admin, parseId(params.id, 'Attempt')));
});
`),
  'admin/settings/route.ts': R(`
import { route, ok, readJson } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { getSettings, updateSettings, providerAvailability } from '@/lib/server/services/settingsService';
import { settingsSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requireAdmin();
  return ok({ settings: await getSettings(), availability: providerAvailability() });
});

export const PUT = route(async (req) => {
  const admin = await requireAdmin();
  const settings = await updateSettings(admin, await readJson(req, settingsSchema));
  return ok({ settings, availability: providerAvailability() });
});
`),
};

for (const [rel, content] of Object.entries(files)) {
  const file = path.join(root, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}
console.log(`✓ wrote ${Object.keys(files).length} route files`);
