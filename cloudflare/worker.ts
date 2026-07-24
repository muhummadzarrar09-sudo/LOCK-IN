/**
 * Cloudflare Worker — runs at the edge, in front of your Vercel deployment.
 *
 * What it does:
 *  1. Bot protection: blocks known bad bots, allows good ones (Googlebot, etc.)
 *  2. Image optimization: rewrites /icon-*.png to Cloudflare's /cdn-cgi/image/...
 *  3. Rate limiting: 100 req / 10s per IP for unauthenticated paths
 *  4. Country-based redirects (optional — uncomment to enable)
 *  5. Security headers added to every response
 *
 * Deploy:
 *   1. wrangler init cloudflare-worker (or use Dashboard)
 *   2. wrangler deploy
 *   3. Point your domain's DNS to the worker's routes
 *
 * Env vars (set via wrangler secret):
 *   - BACKEND_URL: your Vercel deployment, e.g. https://discipline.vercel.app
 */

// ---------- Types ----------
interface Env {
  BACKEND_URL: string;
  ALLOWED_BOTS?: string; // comma-separated user agent substrings
}

// ---------- Config ----------
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

// ---------- Bot detection ----------
function isBot(userAgent: string, allowedPatterns: string[]): 'good' | 'bad' | 'human' {
  if (!userAgent) return 'human';
  const ua = userAgent.toLowerCase();
  for (const p of allowedPatterns) {
    if (ua.includes(p.toLowerCase())) return 'good';
  }
  // Known bad bots / scrapers
  const badPatterns = [
    'scrapy', 'httrack', 'wget', 'curl', 'python-requests', 'go-http-client',
    'semrush', 'ahrefs', 'mj12bot', 'dotbot', 'petalbot',
  ];
  for (const p of badPatterns) {
    if (ua.includes(p)) return 'bad';
  }
  return 'human';
}

// ---------- Rate limiting (in-memory, per-worker) ----------
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100; // requests
const RATE_WINDOW = 10_000; // per 10 seconds

function checkRate(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

// ---------- Security headers ----------
function addSecurityHeaders(headers: Headers): void {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
}

// ---------- Main handler ----------
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const ua = request.headers.get('user-agent') || '';

    // 1. Bot handling
    const botType = isBot(ua, ALLOWED_BOT_PATTERNS);
    if (botType === 'bad') {
      return new Response('Forbidden', { status: 403 });
    }

    // 2. Rate limit (per IP, skip for good bots)
    if (botType !== 'good') {
      const ip = request.headers.get('cf-connecting-ip') || 'unknown';
      if (!checkRate(ip)) {
        return new Response('Too Many Requests', {
          status: 429,
          headers: { 'Retry-After': '10' },
        });
      }
    }

    // 3. Image optimization: rewrite /icon-X.png → /cdn-cgi/image/...
    //    (CF's image resizer is free and works at the edge)
    if (url.pathname.match(/^\/icon-\d+\.png$/)) {
      const optimized = `/cdn-cgi/image/quality=85,format=auto${url.pathname}`;
      const targetUrl = env.BACKEND_URL + optimized;
      return fetch(targetUrl, request);
    }

    // 4. Country-based redirect (uncomment to enable)
    // const country = request.headers.get('cf-ipcountry');
    // if (url.pathname === '/' && country === 'DE') {
    //   return Response.redirect(env.BACKEND_URL + '/de', 302);
    // }

    // 5. Forward to backend (Vercel)
    const backendUrl = env.BACKEND_URL + url.pathname + url.search;
    const backendRequest = new Request(backendUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
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
