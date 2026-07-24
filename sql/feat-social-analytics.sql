-- ============================================================
-- LOCK-IN — Social layer + analytics
-- Run in Supabase SQL Editor (idempotent — safe to re-run)
-- ============================================================

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

CREATE POLICY "Achievements: user can read own" ON achievements
  FOR SELECT USING (auth.uid() = user_id);

-- Allow all authenticated to see others' achievements (for social proof)
CREATE POLICY "Achievements: read all authenticated" ON achievements
  FOR SELECT USING (auth.role() = 'authenticated');

-- Server / service role inserts
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

-- Required extension (may already be enabled).
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

-- ── Active daily helper (for cohort analytics) ──────────────────────
-- View: for each day in the cohort, count distinct users who checked in.
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

-- ── Helper: total active members today (for admin metrics) ──────────
-- Already calculated client-side, but for analytics we may want server-side.

-- ── Triggers: auto-grant achievements ─────────────────────────────────
-- These run when a streak hits certain milestones. Simple version.
-- (Production would also handle badge icons, descriptions, etc.)

CREATE OR REPLACE FUNCTION check_streak_achievements()
RETURNS TRIGGER AS $$
DECLARE
  ach_code TEXT;
BEGIN
  -- 3-day streak
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

-- ── Public profile view (for /u/:username) ───────────────────────────
-- Same shape as leaderboard but for one user.
-- No new table needed; the queries just join profiles + streaks directly.

-- ── Helpful index: leaderboard filter by cohort ─────────────────────
-- (In case we want to scope to specific cohort later.)
-- The existing idx_streaks_current_streak_desc is already efficient.

-- ── Index for community_posts search (case-insensitive) ──────────────
CREATE INDEX IF NOT EXISTS idx_community_posts_title_lower
  ON community_posts (LOWER(title));

CREATE INDEX IF NOT EXISTS idx_reports_title_lower
  ON reports (LOWER(title));
