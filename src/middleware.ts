import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const authCookie = request.cookies.get('stockkeep_auth');
  const isAuthenticated = authCookie?.value === 'authenticated';
  const { pathname } = request.nextUrl;

  // Allow static files, api/auth, login page.
  // NOTE: /api/seed is intentionally NOT whitelisted — it can wipe and
  // reseed all data (force=true) and must require authentication like
  // every other data-mutating route. See Technical_Debt_Plan.pdf, TD-02.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/login'
  ) {
    if (pathname === '/login' && isAuthenticated) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Protect all other routes & APIs
  if (!isAuthenticated) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
