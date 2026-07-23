import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClientServer } from './lib/supabase-server';

export async function middleware(request: NextRequest) {
  // Skip middleware for auth pages and static files
  if (
    request.nextUrl.pathname.startsWith('/auth') ||
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const supabase = createClientServer();
  const { data: { session } } = await supabase.auth.getSession();

  // Protected routes: dashboard, admin, schedule, etc.
  const protectedPaths = ['/dashboard', '/schedule', '/team', '/reports', '/community', '/admin'];
  const isProtected = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path));

  if (isProtected && !session) {
    const redirectUrl = new URL('/auth/login', request.url);
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Auth pages redirect to dashboard if already logged in
  if (request.nextUrl.pathname.startsWith('/auth') && session) {
    const redirectTo = request.nextUrl.searchParams.get('redirect') || '/dashboard';
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
