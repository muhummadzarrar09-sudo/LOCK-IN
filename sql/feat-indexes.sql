-- ============================================================
-- LOCK-IN — Scale indexes for thousands of users
-- Run in Supabase SQL Editor (idempotent — safe to re-run)
-- ============================================================

-- Hot path: dashboard loads time_blocks + check_ins per user
-- Already indexed via FK (user_id), but adding covering indexes for the
-- common (user_id, day) query.
CREATE INDEX IF NOT EXISTS idx_time_blocks_user_day
  ON time_blocks (user_id, day);

-- Hot path: team page loads team_members for the user's team
-- Already indexed via PK + (team_id, user_id) unique, but we query by user_id
-- to find "what teams am I in".
CREATE INDEX IF NOT EXISTS idx_team_members_user
  ON team_members (user_id);

-- Hot path: leaderboard view joins streaks. Add index on current_streak DESC
-- for top-N queries.
CREATE INDEX IF NOT EXISTS idx_streaks_current_streak_desc
  ON streaks (current_streak DESC, best_streak DESC);

-- Hot path: admin metrics: "active today" = check_ins today
-- Composite on (completed_at) already covered, but let's be explicit.
CREATE INDEX IF NOT EXISTS idx_check_ins_completed_at
  ON check_ins (completed_at DESC);

-- Hot path: team feed sorted by created_at DESC, filtered by team_id
-- Already covered by team_id FK, but a covering index is faster.
CREATE INDEX IF NOT EXISTS idx_team_startup_log_team_created
  ON team_startup_log (team_id, created_at DESC);

-- Hot path: reports + community_posts sorted by created_at DESC
CREATE INDEX IF NOT EXISTS idx_reports_created_desc
  ON reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_desc
  ON community_posts (created_at DESC);

-- Hot path: bug reports filtered by status, sorted by created_at
-- Already exists, but re-affirm.
CREATE INDEX IF NOT EXISTS idx_bug_reports_open
  ON bug_reports (created_at DESC) WHERE status = 'open';

-- Hot path: leaderboard view (if it falls back to profiles + streaks join)
-- profiles.username lookup is by username; ensure unique index.
-- username already UNIQUE in schema; no need.

-- Hot path: profiles.email lookup (for email verification, RLS checks)
-- email already UNIQUE in schema; no need.

-- Hot path: device_sessions lookup by user (for auth)
CREATE INDEX IF NOT EXISTS idx_device_sessions_user_active
  ON device_sessions (user_id, last_active DESC);

-- Composite covering index for the most common dashboard query:
-- "get my time_blocks for today, ordered by start_time"
CREATE INDEX IF NOT EXISTS idx_time_blocks_user_day_start
  ON time_blocks (user_id, day, start_time);
