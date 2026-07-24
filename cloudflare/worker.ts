/**
 * Cloudflare Worker — edge security gateway for LOCK-IN.
 *
 * Provides:
 *  - bad bot blocking
 *  - durable global rate limiting when RATE_LIMITER Durable Object is bound
 *  - local fallback rate limiting when Durable Object is unavailable
 *  - security headers
 *  - backend proxying to Vercel
 *
 * Required env var:
 *  - BACKEND_URL: your Vercel deployment, e.g. https://discipline.vercel.app
 */

interface DurableNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}

interface Env {
  BACKEND_URL: string;
  ALLOWED_BOTS?: string;
  RATE_LIMITER?: DurableNamespace;
}

const ALLOWED_BOT_PATTERNS = [
  'Googlebot',
  'Bingbot',
  'Slurp',
  'DuckDuckBot',
  'Baiduspider',
  'YandexBot',
  'facebookexternalhit',
  'Twitterbot',
  'LinkedInBot',
  'Discordbot',
  'Slackbot',
  'WhatsApp',
  'TelegramBot',
];

const BAD_BOT_PATTERNS = [
  'scrapy',
  'httrack',
  'wget',
  'curl',
  'python-requests',
  'go-http-client',
  'semrush',
  'ahrefs',
  'mj12bot',
  'dotbot',
  'petalbot',
  'nikto',
  'sqlmap',
  'acunetix',
  'nessus',
  'masscan',
  'nmap',
];

const LOCAL_RATE_LIMIT = 120;
const LOCAL_RATE_WINDOW = 10_000;
const localRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isBot(userAgent: string, allowedPatterns: string[]): 'good' | 'bad' | 'human' {
  if (!userAgent) return 'human';
  const ua = userAgent.toLowerCase();
  for (const p of allowedPatterns) {
    if (ua.includes(p.toLowerCase())) return 'good';
  }
  for (const p of BAD_BOT_PATTERNS) {
    if (ua.includes(p)) return 'bad';
  }
  return 'human';
}

function localCheckRate(ip: string): boolean {
  const now = Date.now();
  const entry = localRateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    localRateLimitMap.set(ip, { count: 1, resetAt: now + LOCAL_RATE_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= LOCAL_RATE_LIMIT;
}

function tierForPath(pathname: string): { limit: number; windowMs: number } {
  if (pathname.startsWith('/api/')) return { limit: 60, windowMs: 60_000 };
  if (pathname.startsWith('/auth/')) return { limit: 40, windowMs: 60_000 };
  if (pathname.startsWith('/reports') || pathname.startsWith('/people') || pathname.startsWith('/leaderboard')) {
    return { limit: 80, windowMs: 60_000 };
  }
  return { limit: 180, windowMs: 60_000 };
}

async function durableCheckRate(env: Env, key: string, limit: number, windowMs: number): Promise<Response | null> {
  if (!env.RATE_LIMITER) return null;
  const id = env.RATE_LIMITER.idFromName('global');
  const stub = env.RATE_LIMITER.get(id);
  const url = new URL('https://rate-limit.local/check');
  url.searchParams.set('key', key);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('windowMs', String(windowMs));
  return stub.fetch(new Request(url.toString()));
}

function addSecurityHeaders(headers: Headers): void {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
}

function securityResponse(body: string, status: number, extraHeaders?: HeadersInit) {
  const headers = new Headers(extraHeaders);
  addSecurityHeaders(headers);
  return new Response(body, { status, headers });
}

export class RateLimiter {
  state: { storage: { get<T>(key: string): Promise<T | undefined>; put<T>(key: string, value: T, options?: unknown): Promise<void> } };

  constructor(state: { storage: { get<T>(key: string): Promise<T | undefined>; put<T>(key: string, value: T, options?: unknown): Promise<void> } }) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const key = url.searchParams.get('key') || 'unknown';
    const limit = Math.max(1, Number(url.searchParams.get('limit') || '60'));
    const windowMs = Math.max(1000, Number(url.searchParams.get('windowMs') || '60000'));
    const now = Date.now();
    const storageKey = `bucket:${key}`;
    const bucket = await this.state.storage.get<{ count: number; resetAt: number }>(storageKey);

    if (!bucket || now > bucket.resetAt) {
      await this.state.storage.put(storageKey, { count: 1, resetAt: now + windowMs }, { expirationTtl: Math.ceil(windowMs / 1000) + 60 });
      return new Response(JSON.stringify({ allowed: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    const next = { count: bucket.count + 1, resetAt: bucket.resetAt };
    await this.state.storage.put(storageKey, next, { expirationTtl: Math.ceil((next.resetAt - now) / 1000) + 60 });

    if (next.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((next.resetAt - now) / 1000));
      return new Response(JSON.stringify({ allowed: false, retryAfter }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) },
      });
    }

    return new Response(JSON.stringify({ allowed: true }), { headers: { 'Content-Type': 'application/json' } });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const ua = request.headers.get('user-agent') || '';
    const allowedBots = env.ALLOWED_BOTS
      ? [...ALLOWED_BOT_PATTERNS, ...env.ALLOWED_BOTS.split(',').map((s) => s.trim()).filter(Boolean)]
      : ALLOWED_BOT_PATTERNS;

    const botType = isBot(ua, allowedBots);
    if (botType === 'bad') {
      return securityResponse('Forbidden', 403);
    }

    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (botType !== 'good') {
      const tier = tierForPath(url.pathname);
      const durable = await durableCheckRate(env, `${ip}:${url.pathname.split('/').slice(0, 3).join('/')}`, tier.limit, tier.windowMs).catch(() => null);
      if (durable && durable.status === 429) {
        return securityResponse('Too Many Requests', 429, { 'Retry-After': durable.headers.get('Retry-After') || '60' });
      }
      if (!durable && !localCheckRate(ip)) {
        return securityResponse('Too Many Requests', 429, { 'Retry-After': '10' });
      }
    }

    if (url.pathname.match(/^\/icon-\d+\.png$/)) {
      const optimized = `/cdn-cgi/image/quality=85,format=auto${url.pathname}`;
      return fetch(env.BACKEND_URL + optimized, request);
    }

    const backendUrl = env.BACKEND_URL + url.pathname + url.search;
    const backendRequest = new Request(backendUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'manual',
    });

    const response = await fetch(backendRequest);
    const newHeaders = new Headers(response.headers);
    addSecurityHeaders(newHeaders);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};
