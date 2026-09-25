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
