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
