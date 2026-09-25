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
