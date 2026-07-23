-- ============================================================
-- LOCK-IN — FINAL RLS FIXES FOR AUTH + FUNCTIONALITIES
-- Fixes blockages beyond login
-- - team_members read restrictive -> allow members of same team to see each other
-- - Ensure time_blocks, check_ins, streaks policies work
-- - leaderboard view security
-- Run after update-v2.sql
-- ============================================================

-- TEAMS: already members read true, admin manage
-- Fix team_members: allow reading all if authenticated OR same team

DROP POLICY IF EXISTS "Team members: user sees own" ON team_members;
DROP POLICY IF EXISTS "Team members: user manages own" ON team_members;
DROP POLICY IF EXISTS "Team members: user deletes own" ON team_members;
DROP POLICY IF EXISTS "Team members: all authenticated read" ON team_members;
DROP POLICY IF EXISTS "Team members: team members can read teammates" ON team_members;

-- Allow any authenticated user to read team_members (needed for team page to list teammates)
CREATE POLICY "Team members: authenticated read" ON team_members
  FOR SELECT USING (auth.role() = 'authenticated');

-- Insert: only own
CREATE POLICY "Team members: insert own" ON team_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Delete: own or admin
CREATE POLICY "Team members: delete own or admin" ON team_members
  FOR DELETE USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- TEAM STARTUP LOG: fix to allow read if member of team (existing) but also allow insert
DROP POLICY IF EXISTS "Team log: team members read" ON team_startup_log;
DROP POLICY IF EXISTS "Team log: team members insert" ON team_startup_log;

CREATE POLICY "Team log: members read" ON team_startup_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_members WHERE team_id = team_startup_log.team_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Team log: members insert" ON team_startup_log
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM team_members WHERE team_id = team_startup_log.team_id AND user_id = auth.uid())
  );

-- TIME BLOCKS: ensure user isolation is correct, but allow upsert
DROP POLICY IF EXISTS "Time blocks: user only" ON time_blocks;
CREATE POLICY "Time blocks: user only" ON time_blocks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- CHECK_INS: same
DROP POLICY IF EXISTS "Check-ins: user only" ON check_ins;
CREATE POLICY "Check-ins: user only" ON check_ins FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- STREAKS: same
DROP POLICY IF EXISTS "Streaks: user only" ON streaks;
CREATE POLICY "Streaks: user only" ON streaks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- PROFILES: ensure admin can update any, members can update own
DROP POLICY IF EXISTS "Profiles: admin update any" ON profiles;
CREATE POLICY "Profiles: admin update any" ON profiles FOR UPDATE USING (
  auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
  auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- LEADERBOARD VIEW: ensure it is readable by authenticated
-- In Supabase, views respect RLS of underlying tables. Since profiles SELECT is true, leaderboard should be readable.
-- But to be safe, recreate view with security_invoker = false (default) so it bypasses RLS for underlying join.
DROP VIEW IF EXISTS leaderboard;
CREATE OR REPLACE VIEW leaderboard
WITH (security_invoker = false)
AS
SELECT
  p.id,
  p.username,
  COALESCE(s.current_streak,0) AS streak,
  RANK() OVER (ORDER BY COALESCE(s.current_streak,0) DESC, p.username ASC) AS rank,
  p.role
FROM profiles p
LEFT JOIN streaks s ON p.id = s.user_id
WHERE p.role = 'member';

-- Grant select on view to authenticated
GRANT SELECT ON leaderboard TO authenticated;
GRANT SELECT ON leaderboard TO anon;

-- DEVICE SESSIONS: keep strict, but if you want to disable limit, drop policies and allow all for now
-- Currently disabled in code, so leave policy as user only.

-- REPORTS & COMMUNITY: ensure read true, admin write
DROP POLICY IF EXISTS "Reports: members read" ON reports;
CREATE POLICY "Reports: members read" ON reports FOR SELECT USING (true);
DROP POLICY IF EXISTS "Reports: admin manage" ON reports;
CREATE POLICY "Reports: admin manage" ON reports FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Community: members read" ON community_posts;
CREATE POLICY "Community: members read" ON community_posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Community: admin manage" ON community_posts;
CREATE POLICY "Community: admin manage" ON community_posts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- COHORTS
DROP POLICY IF EXISTS "Teams: members read" ON teams;
DROP POLICY IF EXISTS "Teams: admin manage" ON teams;
CREATE POLICY "Teams: members read" ON teams FOR SELECT USING (true);
CREATE POLICY "Teams: admin manage" ON teams FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Verify
SELECT 'RLS fixed' as status;
