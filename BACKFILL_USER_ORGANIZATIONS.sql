-- BACKFILL_USER_ORGANIZATIONS.sql
-- Run this script in Supabase SQL Editor to ensure all existing users
-- have entries in the user_organizations table for multi-org switching to work
--
-- This is REQUIRED if you have existing users who signed up before the
-- multi-org feature was implemented

-- Step 1: View existing data (run this first to see current state)
-- SELECT
--   u.id as user_id,
--   u.email,
--   u.org_id as users_org_id,
--   u.role as users_role,
--   uo.org_id as uo_org_id,
--   uo.role as uo_role,
--   uo.is_active
-- FROM users u
-- LEFT JOIN user_organizations uo ON u.id = uo.user_id
-- ORDER BY u.email;

-- Step 2: Backfill missing user_organizations entries
-- This inserts records for users who have an org_id but aren't in user_organizations
INSERT INTO user_organizations (user_id, org_id, role, is_active, joined_at)
SELECT
  u.id as user_id,
  u.org_id as org_id,
  COALESCE(u.role, 'admin') as role,
  true as is_active,
  COALESCE(u.created_at, NOW()) as joined_at
FROM users u
WHERE u.org_id IS NOT NULL
  AND u.org_id != '00000000-0000-0000-0000-000000000000'
  AND u.org_id != '00000000-0000-0000-0000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM user_organizations uo
    WHERE uo.user_id = u.id AND uo.org_id = u.org_id
  )
ON CONFLICT (user_id, org_id) DO NOTHING;

-- Step 3: Verify the backfill (run this to confirm it worked)
-- SELECT
--   u.id as user_id,
--   u.email,
--   u.org_id as users_org_id,
--   uo.org_id as uo_org_id,
--   uo.role,
--   uo.is_active
-- FROM users u
-- LEFT JOIN user_organizations uo ON u.id = uo.user_id AND u.org_id = uo.org_id
-- ORDER BY u.email;

-- Step 4: Ensure only one org is active per user (fix any duplicate active entries)
-- First, find users with multiple active orgs
-- SELECT user_id, COUNT(*) as active_count
-- FROM user_organizations
-- WHERE is_active = true
-- GROUP BY user_id
-- HAVING COUNT(*) > 1;

-- If there are duplicates, this will keep only the one matching users.org_id as active
UPDATE user_organizations uo
SET is_active = (
  uo.org_id = (SELECT u.org_id FROM users u WHERE u.id = uo.user_id)
)
WHERE EXISTS (
  SELECT 1
  FROM user_organizations uo2
  WHERE uo2.user_id = uo.user_id
    AND uo2.is_active = true
  GROUP BY uo2.user_id
  HAVING COUNT(*) > 1
);

-- Done! Your users should now be able to see and switch between organizations.
