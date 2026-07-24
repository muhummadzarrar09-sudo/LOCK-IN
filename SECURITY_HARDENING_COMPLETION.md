# Security Hardening Completion Notes

**Date:** 2026-07-24

This file tracks the follow-up implementation for the previously listed remaining cybersecurity items.

---

## Completed in this pass

### 1. Durable rate limiting support

Implemented:

- `rate_limit_buckets` table in `sql/authorization-hardening.sql`
- `check_rate_limit(...)` SQL RPC in `sql/authorization-hardening.sql`
- async durable rate limiting in `lib/security.ts`
- memory fallback if the SQL migration has not been applied yet

This means app APIs can use a Supabase-backed limiter instead of only a per-process `Map`.

### 2. Cloudflare Durable Object rate limiter

Updated:

- `cloudflare/worker.ts`
- `cloudflare/wrangler.toml`

The Worker now supports a `RATE_LIMITER` Durable Object binding for edge/global rate limiting. It also keeps local fallback limiting when the Durable Object binding is not configured.

### 3. Stricter CSP with nonce

Updated:

- `middleware.ts`
- `app/layout.tsx`

The middleware now generates a per-request nonce and sends a strict CSP without `unsafe-inline`. The inline speculation-rules script receives the nonce.

### 4. Server-side search endpoint

Created:

- `app/api/search/route.ts`

Updated:

- `app/reports/page.tsx`
- `components/CommandPalette.tsx`

Search is now validated, rate-limited, and routed through the server instead of constructing PostgREST `.or()` filters in the browser.

### 5. Team post flood/impersonation hardening

Created:

- `app/api/team/posts/route.ts`

Updated:

- `app/team/page.tsx`
- `sql/authorization-hardening.sql`

Team posts now go through a server route that:

- validates same-origin JSON request
- rate limits per user
- verifies team membership server-side
- writes `user_id` from the session, not the client

The SQL migration removes the direct client insert policy for `team_startup_log`.

### 6. Profile-view spam hardening

Created:

- `app/api/profile-views/route.ts`

Updated:

- `app/u/[username]/page.tsx`
- `sql/authorization-hardening.sql`

Profile views now go through a server route that:

- rate limits per viewer
- skips self-views
- coalesces duplicate viewer/profile views in a rolling hour

The SQL migration removes direct client insert for `profile_views`.

### 7. Authenticated-only profile pages

Updated:

- `middleware.ts`

`/u/*` is now included in authenticated route protection to avoid public disclosure ambiguity.

### 8. Removed remaining unsafe direct client writes found in this pass

Reviewed direct Supabase writes for:

- `team_startup_log`
- `profile_views`
- `bug_reports`
- `check_ins`
- `time_blocks`
- `streaks`
- `achievements`

Sensitive writes now route through server APIs or service-role code.

---

## Validation

Ran:

```bash
npm audit --omit=dev
```

Result:

```text
found 0 vulnerabilities
```

Ran:

```bash
npm run build
```

Result: build succeeded.

---

## Items that still require deployment/infrastructure action

These cannot be fully completed from the Git repo alone:

1. **Run `sql/authorization-hardening.sql` in Supabase.**
   - The new durable API rate limiter and hardened RLS policies require this migration.

2. **Set production secret:**

```env
SUPABASE_SERVICE_ROLE_KEY=...
```

3. **Deploy/configure Cloudflare Worker Durable Object binding.**
   - `wrangler.toml` now includes the binding and migration, but it must be deployed to Cloudflare.

4. **Set Cloudflare Worker secret/var:**

```text
BACKEND_URL=https://your-vercel-deployment.example
```

5. **Enable Cloudflare/Vercel WAF managed rules.**
   - Code-level and Durable Object rate limiting help, but true volumetric DDoS mitigation must be handled at edge/network level.

6. **Production CSP smoke test.**
   - CSP has been tightened; verify in the browser console after deploy that no required Next/Supabase/Font requests are blocked.

---

## Current repo-side security posture

- Dependency audit: clean
- Build: passing
- API state changes: same-origin + JSON + size limited + rate limited
- Privileged writes: server routes/service role
- Search: server-side and rate limited
- Service worker: no protected-page offline caching
- CSP: nonce-based and no `unsafe-inline`
- Edge DDoS config: Durable Object capable
- Remaining blocking task: apply Supabase SQL migration and deploy edge config
