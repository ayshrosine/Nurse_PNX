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
