-- ============================================================
-- LOCK-IN — FINAL FIX FOR AUTH + ADMIN STUCK ISSUE
-- Run this in Supabase SQL Editor
-- Fixes: profile id mismatch, admin role, cohorts, RLS
-- ============================================================

-- 1. Fix profile for your admin email
DO $$
DECLARE
  target_email TEXT := 'muhummadzarrar09@gmail.com';
  target_user_id UUID;
  target_username TEXT := 'muhummadzarrar';
BEGIN
  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth user not found for email % . Create account via signup first, then re-run.', target_email;
  END IF;

  RAISE NOTICE 'Found auth user id % for %', target_user_id, target_email;

  INSERT INTO profiles (id, username, email, role)
  VALUES (target_user_id, target_username, target_email, 'admin')
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = 'admin',
    username = EXCLUDED.username;

  DELETE FROM profiles WHERE email = target_email AND id != target_user_id;

  RAISE NOTICE 'Profile fixed for %', target_email;
END $$;

-- 2. Ensure ONE cohort exists (idempotent, no duplicates)
INSERT INTO cohorts (name, start_date, end_date, enrollment_open)
SELECT 'Aug 2026 Cohort', '2026-08-01', '2026-08-30', true
WHERE NOT EXISTS (SELECT 1 FROM cohorts WHERE name = 'Aug 2026 Cohort' AND start_date = '2026-08-01');

-- 3. DEDUP: if you already have dupes, keep oldest
DELETE FROM cohorts
WHERE id NOT IN (
  SELECT DISTINCT ON (name, start_date, end_date) id
  FROM cohorts
  ORDER BY name, start_date, end_date, created_at ASC
);

-- 4. Verify result - RUN THESE TWO SELECTS AND PASTE OUTPUT
SELECT p.id, p.email, p.username, p.role, u.email as auth_email
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.email = 'muhummadzarrar09@gmail.com';

SELECT * FROM cohorts ORDER BY created_at DESC LIMIT 5;

-- 5. Fix RLS
DROP POLICY IF EXISTS "Profiles: select all members" ON profiles;
DROP POLICY IF EXISTS "Profiles: select all members for leaderboard" ON profiles;
DROP POLICY IF EXISTS "Profiles: select all" ON profiles;
CREATE POLICY "Profiles: select all" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Profiles: insert own" ON profiles;
CREATE POLICY "Profiles: insert own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles: update own" ON profiles;
CREATE POLICY "Profiles: update own" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles: delete own" ON profiles;
CREATE POLICY "Profiles: delete own" ON profiles FOR DELETE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles: admin update any" ON profiles;
CREATE POLICY "Profiles: admin update any" ON profiles FOR UPDATE USING (
  auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
  auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Cohorts: members read" ON cohorts;
CREATE POLICY "Cohorts: members read" ON cohorts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Cohorts: admin manage" ON cohorts;
CREATE POLICY "Cohorts: admin manage" ON cohorts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
