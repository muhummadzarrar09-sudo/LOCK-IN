-- ============================================================
-- LOCK-IN — Authorization hardening
-- Generated: 2026-07-24
--
-- Purpose:
--   Close critical client-side/RLS authorization gaps:
--   - profile role self-promotion
--   - client-forged streaks/achievements/check-ins
--   - arbitrary team self-join
--   - team-feed impersonation
--   - anonymous leaderboard exposure
--   - spoofed bug-report email
--
-- Run after existing schema/update/fix migrations.
-- ============================================================

-- ------------------------------------------------------------
-- Durable API rate limiting buckets
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- No client policies: server/service-role RPC only.

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_bucket_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE(allowed BOOLEAN, retry_after INTEGER, current_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_count INTEGER;
  v_reset_at TIMESTAMP WITH TIME ZONE;
BEGIN
  INSERT INTO rate_limit_buckets(bucket_key, count, reset_at, updated_at)
  VALUES (p_bucket_key, 1, v_now + make_interval(secs => p_window_seconds), v_now)
  ON CONFLICT (bucket_key) DO UPDATE SET
    count = CASE
      WHEN rate_limit_buckets.reset_at <= v_now THEN 1
      ELSE rate_limit_buckets.count + 1
    END,
    reset_at = CASE
      WHEN rate_limit_buckets.reset_at <= v_now THEN v_now + make_interval(secs => p_window_seconds)
      ELSE rate_limit_buckets.reset_at
    END,
    updated_at = v_now
  RETURNING count, reset_at INTO v_count, v_reset_at;

  allowed := v_count <= p_limit;
  retry_after := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_reset_at - v_now)))::INTEGER);
  current_count := v_count;
  RETURN NEXT;
END;
$$;

-- ------------------------------------------------------------
-- Audit logs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_table TEXT,
  target_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Audit logs: admin read" ON audit_logs;
CREATE POLICY "Audit logs: admin read" ON audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ------------------------------------------------------------
-- Profiles: prevent client role/email mutation
-- ------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone TEXT;

CREATE OR REPLACE FUNCTION prevent_profile_privilege_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Supabase service role is reserved for trusted server-side code.
  -- Direct database owners are allowed so emergency SQL-editor recovery
  -- scripts can still repair admin access if needed.
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.role IS DISTINCT FROM 'member' THEN
        RAISE EXCEPTION 'role is not client-writable';
      END IF;
      NEW.email := COALESCE(auth.jwt() ->> 'email', NEW.email);
      NEW.created_at := NOW();
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'role is not client-writable';
      END IF;
      IF NEW.email IS DISTINCT FROM OLD.email THEN
        RAISE EXCEPTION 'email is not client-writable';
      END IF;
      IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'created_at is not client-writable';
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

DROP POLICY IF EXISTS "Profiles: insert own" ON profiles;
DROP POLICY IF EXISTS "Profiles: update own" ON profiles;
DROP POLICY IF EXISTS "Profiles: admin update any" ON profiles;

CREATE POLICY "Profiles: insert own member"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id AND role = 'member');

CREATE POLICY "Profiles: update own safe fields"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Public-safe profile directory. This is the only cross-user profile
-- surface clients should use.
CREATE OR REPLACE VIEW public_profiles
WITH (security_invoker = false)
AS
SELECT id, username, created_at
FROM profiles
WHERE role = 'member';

GRANT SELECT ON public_profiles TO authenticated;
REVOKE ALL ON public_profiles FROM anon;

-- Remove broad profile read. Full profile rows contain email/timezone/role and
-- are limited to the owner plus trusted admin/server flows.
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles p WHERE p.id = p_user_id AND p.role = 'admin');
$$;

DROP POLICY IF EXISTS "Profiles: select all" ON profiles;
DROP POLICY IF EXISTS "Profiles: select all members" ON profiles;
DROP POLICY IF EXISTS "Profiles: select all members for leaderboard" ON profiles;
DROP POLICY IF EXISTS "Profiles: read own" ON profiles;
DROP POLICY IF EXISTS "Profiles: admin read all" ON profiles;

CREATE POLICY "Profiles: read own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Profiles: admin read all"
  ON profiles FOR SELECT
  USING (is_admin());


-- ------------------------------------------------------------
-- Streaks: users may read own streak, but cannot forge streak values.
-- Server/service-role or trusted trigger code writes these rows.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Streaks: user only" ON streaks;
DROP POLICY IF EXISTS "Streaks: read own" ON streaks;
CREATE POLICY "Streaks: read own"
  ON streaks FOR SELECT
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Time blocks: users may read their schedule, but cannot edit windows
-- client-side to bypass check-in timing. Creation/changes go through
-- trusted server code.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Time blocks: user only" ON time_blocks;
DROP POLICY IF EXISTS "Time blocks: read own" ON time_blocks;
CREATE POLICY "Time blocks: read own"
  ON time_blocks FOR SELECT
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Check-ins: users may read own check-ins only. Writes now go through
-- /api/check-ins or trusted RPC/server code.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Check-ins: user only" ON check_ins;
DROP POLICY IF EXISTS "Check-ins: read own" ON check_ins;
CREATE POLICY "Check-ins: read own"
  ON check_ins FOR SELECT
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Achievements: clients cannot grant badges.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Achievements: insert via trigger or service" ON achievements;
DROP POLICY IF EXISTS "Achievements: user can read own" ON achievements;
DROP POLICY IF EXISTS "Achievements: read all authenticated" ON achievements;
DROP POLICY IF EXISTS "Achievements: read authenticated" ON achievements;

CREATE POLICY "Achievements: read authenticated"
  ON achievements FOR SELECT
  USING (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- Team membership: no arbitrary self-join. Members can read rosters for
-- teams they already belong to. Admin/server writes use service-role.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_current_user_team_member(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM team_members tm
    WHERE tm.team_id = p_team_id
      AND tm.user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Team members: user sees own" ON team_members;
DROP POLICY IF EXISTS "Team members: user manages own" ON team_members;
DROP POLICY IF EXISTS "Team members: user deletes own" ON team_members;
DROP POLICY IF EXISTS "Team members: authenticated read" ON team_members;
DROP POLICY IF EXISTS "Team members: insert own" ON team_members;
DROP POLICY IF EXISTS "Team members: delete own or admin" ON team_members;
DROP POLICY IF EXISTS "Team members: read same team" ON team_members;

CREATE POLICY "Team members: read same team"
  ON team_members FOR SELECT
  USING (is_current_user_team_member(team_id));

-- ------------------------------------------------------------
-- Team feed: same-team read, and callers can only post as themselves.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Team log: team members read" ON team_startup_log;
DROP POLICY IF EXISTS "Team log: team members insert" ON team_startup_log;
DROP POLICY IF EXISTS "Team log: members read" ON team_startup_log;
DROP POLICY IF EXISTS "Team log: members insert" ON team_startup_log;
DROP POLICY IF EXISTS "Team log: read same team" ON team_startup_log;
DROP POLICY IF EXISTS "Team log: insert own as team member" ON team_startup_log;

CREATE POLICY "Team log: read same team"
  ON team_startup_log FOR SELECT
  USING (is_current_user_team_member(team_id));

-- No client INSERT policy. Team posts are created through /api/team/posts,
-- which verifies membership, rate limits, and writes via service role.

-- ------------------------------------------------------------
-- Profile views: authenticated users can log their own view events; only
-- profile owners can read their counts via existing policy.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Profile views: user can read own" ON profile_views;
DROP POLICY IF EXISTS "Profile views: insert own viewer" ON profile_views;

CREATE POLICY "Profile views: user can read own"
  ON profile_views FOR SELECT
  USING (auth.uid() = viewed_user_id);

-- No client INSERT policy. Profile view events are recorded through
-- /api/profile-views with per-user throttling and duplicate coalescing.

-- ------------------------------------------------------------
-- Bug reports: prevent user_email spoofing on direct inserts. The new
-- /api/bug-reports route also sets this server-side.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION normalize_bug_report_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    NEW.user_id := auth.uid();
    NEW.user_email := auth.jwt() ->> 'email';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_bug_report_identity ON bug_reports;
CREATE TRIGGER trg_normalize_bug_report_identity
BEFORE INSERT ON bug_reports
FOR EACH ROW EXECUTE FUNCTION normalize_bug_report_identity();

-- ------------------------------------------------------------
-- Member-only content should require an authenticated session when read
-- directly through Supabase.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Reports: members read" ON reports;
DROP POLICY IF EXISTS "Reports: authenticated read" ON reports;
CREATE POLICY "Reports: authenticated read"
  ON reports FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Community: members read" ON community_posts;
DROP POLICY IF EXISTS "Community: authenticated read" ON community_posts;
CREATE POLICY "Community: authenticated read"
  ON community_posts FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Teams: members read" ON teams;
DROP POLICY IF EXISTS "Teams: authenticated read" ON teams;
DROP POLICY IF EXISTS "Teams: read own team or admin" ON teams;
CREATE POLICY "Teams: read own team or admin"
  ON teams FOR SELECT
  USING (is_admin() OR is_current_user_team_member(id));

DROP POLICY IF EXISTS "Cohorts: members read" ON cohorts;
DROP POLICY IF EXISTS "Cohorts: authenticated read" ON cohorts;
CREATE POLICY "Cohorts: authenticated read"
  ON cohorts FOR SELECT
  USING (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- Leaderboard: authenticated only. The view may still intentionally expose
-- narrow public ranking data to authenticated members while bypassing table
-- RLS for streak aggregation.
-- ------------------------------------------------------------
REVOKE SELECT ON leaderboard FROM anon;
GRANT SELECT ON leaderboard TO authenticated;

-- ------------------------------------------------------------
-- Verification helper
-- ------------------------------------------------------------
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
