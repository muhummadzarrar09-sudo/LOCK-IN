-- ============================================================
-- LOCK-IN — MANUAL ACCESS SCRIPT (Run in SQL Editor)
-- Allows: muhummadzarrar09@gmail.com
-- Gives: admin role, creates profile if missing, ensures cohort exists
-- ============================================================

-- 1. Create/Update profile for this user (admin access)
-- Note: This assumes the auth user exists. If auth user doesn't exist,
-- create the account via the app signup page first.
INSERT INTO profiles (id, username, email, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'muhummadzarrar09@gmail.com'),
  'muhummadzarrar',
  'muhummadzarrar09@gmail.com',
  'admin'
)
ON CONFLICT (email) DO UPDATE SET
  role = EXCLUDED.role,
  username = EXCLUDED.username;

-- 2. Ensure a cohort exists (so admin panel works)
INSERT INTO cohorts (name, start_date, end_date, enrollment_open)
VALUES ('Aug 2026 Cohort', '2026-08-01', '2026-08-30', true)
ON CONFLICT DO NOTHING;

-- 3. Confirm the user is set
SELECT * FROM profiles WHERE email = 'muhummadzarrar09@gmail.com';
