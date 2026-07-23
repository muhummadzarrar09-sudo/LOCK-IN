-- ============================================================
-- ACCOUNTABILITY PWA — SUPABASE SCHEMA (Run in SQL Editor)
-- Phase 1 SQL — Ready for copy-paste into Supabase SQL Editor
-- ============================================================

-- 1. Profiles (members + admin)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Cohorts (repeating every 3 months — managed via admin)
CREATE TABLE IF NOT EXISTS cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  enrollment_open BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Device Sessions (limit 2 active per user — 1 laptop + 1 mobile)
CREATE TABLE IF NOT EXISTS device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  device_type TEXT CHECK (device_type IN ('laptop', 'mobile', 'other')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_device_sessions_user ON device_sessions(user_id);

-- 4. Time Blocks (evidence-based: deep work, protected breaks, movement, reflection)
CREATE TABLE IF NOT EXISTS time_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 7), -- 1=Mon
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  label TEXT NOT NULL,
  block_type TEXT NOT NULL DEFAULT 'work' CHECK (block_type IN ('work', 'break', 'movement', 'reflection')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Check-ins (discipline tracking — streak breaks visibly on miss)
CREATE TABLE IF NOT EXISTS check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  time_block_id UUID NOT NULL REFERENCES time_blocks(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  missed BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, time_block_id)
);

CREATE INDEX IF NOT EXISTS idx_check_ins_user ON check_ins(user_id);

-- 6. Streaks (computed from check-ins, visible for leaderboard)
CREATE TABLE IF NOT EXISTS streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  last_check_in_date DATE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Leaderboard (derived from streaks — members see rank + shared team data)
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.id,
  p.username,
  COALESCE(s.current_streak, 0) AS streak,
  RANK() OVER (ORDER BY COALESCE(s.current_streak, 0) DESC, p.username ASC) AS rank,
  p.role
FROM profiles p
LEFT JOIN streaks s ON p.id = s.user_id
WHERE p.role = 'member';

-- 8. Teams (groups of 3-4, built from community, shared startup idea)
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL,
  startup_title TEXT,
  startup_pitch TEXT,
  startup_stage TEXT DEFAULT 'idea' CHECK (startup_stage IN ('idea', 'prototype', 'revenue')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Team Members (join by email/username — members invite)
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);

-- 10. Team Startup Log (shared progress — concentrated discipline)
CREATE TABLE IF NOT EXISTS team_startup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Reports (browsable list — admin uploads, cached for offline viewing)
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Community Posts (lightweight read-only feed mirroring community)
CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Reminders (push/nudge scheduling)
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('check_in', 'new_report', 'team_update', 'daily_start')),
  scheduled_for TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- ROW-LEVEL SECURITY (RLS) — NON-NEGOTIABLE ACROSS EVERY FEATURE
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_startup_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Profiles: members see all (for leaderboard), edit own only
CREATE POLICY "Profiles: select all members for leaderboard" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Profiles: insert own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Profiles: update own" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Profiles: delete own" ON profiles
  FOR DELETE USING (auth.uid() = id);

-- Cohorts: members read, admin writes
CREATE POLICY "Cohorts: members read" ON cohorts FOR SELECT USING (true);
CREATE POLICY "Cohorts: admin manage" ON cohorts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Device Sessions: strict user isolation
CREATE POLICY "Device: user only" ON device_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Time Blocks: user isolation
CREATE POLICY "Time blocks: user only" ON time_blocks
  FOR ALL USING (auth.uid() = user_id);

-- Check-ins: user isolation
CREATE POLICY "Check-ins: user only" ON check_ins
  FOR ALL USING (auth.uid() = user_id);

-- Streaks: user isolation (leaderboard uses view which bypasses RLS for rank)
CREATE POLICY "Streaks: user only" ON streaks
  FOR ALL USING (auth.uid() = user_id);

-- Team Members: members see their own team memberships
CREATE POLICY "Team members: user sees own" ON team_members
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Team members: user manages own" ON team_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Team members: user deletes own" ON team_members
  FOR DELETE USING (auth.uid() = user_id);

-- Team Startup Log: members of team see log
CREATE POLICY "Team log: team members read" ON team_startup_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_members WHERE team_id = team_startup_log.team_id AND user_id = auth.uid())
  );

CREATE POLICY "Team log: team members insert" ON team_startup_log
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM team_members WHERE team_id = team_startup_log.team_id AND user_id = auth.uid())
  );

-- Reports: members read, admin writes
CREATE POLICY "Reports: members read" ON reports FOR SELECT USING (true);
CREATE POLICY "Reports: admin manage" ON reports FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Community Posts: members read, admin writes
CREATE POLICY "Community: members read" ON community_posts FOR SELECT USING (true);
CREATE POLICY "Community: admin manage" ON community_posts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Reminders: user isolation
CREATE POLICY "Reminders: user only" ON reminders
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Update streak when check_in completed
CREATE OR REPLACE FUNCTION update_streak()
RETURNS TRIGGER AS $$
DECLARE
  today_date DATE := CURRENT_DATE;
  prev_streak INTEGER;
BEGIN
  -- Only process when a check-in is completed (not missed)
  IF NEW.missed = FALSE AND NEW.completed_at IS NOT NULL THEN
    INSERT INTO streaks (user_id, current_streak, best_streak, last_check_in_date)
    VALUES (NEW.user_id, 1, 1, today_date)
    ON CONFLICT (user_id) DO UPDATE SET
      current_streak = CASE
        WHEN streaks.last_check_in_date = today_date - INTERVAL '1 day' THEN streaks.current_streak + 1
        WHEN streaks.last_check_in_date < today_date - INTERVAL '1 day' THEN 1
        ELSE streaks.current_streak + 1
      END,
      best_streak = GREATEST(COALESCE(streaks.best_streak, 0),
        CASE
          WHEN streaks.last_check_in_date = today_date - INTERVAL '1 day' THEN streaks.current_streak + 1
          WHEN streaks.last_check_in_date < today_date - INTERVAL '1 day' THEN 1
          ELSE streaks.current_streak + 1
        END),
      last_check_in_date = today_date,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_update_streak
AFTER INSERT OR UPDATE ON check_ins
FOR EACH ROW EXECUTE FUNCTION update_streak();

-- ============================================================
-- SEED DATA (Default evidence-based schedule template)
-- ============================================================
INSERT INTO time_blocks (user_id, day, start_time, end_time, label, block_type)
VALUES
  -- This is a template — members will build their own, but this is the evidence-based default
  -- Deep Work (Morning)
  ((SELECT id FROM profiles LIMIT 1), 1, '06:00', '09:00', 'Deep Work Block 1', 'work'),
  ((SELECT id FROM profiles LIMIT 1), 1, '09:00', '09:30', 'Protected Break', 'break'),
  ((SELECT id FROM profiles LIMIT 1), 1, '09:30', '12:00', 'Deep Work Block 2', 'work'),
  ((SELECT id FROM profiles LIMIT 1), 1, '12:00', '12:30', 'Movement', 'movement'),
  ((SELECT id FROM profiles LIMIT 1), 1, '12:30', '13:00', 'Reflection / Journal', 'reflection'),
  -- Repeat pattern for other days as needed by members
ON CONFLICT DO NOTHING;
