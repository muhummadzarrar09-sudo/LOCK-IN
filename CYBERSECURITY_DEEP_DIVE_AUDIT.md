# LOCK-IN Cybersecurity Deep-Dive Audit

**Date:** 2026-07-24  
**Scope:** broad application security beyond authorization: abuse/flooding, XSS/injection, CSRF, dependency risk, service worker caching, security headers, redirects, API hardening, data exposure, operational DDoS posture.  
**Important limitation:** no audit can honestly prove “every single vulnerability” is gone. This report documents the repo-level review and the controls added in this pass. Production infrastructure, Supabase project settings, DNS/CDN/WAF rules, secrets, and runtime logs still need environment-level review.

---

## Executive Summary

This pass found and addressed several non-authorization security weaknesses:

- **No API-level CSRF/origin enforcement** for cookie-authenticated state-changing routes.
- **Weak API flood protection** on new server routes.
- **No request body size enforcement** before JSON parsing.
- **Dependency audit showed high-severity transitive issues** from `postcss`/`sharp` via `next`.
- **Reports/command-palette search interpolated user input into PostgREST `.or()` filter strings.**
- **Login page had an open redirect risk** via unvalidated `redirect` query.
- **Service worker cached authenticated/member navigations**, creating offline disclosure risk after logout/shared-device use.
- **Security headers/CSP were present in `vercel.json`/Cloudflare Worker but missing from Next middleware responses.**
- **DDoS protection is still not complete at the app layer**; real volumetric DDoS needs CDN/WAF/rate limits outside the Next process.

---

## Fixes Applied in This Pass

### 1. Dependency vulnerabilities remediated

Updated `package.json` with overrides:

```json
"overrides": {
  "sharp": "0.35.3",
  "postcss": "8.5.22"
}
```

Then ran `npm install`.

Validation:

```bash
npm audit --omit=dev
# found 0 vulnerabilities
```

### 2. API CSRF / origin protection added

Created:

- `lib/security.ts`

Added:

- `assertSameOrigin(request)`
- `assertJsonRequest(request)`
- `rateLimit(request, ...)`
- `enforceApiSecurity(request, ...)`
- `SecurityError` support in `lib/api-errors.ts`

State-changing API routes now reject cross-origin browser submissions by checking `Origin` against `Host`.

Protected routes include:

- admin role updates
- admin cohort writes
- admin report/community/team writes
- admin bug report triage
- member check-ins
- bug report submission
- account deletion

### 3. API request body size/content-type controls added

`enforceApiSecurity()` now rejects:

- non-JSON POST/PATCH requests
- oversized JSON bodies based on `Content-Length`

Default body limit is 64 KiB unless overridden.

### 4. API rate limiting added

Added in-memory per-user/IP rate limits to API routes.

Examples:

- bug reports: 10/minute API-level plus 5/hour DB-backed throttle
- check-ins: 120/minute
- admin writes: 20–60/minute depending route
- analytics/time-block reads: rate-limited GETs
- account deletion: 5/minute

**Caveat:** in-memory rate limits are only a best-effort app-layer guard. Serverless deployments may have multiple instances. Real DDoS/flood defense must be enforced at CDN/WAF/Supabase/API gateway level.

### 5. Open redirect fixed

Updated:

- `app/auth/login/page.tsx`

Now only internal redirects are honored:

- must start with `/`
- must not start with `//`
- must not target `/auth`

External URLs in `?redirect=` are ignored and replaced with `/dashboard` or `/admin` based on role.

### 6. PostgREST `.or()` filter injection risk reduced

Created:

- `lib/search.ts`

Added:

- `safeSearchTerm()`
- `safeIlikePattern()`

Updated:

- `app/reports/page.tsx`
- `components/CommandPalette.tsx`

Search terms are normalized before being interpolated into `.or()` filters.

### 7. Service worker protected-page caching fixed

Updated:

- `public/sw.js`

Before: cached all navigations and had reports offline caching.  
Now: caches public navigations only and keeps member/dynamic pages network-only.

This reduces risk of authenticated UI shells/content being available offline after logout or on shared devices.

### 8. Security headers added in middleware

Updated:

- `middleware.ts`

Added headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`
- `X-DNS-Prefetch-Control`
- `Cross-Origin-Opener-Policy`
- `Cross-Origin-Resource-Policy`
- `Strict-Transport-Security`
- `Content-Security-Policy`

CSP is intentionally compatible with the current app and Google Fonts. It still allows `'unsafe-inline'` because the app currently uses inline scripts/styles through Next/speculation rules. A stricter nonce-based CSP should be a later hardening phase.

---

## Remaining Risks / Follow-Up Required

## R-01 — Real DDoS protection is not solved by application code

**Status:** partially mitigated only

The repo includes a Cloudflare Worker with simple per-worker memory rate limits. The new Next API routes also use in-memory rate limits. These are useful against accidental floods and small abuse, but not enough for real DDoS.

### Required production controls

- Put the app behind Cloudflare/Vercel WAF.
- Enable bot fight / managed challenge for suspicious traffic.
- Use durable rate limiting:
  - Cloudflare Rate Limiting Rules
  - Cloudflare Turnstile for auth/signup/forgot if abused
  - Upstash Redis / Cloudflare KV/Durable Objects for API limits
- Add Supabase project-level limits where possible.
- Add alerts for:
  - request spikes
  - auth failures
  - bug report spikes
  - check-in spikes
  - API 429/403 spikes

---

## R-02 — CSP still allows inline script/style

**Status:** improved but not strict

Current CSP must allow inline script/style due app constraints. This reduces CSP’s ability to stop XSS payload execution.

### Future fix

- Remove inline scripts where possible.
- Use Next nonce-based CSP.
- Avoid `dangerouslySetInnerHTML` for speculation rules or provide a nonce.
- Move to:

```text
script-src 'self' 'nonce-...'
style-src 'self' 'nonce-...' https://fonts.googleapis.com
```

---

## R-03 — Serverless in-memory rate limits are bypassable across instances

**Status:** best-effort only

`lib/security.ts` uses a process-local Map. This does not provide global consistency across multiple serverless functions/regions.

### Future fix

Use durable shared counters:

- Upstash Redis
- Vercel KV
- Cloudflare Durable Objects
- Supabase `rate_limits` table with an atomic RPC

---

## R-04 — Search still uses client-side Supabase queries

**Status:** sanitized, but not ideal

Reports and command palette search now normalize `.or()` query terms, but search is still client-to-Supabase and can be used for enumeration/load.

### Future fix

Move search to `/api/search` with:

- rate limit
- max query length
- server-side validation
- aggregate/narrow response shape
- optional full-text search indexes

---

## R-05 — Public profile and leaderboard privacy still need product decisions

The authorization pass restricted anonymous leaderboard access in SQL, but public profile behavior still needs a product-level decision:

- authenticated-only member profiles, or
- deliberately public narrow views

Do not expose direct `profiles`, `streaks`, or `team_members` to anonymous users.

---

## R-06 — Cloudflare Worker rate limiting is per-worker memory

`cloudflare/worker.ts` uses a `Map`, so counters reset per isolate and do not coordinate globally. This is not enough for DDoS.

### Future fix

Implement Cloudflare-native rate rules or Durable Objects.

---

## R-07 — Supabase Realtime abuse remains possible

The app subscribes to realtime channels. If a malicious user can generate many events, clients may be forced to refresh/re-render repeatedly.

### Future fix

- Ensure writes to realtime-published tables are rate limited.
- Avoid subscribing to broad tables where possible.
- Prefer server-side event aggregation for high-volume feeds.

---

## Attack Surface Checklist

| Area | Status |
|---|---|
| Dependency audit | Fixed: `npm audit --omit=dev` returns 0 vulnerabilities |
| Admin API authz | Improved: `requireAdmin()` + service-role server routes |
| API CSRF | Improved: same-origin check for state-changing APIs |
| API body flood | Improved: content-length limit for JSON routes |
| API rate limits | Improved: app-layer in-memory limits |
| Real DDoS | Requires CDN/WAF/durable limits |
| Open redirect | Fixed in login redirect flow |
| Search filter injection | Reduced via safe query normalization |
| XSS rendering | React escapes user content; CSP added; strict CSP still pending |
| Service worker cache disclosure | Fixed for protected/member navigations |
| Security headers | Added in middleware; Vercel/Worker also have baseline headers |
| Secrets exposure | Service role helper is server-only; ensure env var is never NEXT_PUBLIC |
| File upload malware | No file upload surface found |
| SSRF | No user-controlled server-side fetch target found in app APIs |
| SQL injection | Supabase query builder mostly used; `.or()` interpolation sanitized in reviewed spots |
| CSRF on auth pages | Supabase-managed auth; app APIs protected |
| Account deletion | Moved server-side with auth user deletion |

---

## Recommended Next Hardening Sprint

1. Apply `sql/authorization-hardening.sql` in Supabase.
2. Add Cloudflare/Vercel WAF rate rules:
   - `/api/*`
   - `/auth/*`
   - `/reports`
   - `/people`
3. Replace in-memory rate limiting with Redis/KV/Durable Object counters.
4. Move search into `/api/search`.
5. Adopt nonce-based CSP.
6. Add Sentry/Logtail/Datadog alerts for 403/429 spikes.
7. Add automated security tests:
   - CSRF Origin rejection
   - open redirect rejection
   - body size rejection
   - API rate limit rejection
   - RLS exploit attempts from authorization audit
8. Add a production incident runbook for DDoS and credential compromise.

---

## Validation Performed

```bash
npm audit --omit=dev
# found 0 vulnerabilities

npm run build
# compiled successfully
```
