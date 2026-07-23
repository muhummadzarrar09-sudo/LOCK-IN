import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Skip middleware for auth pages and static assets
  if (
    request.nextUrl.pathname.startsWith('/auth') ||
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const protectedPaths = ['/dashboard', '/schedule', '/team', '/reports', '/community', '/admin'];
  const isProtected = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path));

  // Check auth cookie presence directly (avoids server session resolution in middleware)
  const authCookie = request.cookies.get('sb-access-token') || request.cookies.get('supabase-auth-token');

  if (isProtected && !authCookie) {
    const redirectUrl = new URL('/auth/login', request.url);
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Auth pages redirect to dashboard if cookie present
  if (request.nextUrl.pathname.startsWith('/auth') && authCookie) {
    const redirectTo = request.nextUrl.searchParams.get('redirect') || '/dashboard';
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
