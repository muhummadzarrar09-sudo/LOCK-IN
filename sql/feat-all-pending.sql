-- ============================================================
-- LOCK-IN — Master migration: everything not yet run
-- Generated: 2026-07-24 (pre-demo)
-- v2: wraps pg_trgm in DO block so a missing extension doesn't crash
--     the whole migration. Username search falls back to plain ilike.
--
-- This file is safe to drop into Supabase SQL Editor and run as one.
-- It is idempotent (CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE,
-- DROP POLICY/TRIGGER IF EXISTS) so re-running won't break anything.
--
-- What's inside (in order):
--   1. feat-bug-reports.sql       (bug_reports table + RLS)
--   2. feat-leaderboard-cohort.sql (leaderboard view + grants)
--   3. feat-indexes.sql            (9 hot-path indexes for scale)
--   4. feat-social-analytics.sql   (achievements, profile_views,
--                                    streak_freezes, cohort_daily_active,
--                                    achievement/freeze triggers, GIN)
--
-- ALSO INCLUDED (run alongside this if not done):
--   • Realtime publication adds for reports, community_posts,
--     team_startup_log, streaks, check_ins
--
-- Already assumed done (came in via merge 1ee7e36):
--   schema.sql, update-v2.sql, fix-auth-and-admin.sql,
--   fix-rls-final.sql, allow-myself.sql, cleanup-duplicate-cohorts.sql,
--   feat-tiers-1-2.sql
-- ============================================================


-- ============================================================
-- PART 1: feat-bug-reports.sql
-- Members report problems; admin reads & triages via the Admin Support tab.
-- ============================================================

CREATE TABLE IF NOT EXISTS bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  body TEXT NOT NULL,
  url TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'triaged', 'resolved', 'closed')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports (status, created_at DESC);

ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Bug reports: user can insert own" ON bug_reports;
CREATE POLICY "Bug reports: user can insert own" ON bug_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Bug reports: read own or admin" ON bug_reports;
CREATE POLICY "Bug reports: read own or admin" ON bug_reports
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Bug reports: admin can update" ON bug_reports;
CREATE POLICY "Bug reports: admin can update" ON bug_reports
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));


-- ============================================================
-- PART 2: feat-leaderboard-cohort.sql
-- Recreate the leaderboard view with explicit ordering + cohort awareness.
-- ============================================================

DROP VIEW IF EXISTS leaderboard;
CREATE OR REPLACE VIEW leaderboard
WITH (security_invoker = false)
AS
SELECT
  p.id,
  p.username,
  COALESCE(s.current_streak, 0) AS streak,
  COALESCE(s.best_streak, 0) AS best_streak,
  RANK() OVER (ORDER BY COALESCE(s.current_streak, 0) DESC, p.username ASC) AS rank,
  p.role
FROM profiles p
LEFT JOIN streaks s ON p.id = s.user_id
WHERE p.role = 'member'
ORDER BY streak DESC, p.username ASC;

GRANT SELECT ON leaderboard TO authenticated;
GRANT SELECT ON leaderboard TO anon;


-- ============================================================
-- PART 3: feat-indexes.sql
-- 9 hot-path indexes for thousands of users
-- ============================================================

-- Hot path: dashboard loads time_blocks + check_ins per user
CREATE INDEX IF NOT EXISTS idx_time_blocks_user_day
  ON time_blocks (user_id, day);

-- Hot path: team page loads team_members for the user's team
CREATE INDEX IF NOT EXISTS idx_team_members_user
  ON team_members (user_id);

-- Hot path: leaderboard view joins streaks
CREATE INDEX IF NOT EXISTS idx_streaks_current_streak_desc
  ON streaks (current_streak DESC, best_streak DESC);

-- Hot path: admin metrics — "active today" = check_ins today
CREATE INDEX IF NOT EXISTS idx_check_ins_completed_at
  ON check_ins (completed_at DESC);

-- Hot path: team feed sorted by created_at DESC, filtered by team_id
CREATE INDEX IF NOT EXISTS idx_team_startup_log_team_created
  ON team_startup_log (team_id, created_at DESC);

-- Hot path: reports + community_posts sorted by created_at DESC
CREATE INDEX IF NOT EXISTS idx_reports_created_desc
  ON reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_desc
  ON community_posts (created_at DESC);

-- Hot path: bug reports filtered by status, sorted by created_at
CREATE INDEX IF NOT EXISTS idx_bug_reports_open
  ON bug_reports (created_at DESC) WHERE status = 'open';

-- Hot path: device_sessions lookup by user (for auth)
CREATE INDEX IF NOT EXISTS idx_device_sessions_user_active
  ON device_sessions (user_id, last_active DESC);

-- Composite covering index for the most common dashboard query:
-- "get my time_blocks for today, ordered by start_time"
CREATE INDEX IF NOT EXISTS idx_time_blocks_user_day_start
  ON time_blocks (user_id, day, start_time);


-- ============================================================
-- PART 4: feat-social-analytics.sql
-- Achievements, profile_views, streak_freezes, cohort_daily_active,
-- achievement/freeze triggers, GIN index for username search
-- ============================================================

-- Required extension for trigram search (may already be enabled).
-- Wrapped in DO block so if pg_trgm is unavailable, we skip gracefully
-- instead of crashing the whole migration.
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_trgm extension unavailable, skipping trigram index';
  END;
END$$;

-- ── Achievements / badges ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB,
  UNIQUE(user_id, code)
);

CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements (user_id, earned_at DESC);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Achievements: user can read own" ON achievements;
CREATE POLICY "Achievements: user can read own" ON achievements
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Achievements: read all authenticated" ON achievements;
CREATE POLICY "Achievements: read all authenticated" ON achievements
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Achievements: insert via trigger or service" ON achievements;
CREATE POLICY "Achievements: insert via trigger or service" ON achievements
  FOR INSERT WITH CHECK (true);

-- ── Profile views (for "X people viewed your profile") ────────────────
CREATE TABLE IF NOT EXISTS profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewed_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_views_viewed ON profile_views (viewed_user_id, viewed_at DESC);

ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profile views: user can read own" ON profile_views;
CREATE POLICY "Profile views: user can read own" ON profile_views
  FOR SELECT USING (auth.uid() = viewed_user_id);

-- ── Streak freezes (earned via achievements, used automatically) ────
CREATE TABLE IF NOT EXISTS streak_freezes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE,
  used_for_date DATE,
  UNIQUE(used_for_date) -- one freeze per day max
);

CREATE INDEX IF NOT EXISTS idx_streak_freezes_user_unused
  ON streak_freezes (user_id) WHERE used_at IS NULL;

ALTER TABLE streak_freezes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Streak freezes: user can read own" ON streak_freezes;
CREATE POLICY "Streak freezes: user can read own" ON streak_freezes
  FOR SELECT USING (auth.uid() = user_id);

-- ── Full-text search on profiles ─────────────────────────────────────
-- GIN index for fast username search.
-- Wrapped in DO block so if pg_trgm isn't installed, the rest of the
-- migration still runs. Username search falls back to plain ilike
-- (slower at scale, fine for thousands and fine for demo).
DO $$
BEGIN
  BEGIN
    CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm
      ON profiles USING gin (username gin_trgm);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping idx_profiles_username_trgm (pg_trgm not available)';
  END;
END$$;

-- ── Active daily helper (for cohort analytics) ──────────────────────
-- View: for each day, count distinct users who checked in.
-- Used by admin analytics. Replaces a query that would scan check_ins.
CREATE OR REPLACE VIEW cohort_daily_active AS
SELECT
  DATE(c.completed_at AT TIME ZONE 'UTC') AS day,
  COUNT(DISTINCT c.user_id) AS active_members,
  COUNT(*) AS total_checkins
FROM check_ins c
WHERE c.missed = false
GROUP BY DATE(c.completed_at AT TIME ZONE 'UTC')
ORDER BY day DESC;

GRANT SELECT ON cohort_daily_active TO authenticated;

-- ── Triggers: auto-grant achievements ─────────────────────────────────
-- These run when a streak hits certain milestones.

CREATE OR REPLACE FUNCTION check_streak_achievements()
RETURNS TRIGGER AS $$
DECLARE
  ach_code TEXT;
BEGIN
  IF NEW.current_streak = 3 THEN
    ach_code := 'streak_3';
  ELSIF NEW.current_streak = 7 THEN
    ach_code := 'streak_7';
  ELSIF NEW.current_streak = 14 THEN
    ach_code := 'streak_14';
  ELSIF NEW.current_streak = 30 THEN
    ach_code := 'streak_30';
  ELSIF NEW.current_streak >= 100 THEN
    ach_code := 'streak_100';
  END IF;

  IF ach_code IS NOT NULL THEN
    INSERT INTO achievements (user_id, code)
    VALUES (NEW.user_id, ach_code)
    ON CONFLICT (user_id, code) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_streak_achievements ON streaks;
CREATE TRIGGER trigger_streak_achievements
AFTER INSERT OR UPDATE OF current_streak ON streaks
FOR EACH ROW
EXECUTE FUNCTION check_streak_achievements();

-- ── Freezes: auto-grant at certain streak milestones ────────────────
CREATE OR REPLACE FUNCTION grant_streak_freezes()
RETURNS TRIGGER AS $$
BEGIN
  -- 7-day streak = 1 freeze; 14-day = 1 more; etc.
  IF NEW.current_streak IN (7, 14, 21, 30) THEN
    INSERT INTO streak_freezes (user_id)
    VALUES (NEW.user_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_grant_freezes ON streaks;
CREATE TRIGGER trigger_grant_freezes
AFTER INSERT OR UPDATE OF current_streak ON streaks
FOR EACH ROW
EXECUTE FUNCTION grant_streak_freezes();

-- ── Index for community_posts search (case-insensitive) ──────────────
CREATE INDEX IF NOT EXISTS idx_community_posts_title_lower
  ON community_posts (LOWER(title));

CREATE INDEX IF NOT EXISTS idx_reports_title_lower
  ON reports (LOWER(title));


-- ============================================================
-- PART 5: Realtime publication adds
-- Required so leaderboard/feed updates propagate live
-- (idempotent — ALTER PUBLICATION errors silently if table already in pub)
-- ============================================================

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE reports; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE community_posts; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE team_startup_log; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE streaks; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE check_ins; EXCEPTION WHEN duplicate_object THEN NULL; END;
END$$;


-- ============================================================
-- DONE.
-- After this runs successfully, you should have:
--   ✓ bug_reports table + RLS
--   ✓ leaderboard view (with grants)
--   ✓ 9 scale indexes
--   ✓ achievements + profile_views + streak_freezes + cohort_daily_active
--   ✓ streak_achievement + streak_freeze triggers
--   ✓ Realtime publication for reports, community_posts,
--     team_startup_log, streaks, check_ins
--
-- Verifier (run separately to confirm):
--   SELECT tablename FROM pg_tables WHERE schemaname = 'public'
--   ORDER BY tablename;
--   SELECT viewname FROM pg_views WHERE schemaname = 'public'
--   ORDER BY viewname;
-- ============================================================
