# Data Leak Hardening Summary

**Date:** 2026-07-24

Quick privacy/data-exposure pass after the premium UX work.

## What was tightened

### 1. Public-safe profile surface

Added to `sql/authorization-hardening.sql`:

- `public_profiles` view with only:
  - `id`
  - `username`
  - `created_at`
- revoked anonymous access to the view
- removed broad `profiles` table read policies
- added:
  - `Profiles: read own`
  - `Profiles: admin read all`
- added `is_admin(...)` helper for safe admin policy checks

Result: client-side cross-user profile lookups no longer need access to emails, roles, timezones, or private profile fields.

### 2. Teammate/profile lookups moved to `public_profiles`

Updated:

- `app/team/page.tsx`
- `components/DashboardTeamPulse.tsx`
- `components/NotificationBell.tsx`
- `components/GlobalRealtimeToaster.tsx`
- `app/people/page.tsx`
- `app/u/[username]/page.tsx`

Result: normal member UI no longer queries full `profiles` rows for other users.

### 3. Team data exposure reduced

Updated:

- `app/team/page.tsx`
- `sql/authorization-hardening.sql`

Changes:

- Team page now fetches only the user’s own teams.
- SQL policy changed from broad authenticated team read to:
  - own-team member read
  - admin read

Result: users cannot enumerate all team startup ideas/pitches through the client policy.

### 4. Public profile view-count privacy fixed

Updated:

- `app/u/[username]/page.tsx`

Changes:

- profile view count is only fetched/shown for the profile owner.
- other viewers can log a view through `/api/profile-views`, but cannot read the count.

Result: profile analytics stay private.

### 5. Streak exposure on profile page moved to safe leaderboard view

Updated:

- `app/u/[username]/page.tsx`

The profile page no longer reads another user’s `streaks` row directly. It reads the narrow `leaderboard` view instead.

Result: no direct cross-user `streaks` table reads from the profile page.

## Build validation

Ran:

```bash
npm run build
```

Result: build succeeded.

## Still required

Apply `sql/authorization-hardening.sql` in Supabase. These leak-prevention rules only become active in production after the SQL migration is run.
