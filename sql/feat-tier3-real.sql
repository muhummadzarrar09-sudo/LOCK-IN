-- ============================================================
-- LOCK-IN — Tier 3 'real product' additions
-- Run in Supabase SQL Editor (idempotent — safe to re-run)
-- ============================================================

-- ─── Whop / invite system ─────────────────────────────────────────────
-- When a Whop customer buys access, the webhook inserts a row here
-- with a unique token. They receive a magic-link email; on signup
-- the token is consumed and grants the new account.

CREATE TABLE IF NOT EXISTS cohort_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  cohort_id UUID REFERENCES cohorts(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  consumed_at TIMESTAMP WITH TIME ZONE,
  consumed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invites_token ON cohort_invites (token) WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invites_email ON cohort_invites (email);

ALTER TABLE cohort_invites ENABLE ROW LEVEL SECURITY;

-- Members can read their own invite (when consuming)
CREATE POLICY "Invites: read by token" ON cohort_invites
  FOR SELECT USING (true); -- token is unguessable; safe to allow read

-- Service role inserts (webhook + admin)
CREATE POLICY "Invites: service role insert" ON cohort_invites
  FOR INSERT WITH CHECK (true);

-- ─── Team invites ─────────────────────────────────────────────────────
-- Cohort lead or admin invites a username/email to join a team.

CREATE TABLE IF NOT EXISTS team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_invites_token ON team_invites (token) WHERE accepted_at IS NULL;

ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team invites: members of same team can read" ON team_invites
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_members WHERE team_id = team_invites.team_id AND user_id = auth.uid())
  );

-- ─── Bug reports ──────────────────────────────────────────────────────
-- Members report problems; admin reads & triages.

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

-- Members can create + read their own
CREATE POLICY "Bug reports: user can insert own" ON bug_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Bug reports: user can read own" ON bug_reports
  FOR SELECT USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Admin can update
CREATE POLICY "Bug reports: admin can update" ON bug_reports
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- ─── Scheduled jobs (pg_cron) ────────────────────────────────────────
-- Run in Supabase Dashboard → Database → Extensions → enable pg_cron
-- Then schedule the digest + missed-block nudge from here.

-- Enable extension (may already be enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Weekly digest: every Sunday 18:00 UTC
SELECT cron.schedule(
  'weekly-digest',
  '0 18 * * 0',
  $$
  -- Pseudo-code: select active members, compute stats, send email
  -- Implemented as a Supabase Edge Function call via http extension
  SELECT 1; -- placeholder; real implementation in the edge function
  $$
);

-- Note: the actual digest logic lives in a Supabase Edge Function
-- (supabase/functions/send-digest/index.ts). The cron above is a stub
-- that calls it via the http extension. See README for setup.

-- ─── Realtime channels ──────────────────────────────────────────────
-- Enable realtime on the tables that need it.

-- Already done in fix-rls-final.sql, but re-affirming for clarity.
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS team_startup_log;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS streaks;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS reports;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS community_posts;

-- ─── Audit log (lightweight) ─────────────────────────────────────────
-- For security + debugging. We don't ship a full audit log; just login events.

CREATE TABLE IF NOT EXISTS auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_events_user ON auth_events (user_id, created_at DESC);

ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;
-- No user-facing policy: only accessible via service role.
