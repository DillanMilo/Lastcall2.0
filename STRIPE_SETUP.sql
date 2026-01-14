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
