-- FIX_MISSING_RLS_POLICIES.sql
-- Run this in Supabase SQL Editor to fix missing RLS policies
-- These are REQUIRED for the invite flow to work properly

-- ============================================
-- TEAM_INVITES TABLE POLICIES (MISSING!)
-- ============================================

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view invites for their org" ON team_invites;
DROP POLICY IF EXISTS "Admins can create invites" ON team_invites;
DROP POLICY IF EXISTS "Admins can delete invites" ON team_invites;
DROP POLICY IF EXISTS "Anyone can read invite by token" ON team_invites;
DROP POLICY IF EXISTS "Service role full access to invites" ON team_invites;

-- Policy: Service role has full access (for API routes)
CREATE POLICY "Service role full access to invites" ON team_invites
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policy: Users can view invites for their organization
CREATE POLICY "Users can view invites for their org" ON team_invites
  FOR SELECT
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- ============================================
-- USER_ORGANIZATIONS TABLE POLICIES (MISSING INSERT!)
-- ============================================

-- Drop existing if any
DROP POLICY IF EXISTS "Service role full access to user_organizations" ON user_organizations;
DROP POLICY IF EXISTS "Users can insert own memberships" ON user_organizations;

-- Policy: Service role has full access (for API routes)
CREATE POLICY "Service role full access to user_organizations" ON user_organizations
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policy: Users can insert their own memberships (backup for client-side)
CREATE POLICY "Users can insert own memberships" ON user_organizations
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- AI_REQUESTS TABLE POLICIES (MISSING!)
-- ============================================

-- Drop existing if any
DROP POLICY IF EXISTS "Service role full access to ai_requests" ON ai_requests;
DROP POLICY IF EXISTS "Users can view own org ai_requests" ON ai_requests;
DROP POLICY IF EXISTS "Users can insert ai_requests for own org" ON ai_requests;

-- Policy: Service role has full access
CREATE POLICY "Service role full access to ai_requests" ON ai_requests
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policy: Users can view AI requests for their org
CREATE POLICY "Users can view own org ai_requests" ON ai_requests
  FOR SELECT
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- Policy: Users can insert AI requests for their org
CREATE POLICY "Users can insert ai_requests for own org" ON ai_requests
  FOR INSERT
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- ============================================
-- VERIFY ALL POLICIES
-- ============================================

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('team_invites', 'user_organizations', 'ai_requests')
ORDER BY tablename, policyname;
