-- Multi-Merchant Clover Connections Schema
-- Supports multiple Clover merchants per organization (e.g., physical + online store)
-- Run this in your Supabase SQL Editor

-- Create the clover_connections table
CREATE TABLE IF NOT EXISTS clover_connections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid REFERENCES organizations (id) ON DELETE CASCADE NOT NULL,
  merchant_id text NOT NULL,
  access_token text NOT NULL,
  label text NOT NULL DEFAULT 'Store',
  environment text NOT NULL DEFAULT 'us',
  merchant_name text,
  connected_at timestamptz DEFAULT now(),
  UNIQUE(org_id, merchant_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_clover_connections_org_id ON clover_connections(org_id);
CREATE INDEX IF NOT EXISTS idx_clover_connections_merchant_id ON clover_connections(merchant_id);

-- Add RLS policies
ALTER TABLE clover_connections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their org's Clover connections
CREATE POLICY "Users can read org clover connections" ON clover_connections
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: Service role can manage connections (server-side only)
CREATE POLICY "Service role can insert clover connections" ON clover_connections
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update clover connections" ON clover_connections
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete clover connections" ON clover_connections
  FOR DELETE
  USING (true);

-- Add clover_merchant_id to inventory_items to track which merchant each item belongs to
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS clover_merchant_id text;

CREATE INDEX IF NOT EXISTS idx_inventory_items_clover_merchant ON inventory_items(clover_merchant_id);

-- Comments
COMMENT ON TABLE clover_connections IS 'Stores multiple Clover POS merchant connections per organization';
COMMENT ON COLUMN clover_connections.label IS 'User-friendly label for this merchant (e.g., Physical Store, Online Store)';
COMMENT ON COLUMN clover_connections.environment IS 'Clover API region: us or eu';
COMMENT ON COLUMN inventory_items.clover_merchant_id IS 'Which Clover merchant this item belongs to (for multi-merchant orgs)';

-- Migrate existing single-merchant data into clover_connections table
-- Run this AFTER creating the table to preserve existing connections
INSERT INTO clover_connections (org_id, merchant_id, access_token, label, connected_at)
SELECT id, clover_merchant_id, clover_access_token, 'Store', clover_connected_at
FROM organizations
WHERE clover_merchant_id IS NOT NULL AND clover_access_token IS NOT NULL
ON CONFLICT (org_id, merchant_id) DO NOTHING;
