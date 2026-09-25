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
