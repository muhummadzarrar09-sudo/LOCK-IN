-- ============================================================
-- LOCK-IN — MANUAL ACCESS SCRIPT (FIXED VERSION)
-- Run in Supabase SQL Editor
-- This version fixes id mismatch bug that caused admin stuck
-- ============================================================

-- Robust fix: ensures profile id matches auth.users id
DO $$
DECLARE
  v_email TEXT := 'muhummadzarrar09@gmail.com';
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth user for %. Sign up first.', v_email;
  END IF;

  INSERT INTO profiles (id, username, email, role)
  VALUES (v_user_id, 'muhummadzarrar', v_email, 'admin')
  ON CONFLICT (id) DO UPDATE SET role = 'admin', username = 'muhummadzarrar', email = v_email;

  DELETE FROM profiles WHERE email = v_email AND id <> v_user_id;
END $$;

-- Ensure cohort exists
INSERT INTO cohorts (name, start_date, end_date, enrollment_open)
VALUES ('Aug 2026 Cohort', '2026-08-01', '2026-08-30', true)
ON CONFLICT DO NOTHING;

-- Verify
SELECT p.*, u.email as auth_email FROM profiles p JOIN auth.users u ON p.id = u.id WHERE p.email = 'muhummadzarrar09@gmail.com';
