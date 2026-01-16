-- Multi-Organization Support Migration
-- Run this SQL in your Supabase SQL Editor to enable users to belong to multiple organizations

-- Create user_organizations join table
CREATE TABLE IF NOT EXISTS user_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'admin' or 'member'
  is_active BOOLEAN DEFAULT FALSE, -- Only one org can be active at a time per user
  joined_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure a user can only be in an org once
  UNIQUE(user_id, org_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_organizations_user ON user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_org ON user_organizations(org_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_active ON user_organizations(user_id, is_active) WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can view their own memberships
CREATE POLICY "Users can view own memberships" ON user_organizations
  FOR SELECT USING (user_id = auth.uid());

-- RLS policy: users can update their own memberships (for switching active org)
CREATE POLICY "Users can update own memberships" ON user_organizations
  FOR UPDATE USING (user_id = auth.uid());

-- Migrate existing user data to user_organizations table
-- This creates membership records for all existing users
INSERT INTO user_organizations (user_id, org_id, role, is_active, joined_at)
SELECT
  id as user_id,
  org_id,
  COALESCE(role, 'member') as role,
  TRUE as is_active, -- Their current org is active
  COALESCE(created_at, NOW()) as joined_at
FROM users
WHERE org_id IS NOT NULL
ON CONFLICT (user_id, org_id) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE user_organizations IS 'Join table tracking which organizations a user belongs to';
COMMENT ON COLUMN user_organizations.user_id IS 'Reference to auth.users';
COMMENT ON COLUMN user_organizations.org_id IS 'Reference to organizations';
COMMENT ON COLUMN user_organizations.role IS 'User role in this organization: admin or member';
COMMENT ON COLUMN user_organizations.is_active IS 'Whether this is the users currently active organization';
COMMENT ON COLUMN user_organizations.joined_at IS 'When the user joined this organization';
