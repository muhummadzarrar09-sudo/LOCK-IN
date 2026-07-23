# Fix: Stuck at AUTHORIZE / Accessing... even as Admin

## Root Cause (Why it was stuck)

You reported: after clicking Authorize, page stuck on "Accessing..." / "AUTHORIZE..." even though `profiles.role = 'admin'`.

There were **3 layered bugs**:

### 1. Cookie Name Mismatch + No SSR Supabase (MAIN BUG)
`middleware.ts` looked for cookies:
```ts
request.cookies.get('sb-access-token') || get('supabase-auth-token')
```
But Supabase Auth (when using `@supabase/ssr`) actually stores cookies as:
`sb-<PROJECT_REF>-auth-token` + chunked variants.

So `authCookie` was **always undefined**. Middleware thought you were never logged in.

### 2. Client Auth vs Server Auth Mismatch
`lib/supabase.ts` used:
```ts
import { createClient } from '@supabase/supabase-js'
```
This only writes to `localStorage`, **not HTTP cookies**. Middleware cannot read localStorage, so it kept redirecting `/dashboard` -> `/auth/login?redirect=/dashboard` in a loop.

On the login page:
```ts
router.push(redirectTo)
router.refresh()
```
But middleware redirected back instantly, so React state stayed `loading=true`, button stuck showing "Accessing..." forever.

### 3. Profile ID Mismatch (Admin not recognized)
Old `allow-myself.sql` used `ON CONFLICT (email)`. If you signed up first as member, you had a profile row with `id = your actual auth uid` but maybe later insert with different id? Or you had two rows. The `INSERT ... SELECT id FROM auth.users` could insert, but on email conflict it updated role but **not id**, leaving a stale id that didn't match `auth.uid()`. So:
```sql
EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role='admin')
```
returned false -> admin policies failed, you couldn't write cohorts.

## Fixes Applied

### A. `lib/supabase.ts` -> Browser SSR client
```ts
import { createBrowserClient } from '@supabase/ssr'
export const supabase = createBrowserClient(url, key)
```
Now login writes proper `sb-xxx-auth-token` cookies that middleware can see.

### B. `lib/supabase-server.ts` -> Async cookies() + placeholder fallback
Made it safe for Next 15+ where `cookies()` is async, and doesn't crash build when env missing.

### C. `middleware.ts` -> Full rewrite using Supabase SSR pattern
Official recommended pattern:
- createServerClient with `request.cookies.getAll()` / `setAll()`
- `await supabase.auth.getUser()` to validate + refresh session
- Preserve refreshed cookies on redirects
- Proper protected paths + auth page redirect logic

### D. `app/auth/login/page.tsx` -> Fix stuck loading + role-aware redirect + hard reload
- Wrapped `useSearchParams` in Suspense (required for build)
- After login, fetch `profiles.role`
- If no explicit `?redirect=`, admin goes to `/admin`, member to `/dashboard`
- Use `window.location.href = finalTarget` instead of `router.push` to force full cookie send and avoid React state stuck
- Auto-creates missing profile if `PGRST116`

### E. `app/dashboard/page.tsx` + `app/admin/page.tsx` -> Auth guards + helpful errors
- Check session on mount, redirect to login if missing
- Show role in header
- Admin page shows exact SQL to fix if role != admin, instead of silently failing
- Cohort load uses `maybeSingle` not `single` to avoid 406 errors
- Added sign-out buttons

### F. `components/Navbar.tsx` -> Client + role-aware + logout
- Shows Admin link only if role=admin
- Adds sign-out

### G. `sql/fix-auth-and-admin.sql` + updated `allow-myself.sql`
Robust PL/pgSQL block that:
- Looks up real `auth.users.id`
- Upserts profile on `id` conflict (not email)
- Deletes stale duplicate email rows
- Ensures cohort exists

### H. `app/auth/callback/route.ts`
Handles OAuth/email confirmation code exchange.

### I. `app/layout.tsx`
Moved `themeColor` and `viewport` to `viewport` export to remove Next.js warnings.

### J. Placeholder env fallback
So `npm run build` doesn't crash on CI without env, but Vercel runtime uses real env.

## What you need to do on Vercel / Supabase

1. **In Vercel dashboard** -> Your project -> Settings -> Environment Variables, ensure set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   Redeploy.

2. **In Supabase SQL Editor** run `sql/fix-auth-and-admin.sql` (replace email if needed):
   ```sql
   -- will ensure profile id matches auth.users id and role=admin
   ```

3. **Redeploy** vercel app (push to branch or manual redeploy). The demo url `https://lock-in-demo.vercel.app/auth/login?redirect=%2Fdashboard` should now:
   - Login -> set cookies -> middleware sees user -> allow `/dashboard` or `/admin`
   - No more "Accessing..." stuck

## How to test locally

```bash
cp .env.local.example .env.local # add your supabase keys
npm install
npm run dev
```

Login with admin email should now redirect to `/admin` (if no redirect param) or respect `?redirect=`.

## Future improvements

- Use Supabase Auth email confirmation disabled for paid members, or handle `callback` route properly.
- FK for `check_ins.time_block_id` currently expects UUID from `time_blocks`, but dashboard uses `b1,b2` ids. Either seed time_blocks per user or store check-ins differently.
- RLS: `profiles: select all` allows any visitor to read all emails. Consider restricting to authenticated only: `USING (auth.role() = 'authenticated')`.
