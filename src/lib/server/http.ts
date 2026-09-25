import 'server-only';
import type { NextRequest } from 'next/server';
import type { ZodType } from 'zod';
import { ApiError, Errors, toErrorResponse } from '../errors';
import { uuidSchema } from '../validation';

type Params = Record<string, string | string[]>;
type Handler<P extends Params> = (req: NextRequest, ctx: { params: P }) => Promise<Response>;

/** Wraps a Route Handler: resolves params and converts any thrown error into the standard envelope. */
export function route<P extends Params = Params>(handler: Handler<P>) {
  return async (req: NextRequest, ctx: { params: Promise<P> }) => {
    try {
      const params = ctx?.params ? await ctx.params : ({} as P);
      return await handler(req, { params });
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

export function ok<T>(data: T, init?: ResponseInit) {
  return Response.json({ success: true, data }, init);
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export function parseId(value: string | string[] | undefined, what = 'Resource'): string {
  const parsed = uuidSchema.safeParse(value);
  // A malformed id can never match a row, so it is reported as not found rather than leaking validation detail.
  if (!parsed.success) throw Errors.notFound(what);
  return parsed.data;
}

export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const type = req.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Expected JSON body');
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw Errors.badRequest('Malformed JSON body');
  }
  return schema.parse(body);
}

export function searchParams(req: NextRequest) {
  return Object.fromEntries(req.nextUrl.searchParams.entries());
}
