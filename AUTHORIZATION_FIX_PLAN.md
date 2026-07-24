# Authorization Fix Plan — LOCK-IN

**Goal:** repair the authorization model identified in `AUTHORIZATION_DEEP_DIVE_AUDIT.md` without relying on client-side checks.  
**Principle:** anything that changes privilege, membership, streaks, admin content, or account state must be enforced by the database and/or trusted server code, never by React state.

---

## Phase 0 — Preparation and Safety

### 0.1 Freeze risky production features temporarily

Before deploying code fixes, disable or hide the highest-risk UI paths if this app is live:

- Admin role toggle
- Demo seed tab
- Check-in mutation if leaderboard/streak integrity matters
- Team self-membership workflows, if any

This is a UX containment step only. It does not replace the RLS fixes below.

### 0.2 Back up production data

Before running authorization migrations:

1. Export current Supabase schema.
2. Export affected tables:
   - `profiles`
   - `streaks`
   - `check_ins`
   - `achievements`
   - `team_members`
   - `team_startup_log`
   - `reports`
   - `community_posts`
   - `bug_reports`
3. Snapshot current policies:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### 0.3 Create one canonical hardening migration

Create a new SQL file:

```text
sql/authorization-hardening.sql
```

This migration should be the new source of truth for authorization policies. It should drop old policy names explicitly, then recreate only the intended policies.

### 0.4 Add server-only Supabase admin support

Add a server-only helper for service-role operations:

```text
lib/supabase-admin.ts
```

Requirements:

- import `server-only`
- use `SUPABASE_SERVICE_ROLE_KEY`
- never export this helper to client components
- fail loudly if the env var is missing outside local/dev

---

## Phase 1 — Immediate Database Hardening

This phase fixes the critical privilege-escalation and data-forgery issues first.

---

### 1.1 Stop users from changing `profiles.role`

**Problem:** users can currently update their own row, including `role`.

**Target:** members can edit safe profile fields only. Admin role changes must go through server/admin code.

#### SQL actions

In `sql/authorization-hardening.sql`:

1. Drop old profile update policies:

```sql
DROP POLICY IF EXISTS "Profiles: update own" ON profiles;
DROP POLICY IF EXISTS "Profiles: admin update any" ON profiles;
```

2. Recreate a safe own-profile update policy:

```sql
CREATE POLICY "Profiles: user update own safe fields"
ON profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role = 'member'
);
```

This alone is not enough if an existing admin updates themselves, so also add a trigger.

3. Add a trigger to reject client-side role/email changes:

```sql
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
FOR EACH ROW
EXECUTE FUNCTION prevent_profile_privilege_changes();
```

#### App actions

Update these files so profile edits no longer attempt to write privileged columns:

- `app/settings/page.tsx`
- `app/welcome/page.tsx`
- `app/auth/signup/page.tsx`
- `app/auth/login/page.tsx`

Do not send `role` from client signup/welcome flows. Default it in DB.

#### Verification

As a normal member, this must fail:

```ts
await supabase.from('profiles').update({ role: 'admin' }).eq('id', myUserId)
```

As the server/service role, an admin role change must still work through the upcoming API.

---

### 1.2 Lock down `streaks`

**Problem:** users can directly update their own streaks.

**Target:** users can read their own streak. Only server-side logic/triggers can write streaks.

#### SQL actions

```sql
DROP POLICY IF EXISTS "Streaks: user only" ON streaks;

CREATE POLICY "Streaks: read own"
ON streaks
FOR SELECT
USING (auth.uid() = user_id);
```

Do not create client insert/update/delete policies for `streaks`.

#### App actions

Remove any client write path to `streaks`, especially from:

- `components/admin/DemoSeedTab.tsx`

Demo seed must move server-side later.

#### Verification

As a member, this must fail:

```ts
await supabase.from('streaks').upsert({ user_id: myUserId, current_streak: 999 })
```

---

### 1.3 Lock down `achievements`

**Problem:** `WITH CHECK (true)` allows arbitrary badge insertion.

**Target:** users can read intended achievements, but cannot insert badges.

#### SQL actions

```sql
DROP POLICY IF EXISTS "Achievements: insert via trigger or service" ON achievements;
```

Keep read policy only if achievements are intended public/social:

```sql
DROP POLICY IF EXISTS "Achievements: read all authenticated" ON achievements;
CREATE POLICY "Achievements: read authenticated"
ON achievements
FOR SELECT
USING (auth.role() = 'authenticated');
```

If achievements should be private, use only:

```sql
CREATE POLICY "Achievements: read own"
ON achievements
FOR SELECT
USING (auth.uid() = user_id);
```

#### Verification

As a member, this must fail:

```ts
await supabase.from('achievements').insert({ user_id: myUserId, code: 'streak_100' })
```

---

### 1.4 Remove team self-join

**Problem:** users can insert themselves into any team.

**Target:** only admin/server or a controlled invite flow can add team members.

#### SQL actions

```sql
DROP POLICY IF EXISTS "Team members: insert own" ON team_members;
DROP POLICY IF EXISTS "Team members: user manages own" ON team_members;
```

Keep delete-own if users are allowed to leave teams, otherwise remove it too.

For reads, replace broad authenticated read with same-team read.

```sql
DROP POLICY IF EXISTS "Team members: authenticated read" ON team_members;
```

Use a `SECURITY DEFINER` helper to avoid recursive RLS problems:

```sql
CREATE OR REPLACE FUNCTION is_team_member(p_team_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = p_team_id
      AND tm.user_id = p_user_id
  );
$$;

CREATE POLICY "Team members: read same team"
ON team_members
FOR SELECT
USING (is_team_member(team_id));
```

#### App actions

Team assignment must move to an admin API later. Until then, do not expose any client insert into `team_members`.

#### Verification

As a member, this must fail:

```ts
await supabase.from('team_members').insert({ team_id: anyTeamId, user_id: myUserId })
```

---

### 1.5 Stop team-feed impersonation

**Problem:** team members can insert posts with another user’s `user_id`.

**Target:** callers can only post as themselves, and only into their own team.

#### SQL actions

```sql
DROP POLICY IF EXISTS "Team log: members insert" ON team_startup_log;
DROP POLICY IF EXISTS "Team log: team members insert" ON team_startup_log;

CREATE POLICY "Team log: insert own as team member"
ON team_startup_log
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND is_team_member(team_id)
);
```

Keep/select read policy as same-team:

```sql
DROP POLICY IF EXISTS "Team log: members read" ON team_startup_log;
DROP POLICY IF EXISTS "Team log: team members read" ON team_startup_log;

CREATE POLICY "Team log: read same team"
ON team_startup_log
FOR SELECT
USING (is_team_member(team_id));
```

#### Verification

As a team member, this must fail:

```ts
await supabase.from('team_startup_log').insert({
  team_id: myTeamId,
  user_id: someoneElseUserId,
  note: 'fake post'
})
```

---

### 1.6 Restrict leaderboard exposure

**Problem:** leaderboard is granted to anonymous users and bypasses underlying RLS.

**Target:** only authenticated users can read it unless it is intentionally public.

#### SQL actions

```sql
REVOKE SELECT ON leaderboard FROM anon;
GRANT SELECT ON leaderboard TO authenticated;
```

Consider recreating the view with `security_invoker = true` or replacing it with a narrow materialized/public view.

#### Verification

Unauthenticated Supabase query to `leaderboard` must fail.

---

### 1.7 Make member-only tables actually member-only

**Problem:** `USING (true)` allows public read via Supabase even when pages are middleware-protected.

#### SQL actions

For member-only content:

```sql
DROP POLICY IF EXISTS "Reports: members read" ON reports;
CREATE POLICY "Reports: authenticated read"
ON reports
FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Community: members read" ON community_posts;
CREATE POLICY "Community: authenticated read"
ON community_posts
FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Teams: members read" ON teams;
CREATE POLICY "Teams: authenticated read"
ON teams
FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Cohorts: members read" ON cohorts;
CREATE POLICY "Cohorts: authenticated read"
ON cohorts
FOR SELECT
USING (auth.role() = 'authenticated');
```

If any of these are intentionally public, move them to explicit public views/tables instead of mixing public and member data.

---

### 1.8 Add policy verification queries

At the bottom of `sql/authorization-hardening.sql`, include:

```sql
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Also manually verify there are no stale permissive policies. Remember: permissive RLS policies are OR-combined.

---

## Phase 2 — Add Trusted Server Authorization Helpers

---

### 2.1 Create `lib/authz.ts`

Add a server-only authorization helper:

```text
lib/authz.ts
```

Functions:

- `getCurrentUser()`
- `requireUser()`
- `requireAdmin()`
- `assertSameUser(userId)`

`requireAdmin()` should:

1. read the session server-side using the cookie-aware Supabase client,
2. verify user exists,
3. check admin status from trusted DB state,
4. throw/return `403` on failure.

Short term it may read `profiles.role`, but after Phase 1 that role is no longer client-mutable. Longer term, use a separate `admin_users` table.

---

### 2.2 Create `lib/supabase-admin.ts`

Add service-role helper:

```ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase admin env');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

Never import this from client components.

---

## Phase 3 — Move Admin Mutations Behind API Routes

Create these route groups:

```text
app/api/admin/roles/route.ts
app/api/admin/cohorts/route.ts
app/api/admin/reports/route.ts
app/api/admin/community/route.ts
app/api/admin/teams/route.ts
app/api/admin/bug-reports/route.ts
app/api/admin/analytics/route.ts
app/api/admin/demo-seed/route.ts   optional
```

Every route must:

1. call `requireAdmin()`
2. validate input with a schema (`zod` recommended)
3. perform the write server-side
4. add audit log entry
5. return minimal response

---

### 3.1 Add audit logging first

Create table:

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_table text,
  target_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit logs: admin read"
ON audit_logs
FOR SELECT
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
```

Writes should be service-role/server-only.

---

### 3.2 Fix role changes

Implement `POST /api/admin/roles`.

Payload:

```json
{ "userId": "...", "role": "admin" }
```

Rules:

- caller must be admin,
- target user must exist,
- allowed roles: `admin`, `member`,
- prevent demoting the last admin,
- optionally prevent self-demotion unless another admin confirms,
- write audit log.

Then update `app/admin/page.tsx` so `handleRoleToggle` calls this API instead of direct Supabase update.

---

### 3.3 Fix cohort management

Implement `POST/PATCH /api/admin/cohorts`.

Move these direct writes out of `app/admin/page.tsx`:

- cohort insert
- cohort update

Validate:

- `name` non-empty
- `start_date <= end_date`
- only one active/latest cohort if that is the product rule

---

### 3.4 Fix report and community publishing

Implement:

- `POST /api/admin/reports`
- `POST /api/admin/community`

Move direct writes out of:

- `app/admin/page.tsx` report creation
- `app/admin/page.tsx` community creation

Server should set `author_id` from the verified session, not the client.

---

### 3.5 Fix team creation and team member assignment

Implement:

- `POST /api/admin/teams`
- `POST /api/admin/teams/:id/members` or a route handler with action type

Rules:

- only admins assign/remove members,
- no duplicate team members,
- optional max team size 3–4 if required,
- audit all membership changes.

---

### 3.6 Fix bug report triage

Implement `PATCH /api/admin/bug-reports`.

Move status updates out of `app/admin/page.tsx`.

Rules:

- status enum only,
- `resolved_at` set server-side when status becomes `resolved`,
- audit triage changes.

---

### 3.7 Move analytics server-side

Implement `GET /api/admin/analytics`.

Replace `components/admin/AnalyticsTab.tsx` direct table scans with one fetch to the admin analytics endpoint.

Endpoint should return aggregate metrics only, not raw table rows.

---

### 3.8 Move demo seed server-side or remove it

Best option: remove from production UI.

If retained:

- implement `POST /api/admin/demo-seed`,
- require `confirmText === 'RESET DEMO DATA'` for resets,
- only allow in non-production unless explicitly enabled by env var,
- use service-role server-side,
- write audit log.

---

## Phase 4 — Check-in Integrity

---

### 4.1 Add a server route for check-ins

Create:

```text
app/api/check-ins/route.ts
```

Payload:

```json
{ "timeBlockId": "...", "completed": true }
```

Rules:

- caller must be authenticated,
- time block must belong to caller,
- server sets `completed_at`,
- enforce allowed check-in window,
- reject check-ins outside grace period,
- reject block IDs not owned by user,
- do not allow arbitrary `missed` from client.

Then update `app/dashboard/page.tsx` to call this API instead of direct `check_ins.upsert/delete`.

---

### 4.2 Harden `check_ins` RLS

After the API is working, remove direct client writes:

```sql
DROP POLICY IF EXISTS "Check-ins: user only" ON check_ins;

CREATE POLICY "Check-ins: read own"
ON check_ins
FOR SELECT
USING (auth.uid() = user_id);
```

Writes should happen from server/service role or a controlled RPC.

---

### 4.3 Fix streak update function

Make streak updates server-owned and deterministic.

Recommended:

- check-ins are append-only or controlled updates,
- streaks are recomputed from check-ins or maintained by a hardened trigger,
- trigger function has `SECURITY DEFINER` and fixed `search_path`,
- no client can directly edit `streaks`.

---

## Phase 5 — Account Deletion

---

### 5.1 Create deletion API

Create:

```text
app/api/account/delete/route.ts
```

Rules:

- caller must be authenticated,
- confirmation text must match current email,
- server deletes related data,
- server deletes Supabase Auth user using Admin API,
- audit the request before deleting the profile/auth user.

Include all user-owned tables:

- `check_ins`
- `time_blocks`
- `streaks`
- `achievements`
- `streak_freezes`
- `profile_views` as viewer and viewed user
- `team_members`
- `team_startup_log`
- `reminders`
- `device_sessions`
- `bug_reports` handling decision: anonymize or delete
- `profiles`
- `auth.users`

---

### 5.2 Update delete page

Update `app/settings/delete/page.tsx`:

- remove client-side table deletes,
- call `/api/account/delete`,
- show explicit error if server deletion fails,
- do not claim auth account is deleted unless API confirms it.

---

## Phase 6 — Public/Private Data Separation

---

### 6.1 Create `public_profiles` view

Expose only safe public fields:

```sql
CREATE OR REPLACE VIEW public_profiles AS
SELECT id, username, created_at
FROM profiles
WHERE role = 'member';

GRANT SELECT ON public_profiles TO authenticated;
```

Do not include:

- email
- role, unless intentionally public
- reminder prefs
- timezone

---

### 6.2 Refactor UI reads

Update pages/components to read safe views where possible:

- `app/people/page.tsx`
- `app/leaderboard/page.tsx`
- `app/u/[username]/page.tsx`
- `app/team/page.tsx`
- `components/NotificationBell.tsx`
- `components/CommandPalette.tsx`

Avoid `.select('*')` in client components.

---

### 6.3 Decide public profile policy

Choose one:

#### Option A — profiles are authenticated-only

- `/u/[username]` requires login
- profile stats visible to authenticated users only
- use authenticated safe views

#### Option B — profiles are public

- create a deliberately public view with only safe fields
- grant only that view to `anon`
- do not expose direct `profiles`, `streaks`, or `team_members`

---

## Phase 7 — Middleware and UI Gates

Middleware is not the primary security boundary, but it should match the product’s route model.

### 7.1 Update protected path list

In `middleware.ts`, include all authenticated-only routes:

- `/dashboard`
- `/team`
- `/reports`
- `/community`
- `/people`
- `/leaderboard`
- `/history`
- `/settings`
- `/settings/delete`
- `/welcome`

### 7.2 Add admin UX redirect

For `/admin`, check admin role server-side in middleware and redirect non-admins.

Still keep server API and RLS enforcement. Middleware is only a UX layer.

### 7.3 Keep client UI role checks only as presentation

Navbar and admin page can still hide admin links, but never trust them as authorization.

---

## Phase 8 — Rate Limits and Abuse Controls

### 8.1 Add API rate limits

Apply rate limits to:

- bug report submission
- check-ins
- team posts
- report search
- account deletion
- admin mutations

Simple first pass:

- per-user in DB table or KV
- short fixed windows
- return `429` on abuse

### 8.2 Move bug report submission server-side

Create:

```text
app/api/bug-reports/route.ts
```

Rules:

- authenticated user required,
- server sets `user_id` and email,
- max body length,
- per-user rate limit,
- store user agent/url server-side if needed.

Update `app/settings/page.tsx` to call this API.

---

## Phase 9 — Testing and Verification

---

### 9.1 Add manual authorization test matrix

Create a test checklist with three users:

- anonymous
- normal member
- admin

For each role, verify:

| Action | Anonymous | Member | Admin |
|---|---:|---:|---:|
| Read reports | no/yes depending product | yes | yes |
| Self-promote to admin | no | no | no direct client |
| Change another user role | no | no | yes through API |
| Write own streak | no | no | no direct client |
| Insert achievement | no | no | server only |
| Join arbitrary team | no | no | via API only |
| Post as another user | no | no | no |
| Triage bug report | no | no | yes through API |
| Delete auth account | no | own only | admin policy decision |

---

### 9.2 Add automated RLS smoke tests

If Supabase local CLI is available, add tests that run with:

- anon key
- member JWT
- admin JWT
- service role key

Test the exact exploit attempts from the audit:

1. member updates `profiles.role` to admin — fail
2. member inserts `streaks` 999 — fail
3. member inserts fake achievement — fail
4. member inserts `team_members` into arbitrary team — fail
5. member inserts team log as another user — fail
6. anon selects leaderboard — fail unless intentionally public

---

### 9.3 Add API integration tests

Test each server route:

- unauthenticated returns `401`
- member returns `403` for admin routes
- admin succeeds
- invalid payload returns `400`
- audit log row is created for admin mutation

---

## Recommended Implementation Order

Use this exact order to reduce risk:

1. **Create `sql/authorization-hardening.sql`.**
2. **Patch `profiles.role` self-promotion first.**
3. **Patch `streaks`, `achievements`, `team_members`, `team_startup_log`.**
4. **Revoke anonymous leaderboard access.**
5. **Deploy SQL and verify exploit attempts fail.**
6. **Add `lib/supabase-admin.ts` and `lib/authz.ts`.**
7. **Add `audit_logs`.**
8. **Implement admin role API.**
9. **Refactor admin page role toggle to API.**
10. **Implement remaining admin APIs.**
11. **Refactor admin page to remove all direct mutation Supabase calls.**
12. **Implement check-in API.**
13. **Remove direct client write policies for `check_ins`.**
14. **Implement account deletion API.**
15. **Split public/private profile reads.**
16. **Update middleware route coverage.**
17. **Add rate limits.**
18. **Add RLS/API tests.**
19. **Re-run policy inventory and compare against expected matrix.**

---

## Definition of Done

Authorization remediation is complete only when all of these are true:

- A normal member cannot become admin through Supabase JS.
- A normal member cannot write `streaks` directly.
- A normal member cannot insert fake achievements.
- A normal member cannot join arbitrary teams.
- A normal member cannot post as another user.
- Admin writes happen through server routes or trusted RPC only.
- Server routes validate session and role server-side.
- Sensitive admin actions create audit logs.
- Account deletion removes or anonymizes all user data and deletes the Supabase Auth user.
- Anonymous access is limited to explicitly public views/routes.
- No client component relies on `.select('*')` for sensitive tables.
- `pg_policies` contains no stale permissive policies that undermine the intended model.
