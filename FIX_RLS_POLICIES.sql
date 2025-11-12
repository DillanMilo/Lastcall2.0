-- Fix RLS Policies for User Sign-In
-- Run this in your Supabase SQL Editor
-- This allows users to create their own records and organizations

-- ============================================
-- USERS TABLE POLICIES
-- ============================================

-- Allow users to insert their own record (for first-time sign-in)
CREATE POLICY "Users can insert own data" ON users
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own data
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- ORGANIZATIONS TABLE POLICIES
-- ============================================

-- Allow authenticated users to create organizations
-- (Users will create their own organization on first sign-in)
CREATE POLICY "Authenticated users can create organizations" ON organizations
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- Allow users to read their own organization
CREATE POLICY "Users can read own organization" ON organizations
  FOR SELECT 
  USING (
    id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- Allow users to update their own organization
CREATE POLICY "Users can update own organization" ON organizations
  FOR UPDATE 
  USING (
    id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- ============================================
-- IMPORTS TABLE POLICIES
-- ============================================

-- Allow users to insert imports for their org
CREATE POLICY "Users can insert org imports" ON imports
  FOR INSERT 
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- Allow users to read imports for their org
CREATE POLICY "Users can read org imports" ON imports
  FOR SELECT 
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- ============================================
-- VERIFY POLICIES
-- ============================================

-- Check that all policies are created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('users', 'organizations', 'inventory_items', 'imports')
ORDER BY tablename, policyname;

