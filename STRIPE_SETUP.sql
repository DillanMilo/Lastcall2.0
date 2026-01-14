-- Stripe Integration Database Migration
-- Run this SQL in your Supabase SQL Editor to add Stripe fields

-- Add Stripe columns to organizations table
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_failed_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_read_only BOOLEAN DEFAULT FALSE;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer
ON organizations(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_organizations_stripe_subscription
ON organizations(stripe_subscription_id);

-- Update existing subscription_tier to support new tiers
-- Note: This just updates the column, existing values like 'growth', 'enterprise', 'trial' will still work
COMMENT ON COLUMN organizations.subscription_tier IS 'Subscription tier: free, starter, growth, pro, enterprise, trial';
COMMENT ON COLUMN organizations.subscription_status IS 'Stripe subscription status: active, canceled, past_due, trialing';
COMMENT ON COLUMN organizations.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN organizations.stripe_subscription_id IS 'Stripe subscription ID';
COMMENT ON COLUMN organizations.subscription_period_end IS 'When the current billing period ends';
COMMENT ON COLUMN organizations.payment_failed_at IS 'When payment first failed (7-day grace period starts here)';
COMMENT ON COLUMN organizations.canceled_at IS 'When subscription was cancelled';
COMMENT ON COLUMN organizations.is_read_only IS 'Read-only mode after grace period/subscription ends';

-- Optional: Update existing organizations without a tier to 'free'
-- UPDATE organizations SET subscription_tier = 'free' WHERE subscription_tier IS NULL;

-- AI Requests tracking table (for tier limits)
CREATE TABLE IF NOT EXISTS ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL, -- 'assistant', 'label', 'action'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient monthly counting
CREATE INDEX IF NOT EXISTS idx_ai_requests_org_month
ON ai_requests(org_id, created_at);

-- Enable RLS
ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only see their org's requests
CREATE POLICY "Users can view own org ai_requests" ON ai_requests
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- RLS policy: users can insert for their org
CREATE POLICY "Users can insert own org ai_requests" ON ai_requests
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- Team Invites table
CREATE TABLE IF NOT EXISTS team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member', -- 'admin' or 'member'
  invited_by UUID REFERENCES auth.users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for looking up invites by token
CREATE INDEX IF NOT EXISTS idx_team_invites_token ON team_invites(token);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON team_invites(email);
CREATE INDEX IF NOT EXISTS idx_team_invites_org ON team_invites(org_id);

-- Enable RLS
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

-- RLS policy: org members can view invites
CREATE POLICY "Org members can view team_invites" ON team_invites
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- RLS policy: org members can create invites
CREATE POLICY "Org members can create team_invites" ON team_invites
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- RLS policy: org members can delete invites
CREATE POLICY "Org members can delete team_invites" ON team_invites
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- Add role column to users table if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';
