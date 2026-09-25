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
