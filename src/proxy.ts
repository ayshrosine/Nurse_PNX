import { NextResponse, type NextRequest } from 'next/server';

/**
 * Layer 1 (UX only, PRD §18): bounce visitors without a session cookie away from private pages before rendering.
 * This is NOT the security boundary — every page re-checks the session against Postgres, and every API route
 * runs requireUser()/requireAdmin(). A forged cookie gets past this check and is then rejected there.
 */
const SESSION_COOKIES = ['authjs.session-token', '__Secure-authjs.session-token'];

export function proxy(req: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name));
  if (hasSession) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/login') return NextResponse.next();
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }
  const url = new URL('/login', req.url);
  url.searchParams.set('next', pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*', '/complete-profile', '/unlock/:path*', '/tests/:path*', '/results/:path*', '/admin/:path*'],
};
