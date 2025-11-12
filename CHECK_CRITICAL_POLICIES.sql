-- Check if the critical policies for sign-in are present
-- Run this to verify your RLS policies are correct

SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual = 'true' THEN '⚠️ TOO PERMISSIVE - Allows all rows'
    WHEN qual IS NULL AND with_check IS NULL THEN '⚠️ NO RESTRICTIONS'
    ELSE '✅ Has restrictions'
  END as security_level
FROM pg_policies
WHERE tablename IN ('users', 'organizations')
  AND policyname IN (
    'Users can insert own data',
    'Users can update own data',
    'Users can read own data',
    'Authenticated users can create organizations',
    'Users can read own organization',
    'Users can update own organization'
  )
ORDER BY tablename, cmd, policyname;

-- Also check for any overly permissive policies that might be a security risk
SELECT 
  tablename,
  policyname,
  cmd,
  '⚠️ WARNING: This policy allows ALL rows!' as warning
FROM pg_policies
WHERE tablename IN ('users', 'organizations', 'inventory_items', 'imports')
  AND (qual = 'true' OR (qual IS NULL AND with_check IS NULL))
ORDER BY tablename, policyname;

