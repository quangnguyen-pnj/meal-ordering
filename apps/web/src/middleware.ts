import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'meal_session';
const PUBLIC_PATHS = ['/login', '/auth/not-linked'];

/**
 * Cheap first gate: no session cookie means go to /login. The cookie is only checked for
 * presence here; layouts validate it against the API on every request.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p) || req.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the API proxy, Next internals and static files.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
