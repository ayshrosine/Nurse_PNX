import { route, created } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { upload, MAX_UPLOAD_BYTES } from '@/lib/server/services/documentService';
import { detectFileType } from '@/lib/server/extract';
import { rateLimit } from '@/lib/server/rateLimit';
import { ApiError, Errors } from '@/lib/errors';
import { uuidSchema } from '@/lib/validation';

export const runtime = 'nodejs';

/** Multipart: file (.pdf/.docx/.html ≤ 25 MB) + testSeriesId. Extension, MIME and magic bytes are all checked. */
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  rateLimit('upload:' + admin.id, 20, 10 * 60_000);
  const form = await req.formData().catch(() => {
    throw Errors.badRequest('Expected multipart/form-data');
  });
  const file = form.get('file');
  const seriesId = uuidSchema.safeParse(form.get('testSeriesId'));
  if (!seriesId.success) throw Errors.validation('testSeriesId is required');
  if (!(file instanceof File) || file.size === 0) throw Errors.validation('Choose a file to upload');
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Files must be 25 MB or smaller');
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileType = detectFileType(file.name, file.type, buffer);
  if (!fileType) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Only valid .pdf, .docx or .html files are accepted');
  return created(await upload(admin, { testSeriesId: seriesId.data, filename: file.name, mime: file.type, fileType, buffer }));
});
