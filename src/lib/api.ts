// Typed fetch wrapper for Client Components. Parses the { success, data | error } envelope and surfaces
// server error messages as-is (PRD §20: show useful errors, never substitute fake data).

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: 'same-origin',
      ...rest,
      headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiClientError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    throw new ApiClientError(
      res.status,
      body?.error?.code ?? 'INTERNAL_ERROR',
      body?.error?.message ?? `Request failed (${res.status})`,
      body?.error?.details,
    );
  }
  return body.data as T;
}

export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiClientError) || !err.details) return {};
  return Object.fromEntries(err.details.map((d) => [d.path, d.message]));
}

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong';
}
