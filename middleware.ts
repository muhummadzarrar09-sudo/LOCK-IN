import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Validate and refresh session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isStatic =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') && !pathname.startsWith('/dashboard') && !pathname.startsWith('/admin');

  // Still return response with refreshed cookies for static if needed
  if (pathname.startsWith('/_next') || pathname.includes('favicon.ico') || pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$/)) {
    return supabaseResponse;
  }

  const protectedPaths = ['/dashboard', '/schedule', '/team', '/reports', '/community', '/admin'];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  const isAuthPage = pathname.startsWith('/auth');

  if (isProtected && !user) {
    const redirectUrl = new URL('/auth/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Forward refreshed cookies
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie as any);
    });
    return redirectResponse;
  }

  if (isAuthPage && user) {
    const requestedRedirect = request.nextUrl.searchParams.get('redirect');
    const target =
      requestedRedirect && requestedRedirect.startsWith('/') ? requestedRedirect : '/dashboard';
    if (!target.startsWith('/auth')) {
      const redirectResponse = NextResponse.redirect(new URL(target, request.url));
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie as any);
      });
      return redirectResponse;
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
