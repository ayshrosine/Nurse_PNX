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
