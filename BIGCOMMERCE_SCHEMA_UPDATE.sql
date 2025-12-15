-- BigCommerce Integration Schema Update
-- Run this SQL in your Supabase SQL Editor to add BigCommerce credentials support

-- Add BigCommerce credentials columns to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS bigcommerce_store_hash text,
ADD COLUMN IF NOT EXISTS bigcommerce_client_id text,
ADD COLUMN IF NOT EXISTS bigcommerce_access_token text,
ADD COLUMN IF NOT EXISTS bigcommerce_connected_at timestamptz;

-- Add an index for quick lookup of connected stores
CREATE INDEX IF NOT EXISTS idx_org_bigcommerce_store ON organizations(bigcommerce_store_hash) 
WHERE bigcommerce_store_hash IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN organizations.bigcommerce_store_hash IS 'BigCommerce store hash identifier';
COMMENT ON COLUMN organizations.bigcommerce_client_id IS 'BigCommerce API client ID';
COMMENT ON COLUMN organizations.bigcommerce_access_token IS 'BigCommerce API access token';
COMMENT ON COLUMN organizations.bigcommerce_connected_at IS 'Timestamp when BigCommerce was connected';

