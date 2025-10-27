-- Fix: Add current authenticated user to users table
-- Run this in Supabase SQL Editor if you're getting "Error fetching user data"

-- This will insert any authenticated users who aren't in the users table yet
INSERT INTO users (id, email, full_name, org_id, created_at)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', 'User'),
  '00000000-0000-0000-0000-000000000001',  -- Default Angus Biltong org
  au.created_at
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE users.id = au.id
);

-- Verify it worked
SELECT id, email, full_name, org_id 
FROM users
ORDER BY created_at DESC
LIMIT 5;

