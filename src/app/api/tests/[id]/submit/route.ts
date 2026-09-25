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
