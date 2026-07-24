-- ============================================================
-- LOCK-IN — Bug reports table
-- Run in Supabase SQL Editor (idempotent — safe to re-run)
-- ============================================================

-- Members report problems; admin reads & triages via the Admin Support tab.
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

-- Members can create their own reports
DROP POLICY IF EXISTS "Bug reports: user can insert own" ON bug_reports;
CREATE POLICY "Bug reports: user can insert own" ON bug_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Members can read their own; admins can read all
DROP POLICY IF EXISTS "Bug reports: read own or admin" ON bug_reports;
CREATE POLICY "Bug reports: read own or admin" ON bug_reports
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can update
DROP POLICY IF EXISTS "Bug reports: admin can update" ON bug_reports;
CREATE POLICY "Bug reports: admin can update" ON bug_reports
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));
