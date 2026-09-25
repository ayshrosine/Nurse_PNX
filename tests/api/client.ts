// Minimal HTTP client with a cookie jar, used to drive the real API as different users.
export const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export class Client {
  cookies = new Map<string, string>();

  private cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  private store(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      const name = pair.slice(0, i);
      const value = pair.slice(i + 1);
      if (!value || /max-age=0/i.test(c) || /expires=Thu, 01 Jan 1970/i.test(c)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  async raw(path: string, init: RequestInit = {}) {
    const res = await fetch(BASE + path, {
      redirect: 'manual',
      ...init,
      headers: { ...(this.cookies.size ? { cookie: this.cookieHeader() } : {}), ...(init.headers as Record<string, string>) },
    });
    this.store(res);
    return res;
  }

  async json<T = any>(path: string, init: RequestInit & { body?: any } = {}): Promise<{ status: number; body: T & { success: boolean; data: any; error?: { code: string; message: string } } }> {
    const hasBody = init.body !== undefined && !(init.body instanceof FormData) && typeof init.body !== 'string';
    const res = await this.raw(path, {
      ...init,
      body: hasBody ? JSON.stringify(init.body) : init.body,
      headers: { ...(hasBody ? { 'content-type': 'application/json' } : {}), ...(init.headers as Record<string, string>) },
    });
    const text = await res.text();
    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
    return { status: res.status, body };
  }

  get = (p: string) => this.json(p);
  post = (p: string, body: any = {}) => this.json(p, { method: 'POST', body });
  put = (p: string, body: any) => this.json(p, { method: 'PUT', body });
  patch = (p: string, body: any) => this.json(p, { method: 'PATCH', body });
  del = (p: string) => this.json(p, { method: 'DELETE' });

  /** Signs in through the real NextAuth flow using the development credentials provider. */
  async login(email: string) {
    const csrf = await this.json<{ csrfToken: string }>('/api/auth/csrf');
    const csrfToken = (csrf.body as any).csrfToken;
    const res = await this.raw('/api/auth/callback/dev', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken, email, callbackUrl: `${BASE}/dashboard` }).toString(),
    });
    if (![200, 302].includes(res.status) || ![...this.cookies.keys()].some((k) => k.includes('session-token'))) {
      throw new Error(`login failed for ${email}: ${res.status}`);
    }
    return this;
  }
}

export async function as(email: string) {
  return new Client().login(email);
}
