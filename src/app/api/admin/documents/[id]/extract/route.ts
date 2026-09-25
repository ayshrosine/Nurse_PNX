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
