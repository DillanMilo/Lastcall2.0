-- Demo Account Setup for LastCall 2.0
-- Run this in Supabase SQL Editor

-- 1. Create demo auth user (if not exists)
-- Note: You need to do this via Supabase Dashboard > Authentication > Users
-- Click "Add User" and create:
--   Email: demo@lastcall.app
--   Password: demo123456
--   Auto Confirm: YES

-- 2. After creating the auth user, run this to add them to users table:

-- Insert demo user into users table
INSERT INTO users (id, email, full_name, phone, org_id, created_at)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'demo@lastcall.app'),
  'demo@lastcall.app',
  'Demo User',
  '+1 (555) 123-4567',
  '00000000-0000-0000-0000-000000000001',
  NOW()
)
ON CONFLICT (id) DO UPDATE 
SET 
  full_name = 'Demo User',
  phone = '+1 (555) 123-4567',
  org_id = '00000000-0000-0000-0000-000000000001';

-- 3. Verify demo user exists
SELECT u.id, u.email, u.full_name, u.phone, o.name as org_name
FROM users u
LEFT JOIN organizations o ON u.org_id = o.id
WHERE u.email = 'demo@lastcall.app';

-- Expected output:
-- Should show demo@lastcall.app with Angus Biltong organization

-- 4. Sign in at: http://localhost:3000/auth/signin
--    Email: demo@lastcall.app
--    Password: demo123456

