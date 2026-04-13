import { NextRequest, NextResponse } from 'next/server';

/**
 * VULN-013 fix: Server-side route protection for the backoffice.
 *
 * Validates the presence of the admin_token cookie before allowing access
 * to any protected route. If absent or expired, redirects to /login.
 *
 * NOTE: Full JWT signature verification would require a library that runs
 * in the Edge Runtime (e.g. jose). For now we validate:
 *   1. Cookie presence
 *   2. JWT structure (3 base64 parts)
 *   3. Expiration claim (parsed from payload without crypto verification)
 *
 * The NestJS API still performs full cryptographic verification on every
 * request, so this proxy acts as a first line of defense to prevent
 * unauthenticated users from even loading protected pages.
 *
 * Next.js 16+: "middleware" convention renamed to "proxy".
 */

const PUBLIC_PATHS = ['/login', '/favicon.ico'];

function isTokenStructureValid(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  try {
    // Decode payload (middle part) to check expiration
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8'),
    );

    // Check expiration
    if (payload.exp && typeof payload.exp === 'number') {
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) return false; // Token expired
    }

    // Must have either adminId or userId
    if (!payload.adminId && !payload.userId) return false;

    return true;
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/')) ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check for admin_token cookie
  const token = request.cookies.get('admin_token')?.value;

  if (!token || !isTokenStructureValid(token)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run proxy on all routes except _next, static files, and api
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
