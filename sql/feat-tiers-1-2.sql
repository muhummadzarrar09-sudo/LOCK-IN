-- ============================================================
-- LOCK-IN — Tier 1 + Tier 2 feature additions
-- Run in Supabase SQL Editor (idempotent — safe to re-run)
-- ============================================================

-- 1. Reminder prefs on profiles (JSONB so we can extend without migrations)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS reminder_prefs JSONB DEFAULT '{}'::jsonb;

-- 2. notification_prefs: an optional, normalized view on top of the JSONB
--    Useful for cohort lead analytics ("how many members have reminders on?")
COMMENT ON COLUMN profiles.reminder_prefs IS
  'Reminder preferences. Keys: enabled (bool), checkIn, dailyStart, newReport, teamUpdate (all bools), minutesBefore (int).';

-- 3. Ensure profiles.select allows the current user to read their own row
--    (existing policy already covers this, but make sure reminder_prefs is in scope)
-- No change needed — RLS is per-row, not per-column.

-- 4. Helpful index for the "users with reminders enabled" cohort metric
CREATE INDEX IF NOT EXISTS idx_profiles_reminder_enabled
  ON profiles ((reminder_prefs->>'enabled'))
  WHERE reminder_prefs->>'enabled' = 'true';
