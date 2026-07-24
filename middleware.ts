import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function applySecurityHeaders(response: NextResponse, nonce: string) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "manifest-src 'self'",
      "worker-src 'self'",
      "form-action 'self'",
      'upgrade-insecure-requests',
    ].join('; ')
  );
  return response;
}

export async function middleware(request: NextRequest) {
  const nonce = createNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request: { headers: requestHeaders },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/_next') || pathname.includes('favicon.ico') || pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$/)) {
    return applySecurityHeaders(supabaseResponse, nonce);
  }

  const protectedPaths = [
    '/dashboard',
    '/schedule',
    '/team',
    '/reports',
    '/community',
    '/admin',
    '/people',
    '/leaderboard',
    '/history',
    '/settings',
    '/welcome',
    '/u',
  ];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  const isAuthPage = pathname.startsWith('/auth');

  if (isProtected && !user) {
    const redirectUrl = new URL('/auth/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie as any);
    });
    return applySecurityHeaders(redirectResponse, nonce);
  }

  if (pathname.startsWith('/admin') && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if ((profile as { role?: string } | null)?.role !== 'admin') {
      const redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url));
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie as any);
      });
      return applySecurityHeaders(redirectResponse, nonce);
    }
  }

  if (isAuthPage && user) {
    const requestedRedirect = request.nextUrl.searchParams.get('redirect');
    const target =
      requestedRedirect && requestedRedirect.startsWith('/') && !requestedRedirect.startsWith('//')
        ? requestedRedirect
        : '/dashboard';
    if (!target.startsWith('/auth')) {
      const redirectResponse = NextResponse.redirect(new URL(target, request.url));
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie as any);
      });
      return applySecurityHeaders(redirectResponse, nonce);
    }
  }

  return applySecurityHeaders(supabaseResponse, nonce);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
