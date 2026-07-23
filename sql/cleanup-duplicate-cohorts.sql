-- Cleanup duplicate cohorts - you have 2 identical Aug 2026 Cohorts
-- Keep the oldest one, delete the rest with same name+dates

-- See duplicates
SELECT id, name, start_date, end_date, created_at FROM cohorts ORDER BY created_at;

-- Delete duplicates: keep earliest created_at per (name,start_date,end_date)
DELETE FROM cohorts
WHERE id NOT IN (
  SELECT DISTINCT ON (name, start_date, end_date) id
  FROM cohorts
  ORDER BY name, start_date, end_date, created_at ASC
);

-- Verify only 1 remains
SELECT * FROM cohorts ORDER BY created_at;

-- Optional: Add unique index to prevent future dupes (uncomment to enforce)
-- CREATE UNIQUE INDEX IF NOT EXISTS uniq_cohort_name_dates ON cohorts(name, start_date, end_date);
