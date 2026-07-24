-- ============================================================
-- LOCK-IN — Cohort-scoped leaderboard
-- Run in Supabase SQL Editor (idempotent — safe to re-run)
-- ============================================================

-- Recreate the leaderboard view with explicit ordering + cohort awareness.
-- For now we order by current_streak desc; if a cohort is in progress,
-- members of that cohort should rank. Alumni from past cohorts can show
-- in a separate "all-time" view.
--
-- The view is intentionally simple: filter profiles to role='member', join
-- streaks for current_streak/best_streak, rank by current_streak desc,
-- then username asc as tiebreaker.
--
-- Performance: at 1k members, this is sub-100ms. At 10k, add a partial
-- index on streaks.current_streak DESC.

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

-- Grant access
GRANT SELECT ON leaderboard TO authenticated;
GRANT SELECT ON leaderboard TO anon;
