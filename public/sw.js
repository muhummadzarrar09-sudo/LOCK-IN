/**
 * Discipline — Service Worker
 * --------------------------------------------------------------------------
 * Strategy:
 *   - HTML navigations:  network-first, fall back to cached shell.
 *   - Static assets:     cache-first (immutable hashed bundles).
 *   - API / Supabase:    network-only. Never cache.
 *   - Reports:           stale-while-revalidate so they read offline too.
 *
 * Versioned cache name. Bump on deploys to invalidate stale shells.
 */

const VERSION = 'v1';
const SHELL_CACHE = `discipline-shell-${VERSION}`;
const RUNTIME_CACHE = `discipline-runtime-${VERSION}`;
const REPORTS_CACHE = `discipline-reports-${VERSION}`;

const SHELL_URLS = [
  '/',
  '/auth/login',
  '/auth/signup',
  '/auth/forgot',
  '/privacy',
  '/terms',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(SHELL_URLS).catch((err) => {
        // Some of the SHELL_URLS may return non-2xx in dev — log and continue.
        console.warn('[sw] precache partial:', err);
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![SHELL_CACHE, RUNTIME_CACHE, REPORTS_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never intercept Supabase API calls — they need to be live.
  if (url.hostname.includes('supabase')) return;

  // HTML navigations: network-first, fall back to cached shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Cache the latest shell for this route
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Static assets: cache-first.
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icon-') ||
    url.pathname === '/manifest.json' ||
    /\.(js|css|png|jpg|jpeg|svg|ico|webp|gif|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        });
      })
    );
    return;
  }

  // Default: network with cache fallback.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && url.pathname.startsWith('/reports')) {
          const copy = res.clone();
          caches.open(REPORTS_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
