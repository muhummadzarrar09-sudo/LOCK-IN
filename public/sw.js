/**
 * Discipline — Service Worker
 * --------------------------------------------------------------------------
 * Strategy:
 *   - HTML navigations:  network-first, fall back to cached shell.
 *   - Static assets:     cache-first (immutable hashed bundles).
 *   - API / Supabase:    network-only. Never cache.
 *   - Member pages:      network-only to avoid offline disclosure after logout.
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

  const publicNavigationPaths = ['/', '/auth/login', '/auth/signup', '/auth/forgot', '/privacy', '/terms', '/help', '/whats-new'];
  const isPublicNavigation = publicNavigationPaths.includes(url.pathname);

  // HTML navigations: cache public pages only. Authenticated pages may contain
  // account-specific UI state and must not be available from an offline cache
  // after logout or on a shared device.
  if (req.mode === 'navigate') {
    if (!isPublicNavigation) {
      event.respondWith(fetch(req));
      return;
    }

    event.respondWith(
      fetch(req)
        .then((res) => {
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

  // Default: network-only for dynamic/member pages. We intentionally avoid
  // caching reports or other protected routes to prevent offline disclosure
  // after logout or on shared devices.
  event.respondWith(fetch(req));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
