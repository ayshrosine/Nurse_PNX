import { ZodError } from 'zod';

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'PURCHASE_REQUIRED'
  | 'PROFILE_INCOMPLETE'
  | 'PAYMENT_VERIFICATION_FAILED'
  | 'NOT_CONFIGURED'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const Errors = {
  unauthorized: (msg = 'Authentication required') => new ApiError(401, 'UNAUTHORIZED', msg),
  forbidden: (msg = 'You do not have access to this resource') => new ApiError(403, 'FORBIDDEN', msg),
  notFound: (what = 'Resource') => new ApiError(404, 'NOT_FOUND', `${what} not found`),
  conflict: (msg: string) => new ApiError(409, 'CONFLICT', msg),
  badRequest: (msg: string) => new ApiError(400, 'BAD_REQUEST', msg),
  validation: (msg: string, details?: unknown) => new ApiError(422, 'VALIDATION_ERROR', msg, details),
};

export interface ApiErrorBody {
  success: false;
  error: { code: ErrorCode; message: string; details?: unknown };
}

export function toErrorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    const body: ApiErrorBody = {
      success: false,
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    };
    return Response.json(body, { status: err.status });
  }
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    const body: ApiErrorBody = {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: details[0]?.message ?? 'Invalid input', details },
    };
    return Response.json(body, { status: 422 });
  }
  // Postgres constraint violations that slipped past validation map to client errors, not 500s.
  const pgCode = (err as { code?: string })?.code;
  if (pgCode === '23505') return toErrorResponse(Errors.conflict('A record with these values already exists'));
  if (pgCode === '23514' || pgCode === '22P02' || pgCode === '23502') {
    return toErrorResponse(Errors.validation('Invalid value for one or more fields'));
  }
  if (pgCode === '23503') return toErrorResponse(Errors.conflict('This record is referenced by other data'));

  console.error('[api] unhandled error', err);
  const body: ApiErrorBody = { success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } };
  return Response.json(body, { status: 500 });
}
