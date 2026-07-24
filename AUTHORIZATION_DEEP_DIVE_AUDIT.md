# LOCK-IN Authorization Deep-Dive Audit

**Date:** 2026-07-24  
**Scope:** Authorization / access control / RLS / role enforcement only  
**Repo branch:** `arena/019f92f8-lock-in`  
**Reviewed areas:** Next.js middleware, client Supabase usage, admin UI, account deletion, team/feed flows, public profile flows, SQL schema and migrations.

---

## Executive Summary

The previous audit correctly identified missing server-side admin enforcement, but it understated several deeper authorization failures. The most serious issue is **not just that admin checks are client-side**. The database currently lets normal authenticated users mutate authorization-critical data directly.

### Highest-risk conclusions

1. **Any authenticated user can likely make themselves an admin** by inserting/updating their own `profiles.role` because RLS only checks `auth.uid() = id`, not whether `role` is allowed to change.
2. **Any user can directly forge their own streak / leaderboard position** because `streaks` is writable by the owner.
3. **Any user can self-join any team** because `team_members` insert only checks `auth.uid() = user_id`; `teams` and team IDs are readable.
4. **A team member can forge team-feed posts as another user** because `team_startup_log` insert does not require `NEW.user_id = auth.uid()`.
5. **Admin operations are all direct client-to-Supabase writes**, so the entire admin boundary depends on mutable `profiles.role` and RLS policy correctness.
6. **Several “protected” member resources are public or directly queryable through Supabase** because policies use `USING (true)` and the leaderboard is explicitly granted to `anon`.

**Overall status:** CRITICAL. The app needs an authorization redesign, not just UI-level fixes.

---

## Threat Model Used

Assumed attacker:

- Has a normal authenticated member account.
- Can open DevTools or run Supabase JS using the public anon key and their session.
- Does not need service-role credentials.
- Does not need to bypass authentication.

Important architectural fact: this app performs nearly all database reads/writes directly from client components through `lib/supabase.ts`. Therefore **RLS is the real authorization layer**. Middleware and React state are only UX gates unless backed by immutable server/database checks.

---

# Critical Findings

## C-01 — Members can self-promote to admin through `profiles.role`

**Severity:** Critical  
**Impact:** Full privilege escalation to admin  
**Locations:**

- `sql/schema.sql:163-167`
- `sql/update-v2.sql:155-158`
- `sql/fix-rls-final.sql:60-66`
- `app/admin/page.tsx:65-72`, `app/admin/page.tsx:215-226`

### Evidence

The base profile policies allow a user to insert/update their own profile row with no restriction on privileged columns:

```sql
CREATE POLICY "Profiles: insert own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Profiles: update own" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
```

The later “admin update any” policy still includes `auth.uid() = id` in both `USING` and `WITH CHECK`:

```sql
CREATE POLICY "Profiles: admin update any" ON profiles FOR UPDATE USING (
  auth.uid() = id OR EXISTS (... role = 'admin')
) WITH CHECK (
  auth.uid() = id OR EXISTS (... role = 'admin')
);
```

Because RLS policies are OR-combined, a member’s own-row update remains allowed. RLS is row-level, not column-level, so `role` is not protected.

### Exploit shape

A normal member can attempt:

```ts
await supabase
  .from('profiles')
  .update({ role: 'admin' })
  .eq('id', session.user.id);
```

If the user has no profile yet, the insert policy is also dangerous:

```ts
await supabase.from('profiles').insert({
  id: session.user.id,
  username: 'attacker',
  email: session.user.email,
  role: 'admin'
});
```

### Why this is worse than “client-side admin check”

The admin UI reads `profiles.role` client-side (`app/admin/page.tsx:65-72`) and then exposes admin operations when role is `admin`. Admin RLS policies also trust the same mutable field. So once `profiles.role` is self-mutated, the attacker becomes admin for both UI and RLS.

### Required fix

- Treat admin status as privileged server-controlled state.
- Do **not** let normal clients write `profiles.role` or `profiles.email`.
- Add a DB trigger that rejects `role`/`email` changes unless run by service role or a secure admin function.
- Prefer a separate locked table, e.g. `admin_users(user_id uuid primary key)`, managed only server-side/service-role.
- Replace client role toggles with a server route or `SECURITY DEFINER` RPC that:
  - verifies caller is admin using trusted source,
  - prevents last-admin demotion,
  - logs the action.

---

## C-02 — Users can forge streaks and leaderboard rankings

**Severity:** Critical  
**Impact:** Complete integrity loss for streaks, leaderboard, achievements, analytics  
**Locations:**

- `sql/fix-rls-final.sql:56-58`
- `sql/schema.sql:190-192`
- `app/leaderboard/page.tsx:41-45`
- `components/admin/AnalyticsTab.tsx:56-64`
- `components/admin/DemoSeedTab.tsx:229`

### Evidence

The `streaks` table is owner-writable:

```sql
CREATE POLICY "Streaks: user only" ON streaks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

That means members can insert/update/delete their own streaks directly.

### Exploit shape

```ts
await supabase.from('streaks').upsert({
  user_id: session.user.id,
  current_streak: 999,
  best_streak: 999,
  last_check_in_date: new Date().toISOString().slice(0, 10)
}, { onConflict: 'user_id' });
```

The leaderboard view reads `streaks` and is explicitly exposed (`sql/feat-leaderboard-cohort.sql:18-34`). This turns forged streaks into public rank manipulation.

### Required fix

- Users should have `SELECT own` only on `streaks`.
- Remove client `INSERT/UPDATE/DELETE` policies for `streaks`.
- Make `update_streak()` a hardened `SECURITY DEFINER` function with a fixed `search_path`.
- Recompute streaks from `check_ins`, or use a server-only RPC to update streaks.

---

## C-03 — Users can self-join any team and gain private team access

**Severity:** Critical  
**Impact:** Unauthorized team membership, private feed disclosure, team impersonation path  
**Locations:**

- `sql/fix-rls-final.sql:19-25`
- `sql/update-v2.sql:212-216`
- `app/team/page.tsx:78-96`

### Evidence

Current final policy:

```sql
CREATE POLICY "Team members: authenticated read" ON team_members
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Team members: insert own" ON team_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

`teams` is readable with `USING (true)`, and the team page queries all teams:

```ts
supabase.from('teams').select('*').order('created_at', { ascending: false })
```

So a member can enumerate team IDs, then insert themselves into any team.

### Exploit shape

```ts
await supabase.from('team_members').insert({
  team_id: targetTeamId,
  user_id: session.user.id
});
```

After that, `team_startup_log` read policy authorizes them as a team member.

### Required fix

- Remove member self-insert into `team_members`.
- Team assignment should be admin-only or invitation-token based.
- Use a `team_invites` table with single-use tokens if self-join is needed.
- Replace broad `authenticated read` with same-team read using a `SECURITY DEFINER` helper, e.g. `is_team_member(team_id uuid)` to avoid recursive policy problems.

---

## C-04 — Team-feed posts can be forged as another user

**Severity:** Critical / High  
**Impact:** Impersonation inside team feed, audit ambiguity, harassment/moderation risk  
**Locations:**

- `sql/fix-rls-final.sql:43-46`
- `sql/schema.sql:210-213`
- `app/team/page.tsx:131-141`

### Evidence

The insert policy checks that the caller belongs to the team, but does **not** check that the row’s `user_id` equals the caller:

```sql
CREATE POLICY "Team log: members insert" ON team_startup_log
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM team_members WHERE team_id = team_startup_log.team_id AND user_id = auth.uid())
  );
```

The client sets `user_id` honestly:

```ts
await supabase.from('team_startup_log').insert({
  team_id: teamId,
  user_id: userId,
  note: postText.trim(),
});
```

But an attacker can submit any `user_id` in the row.

### Required fix

Change the policy to require both:

- caller is a member of the target team,
- `user_id = auth.uid()`.

Example:

```sql
CREATE POLICY "Team log: insert own as team member"
ON team_startup_log
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND is_team_member(team_id)
);
```

---

## C-05 — Admin authorization depends on mutable client-readable profile role

**Severity:** Critical  
**Impact:** All admin operations are exposed after C-01  
**Locations:**

- `app/admin/page.tsx:57-87`
- `app/admin/page.tsx:184-295`
- `middleware.ts:49-53`

### Evidence

Admin page checks role in a client effect:

```ts
const { data: profile } = await supabase
  .from('profiles')
  .select('role,email')
  .eq('id', session.user.id)
  .maybeSingle();
```

Admin mutations are direct client writes:

- Cohort create/update: `app/admin/page.tsx:184-205`
- Role toggle: `app/admin/page.tsx:215-226`
- Report publish: `app/admin/page.tsx:237-244`
- Announcement publish: `app/admin/page.tsx:254-261`
- Team creation: `app/admin/page.tsx:271-278`
- Bug report triage: `app/admin/page.tsx:289-295`

Middleware only checks authentication:

```ts
const protectedPaths = ['/dashboard', '/schedule', '/team', '/reports', '/community', '/admin'];
if (isProtected && !user) { ... }
```

### Required fix

- Add server-side `/api/admin/*` routes or server actions.
- Centralize `requireAdmin()` on the server.
- Use service-role only inside server routes, never in the browser.
- Keep RLS strict anyway; server routes should not be the only control.
- Add middleware admin redirect for `/admin` as a UX optimization, but do not rely on it as the primary authorization layer.

---

## C-06 — Check-ins are client-forgeable and can reference inconsistent blocks

**Severity:** Critical / High  
**Impact:** Streak cheating, analytics pollution, inconsistent data  
**Locations:**

- `sql/fix-rls-final.sql:52-54`
- `app/dashboard/page.tsx:263-270`

### Evidence

Check-ins are owner-writable:

```sql
CREATE POLICY "Check-ins: user only" ON check_ins
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

The client sends `completed_at` directly:

```ts
await supabase.from('check_ins').upsert({
  user_id: userId,
  time_block_id: realId,
  completed_at: new Date().toISOString(),
  missed: false,
})
```

The policy does not verify:

- the `time_block_id` belongs to the same `user_id`,
- the check-in is within an allowed time window,
- `completed_at` is server-generated,
- the block is for today,
- the user has not exceeded expected daily check-ins.

### Required fix

- Move check-in creation to a server route or a `SECURITY DEFINER` RPC.
- Server should set `completed_at = now()`.
- Validate `time_blocks.user_id = auth.uid()`.
- Enforce time window / grace period server-side.
- Consider making `check_ins` client-readable only, not directly writable.

---

# High Findings

## H-01 — `profiles` SELECT exposes too much data to everyone

**Severity:** High  
**Impact:** User email/privacy disclosure, role enumeration, preference leakage  
**Locations:**

- `sql/schema.sql:159-161`
- `sql/fix-auth-and-admin.sql:52-54`
- `app/admin/page.tsx:108-110`
- `app/team/page.tsx:105-109`

### Evidence

Profiles are globally selectable:

```sql
CREATE POLICY "Profiles: select all" ON profiles FOR SELECT USING (true);
```

The admin page fetches all columns from profiles:

```ts
supabase.from('profiles').select('*')
```

Team page fetches emails for teammates:

```ts
supabase.from('profiles').select('id,username,email').in('id', allUserIds)
```

Because RLS is per-row, not per-column, anyone who can select a profile row can query columns the UI does not normally show, including `email`, `role`, and `reminder_prefs` if present.

### Required fix

- Split `profiles` into public and private data:
  - `public_profiles`: `id`, `username`, `created_at`, maybe public avatar.
  - `profile_private`: `id`, `email`, `timezone`, reminder prefs.
- Or expose a `public_profiles` view and revoke direct client SELECT on `profiles`.
- Restrict private profile fields to own user/admin server routes.

---

## H-02 — Reports, community posts, teams, and cohorts use `USING (true)`

**Severity:** High if member-only content; Medium if intentionally public  
**Impact:** Middleware protection is bypassable through direct Supabase queries  
**Locations:**

- `sql/fix-rls-final.sql:92-113`
- `middleware.ts:49-53`
- `app/reports/page.tsx:47-62`
- `app/community/page.tsx:26-31`

### Evidence

Examples:

```sql
CREATE POLICY "Reports: members read" ON reports FOR SELECT USING (true);
CREATE POLICY "Community: members read" ON community_posts FOR SELECT USING (true);
CREATE POLICY "Teams: members read" ON teams FOR SELECT USING (true);
CREATE POLICY "Cohorts: members read" ON cohorts FOR SELECT USING (true);
```

If these are intended for members, this should be:

```sql
USING (auth.role() = 'authenticated')
```

or stricter cohort/team membership checks.

### Required fix

Decide explicitly:

- Public marketing content: put in public tables/views.
- Member content: require `auth.role() = 'authenticated'` or membership.
- Team content: require `is_team_member(team_id)`.

---

## H-03 — Leaderboard bypasses underlying RLS and is granted to anonymous users

**Severity:** High / Medium depending on public-intent  
**Impact:** Public exposure of usernames and streaks; bypasses `streaks` RLS  
**Locations:**

- `sql/fix-rls-final.sql:71-87`
- `sql/feat-leaderboard-cohort.sql:18-34`
- `app/leaderboard/page.tsx:41-45`

### Evidence

```sql
CREATE OR REPLACE VIEW leaderboard
WITH (security_invoker = false)
AS ... LEFT JOIN streaks ...

GRANT SELECT ON leaderboard TO authenticated;
GRANT SELECT ON leaderboard TO anon;
```

`security_invoker = false` means the view can bypass underlying table RLS depending on owner privileges. That is currently used to expose streaks that the `streaks` table itself would hide.

### Required fix

- Remove `GRANT SELECT ... TO anon` unless the leaderboard is intentionally public.
- Prefer `security_invoker = true` and explicit RLS-compatible views.
- If a public leaderboard is intentional, create a narrow public materialized view with only safe fields.

---

## H-04 — Achievements can be inserted by any client

**Severity:** High for integrity  
**Impact:** Fake badges/social proof; possible metadata spam  
**Locations:**

- `sql/feat-social-analytics.sql:27-29`
- `sql/feat-all-pending.sql:174-176`

### Evidence

```sql
CREATE POLICY "Achievements: insert via trigger or service" ON achievements
  FOR INSERT WITH CHECK (true);
```

The comment says “trigger or service,” but `WITH CHECK (true)` means any role with table insert privileges can insert any achievement row allowed by table grants.

### Required fix

- Remove public/client insert policy.
- Use `SECURITY DEFINER` trigger/function to grant achievements.
- Add `CHECK (code IN (...))` or a reference table for valid achievements.

---

## H-05 — Bug report identity can be spoofed

**Severity:** High / Medium  
**Impact:** Misattributed support tickets, admin confusion  
**Locations:**

- `sql/feat-bug-reports.sql:24-27`
- `app/settings/page.tsx:163-169`

### Evidence

Policy only checks `user_id`:

```sql
FOR INSERT WITH CHECK (auth.uid() = user_id)
```

But the row also contains `user_email`, which is accepted from the client:

```ts
user_email: userEmail,
```

A malicious user can submit a report with their own `user_id` but another user’s email.

### Required fix

- Store only `user_id` from client and derive email server-side for admin display.
- Or add a trigger that overwrites `user_email` from `auth.jwt()->>'email'` / auth user lookup.

---

## H-06 — Account deletion is client-controlled and incomplete

**Severity:** High  
**Impact:** Data retention/compliance failure; partial delete; auth user persists  
**Locations:**

- `app/settings/delete/page.tsx:39-63`

### Evidence

Client deletes selected tables and silently ignores failures:

```ts
for (const t of tables) {
  try {
    await supabase.from(t.name).delete().eq(t.column, userId);
  } catch {}
}
await supabase.from('profiles').delete().eq('id', userId);
await supabase.auth.signOut();
```

Problems:

- Auth user is not deleted.
- `achievements`, `streak_freezes`, `profile_views`, `bug_reports` are omitted.
- `team_startup_log` has no delete policy in current SQL, so the delete likely fails.
- Failures are swallowed.

### Required fix

Create `POST /api/account/delete`:

- verify current session,
- delete via service role in transaction-like order,
- delete `auth.users` using Supabase Admin API,
- log the deletion,
- return explicit success/failure.

---

# Medium Findings

## M-01 — Middleware route coverage is incomplete and not role-aware

**Locations:** `middleware.ts:49-53`

Protected paths currently exclude several member/account pages such as `/settings`, `/settings/delete`, `/history`, `/people`, `/leaderboard`, `/welcome`, and `/u/*`. Some of those pages perform client redirects, but middleware should enforce route-level intent consistently.

Also `/admin` is only protected by login presence, not role.

**Fix:** Define explicit route classes:

- public routes,
- authenticated-member routes,
- admin routes.

Then enforce admin role in middleware for UX, while still enforcing real authorization in RLS/server APIs.

---

## M-02 — Public profile implementation conflicts with RLS

**Locations:**

- `app/u/[username]/page.tsx:52-68`
- `app/u/[username]/page.tsx:81-97`
- `sql/feat-social-analytics.sql:41-44`

The public profile page tries to read another user’s `streaks`, `team_members`, and `profile_views` count. Current RLS will block at least `streaks` and `profile_views` for non-owners. If the intent is public profiles, create a dedicated safe public view. If not, remove the public data from the page.

Also, `profile_views` has a SELECT-own policy but no INSERT policy, so view logging likely fails unless another policy exists in production.

---

## M-03 — Admin analytics cannot be correct under strict RLS, and becomes dangerous under loose RLS

**Locations:** `components/admin/AnalyticsTab.tsx:56-67`

The admin analytics tab directly queries whole tables from the browser. With correct member-only RLS, many queries return only the admin’s rows. If RLS is loosened to make analytics work, sensitive cohort-wide data becomes readable to clients.

**Fix:** Move analytics to server-side aggregate endpoints/RPCs that return only aggregate metrics and verify admin server-side.

---

## M-04 — Demo seed tab is architecturally incompatible with RLS and performs bulk client writes

**Locations:**

- `components/admin/DemoSeedTab.tsx:76-140`
- `components/admin/DemoSeedTab.tsx:154-232`
- `components/admin/DemoSeedTab.tsx:270-320`
- `components/admin/DemoSeedTab.tsx:360-363`

The code acknowledges it cannot create profiles without service role but still attempts bulk inserts/deletes in many tables from the client. This creates either failure-prone demo behavior or pressure to weaken RLS.

**Fix:** Move seeding to a server-only script, Supabase Edge Function, or admin API requiring service role and a strong typed confirmation.

---

## M-05 — Policy drift and inconsistent DROP names make migrations unsafe

Multiple SQL files create similarly named policies, and later files do not always drop earlier policy names. Example: `schema.sql` creates `Profiles: select all members for leaderboard`; `update-v2.sql` drops `Profiles: select all members`, a different name. `fix-auth-and-admin.sql` drops more names, but `fix-rls-final.sql` does not fully reset profile policies.

Because RLS policies are OR-combined, one stale permissive policy can defeat later stricter policies.

**Fix:** Create one canonical migration that:

1. drops all known old policy names,
2. enables/forces RLS,
3. recreates only the intended policies,
4. includes verification queries against `pg_policies`.

---

# Authorization Matrix

| Area | Current state | Risk | Target state |
|---|---|---:|---|
| `profiles.role` | Member can insert/update own row including role | Critical | Server/service-only role changes; trigger blocks role edits |
| `profiles.email` | Member can update own profile email field | High | Derived from auth user; not client-writable |
| `streaks` | Owner can `FOR ALL` | Critical | Client SELECT only; server/trigger writes |
| `check_ins` | Owner can write arbitrary completed_at/block ID | High | Server/RPC validates time and block ownership |
| `team_members` | Any auth can read all; users can self-insert | Critical | Admin/invite-only writes; same-team read only |
| `team_startup_log` | Member can insert without `user_id = auth.uid()` | Critical/High | Insert own posts only; same-team read |
| `achievements` | `WITH CHECK (true)` insert | High | Trigger/service-only insert |
| `leaderboard` view | Bypasses RLS, granted to anon | High/Medium | Auth-only or narrow intentional public view |
| `reports/community` | Read `USING (true)` | Medium/High | Auth-only if member content |
| `bug_reports` | Insert own ID, spoofable email | Medium | Server derives identity |
| Admin operations | Browser direct writes | Critical | Server APIs + audit log |
| Account deletion | Browser best-effort deletes | High | Server API + auth user delete |

---

# Priority Remediation Plan

## Phase 0 — Immediate containment

1. Remove member ability to write `profiles.role` and `profiles.email`.
2. Remove client write access to `streaks` and `achievements`.
3. Remove self-insert from `team_members`.
4. Fix `team_startup_log` insert to require `user_id = auth.uid()`.
5. Remove `GRANT SELECT ON leaderboard TO anon` unless intentionally public.

## Phase 1 — Server authorization boundary

1. Add `lib/authz.ts` with server helpers:
   - `getSessionUser()`
   - `requireUser()`
   - `requireAdmin()`
2. Add server API routes for admin mutations:
   - role changes,
   - cohort/team management,
   - report/community publishing,
   - bug report triage,
   - demo seed if retained.
3. Use service role only in server routes.
4. Add audit logging for all admin actions.

## Phase 2 — RLS redesign

1. Split public/private profile data.
2. Use `SECURITY DEFINER` helpers for team membership checks.
3. Convert streak/check-in writes to RPC/server-only.
4. Replace permissive `USING (true)` with explicit public/authenticated/member policies.
5. Add verification SQL tests for each table.

## Phase 3 — Data integrity and abuse controls

1. Rate-limit bug reports and check-ins.
2. Add server-side check-in time windows.
3. Add team feed moderation/delete controls.
4. Implement complete server-side account deletion.

---

# Suggested SQL Direction

Illustrative only — adapt to your migration style.

```sql
-- 1. Block client role/email mutation
CREATE OR REPLACE FUNCTION prevent_profile_privilege_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF TG_OP = 'INSERT' AND NEW.role IS DISTINCT FROM 'member' THEN
      RAISE EXCEPTION 'role is not client-writable';
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'role is not client-writable';
      END IF;
      IF NEW.email IS DISTINCT FROM OLD.email THEN
        RAISE EXCEPTION 'email is not client-writable';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_changes ON profiles;
CREATE TRIGGER trg_prevent_profile_privilege_changes
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION prevent_profile_privilege_changes();

-- 2. Streaks: read only to owner; writes by server/trigger only
DROP POLICY IF EXISTS "Streaks: user only" ON streaks;
CREATE POLICY "Streaks: read own" ON streaks
FOR SELECT USING (auth.uid() = user_id);

-- 3. Team logs: no impersonation
DROP POLICY IF EXISTS "Team log: members insert" ON team_startup_log;
CREATE POLICY "Team log: insert own"
ON team_startup_log
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = team_startup_log.team_id
      AND tm.user_id = auth.uid()
  )
);
```

For team membership policies, avoid recursive RLS failures by using `SECURITY DEFINER` helper functions owned by a privileged DB role.

---

# Bottom Line

The authorization model currently trusts mutable user-controlled rows (`profiles.role`, `streaks`, `team_members`) as if they were authoritative server-owned state. Fixing the admin page alone will not be sufficient. The core repair is to move privileged state transitions behind server/RPC boundaries and make RLS deny unsafe client writes by default.
