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
    if (content.includes('\u0000')) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'This does not look like a text file');
  } else {
    const body = (await req.json().catch(() => null)) as { html?: unknown } | null;
    if (!body || typeof body.html !== 'string' || !body.html.trim()) throw Errors.validation('Paste some HTML to import');
    if (body.html.length > MAX_BYTES) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Pasted content is too large');
    content = body.html;
  }
  const result = parseImportFile(filename, content);
  return ok({ filename, ...result });
});
