-- LastCall 2.0 Supabase Database Schema
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  full_name text,
  org_id uuid,
  created_at timestamptz DEFAULT now()
);

-- ORGANIZATIONS TABLE
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  subscription_tier text DEFAULT 'growth',
  created_at timestamptz DEFAULT now()
);

-- INVENTORY ITEMS TABLE
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid REFERENCES organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  quantity int DEFAULT 0,
  reorder_threshold int DEFAULT 0,
  ai_label text,
  category text,
  expiration_date date,
  last_restock timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- IMPORT LOGS TABLE
CREATE TABLE IF NOT EXISTS imports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid REFERENCES organizations (id) ON DELETE CASCADE,
  source text,
  status text DEFAULT 'completed',
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_inventory_org_id ON inventory_items(org_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory_items(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_created_at ON inventory_items(created_at);
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);

-- Add Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE imports ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own data
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid() = id);

-- Policy: Users can read their organization's data
CREATE POLICY "Users can read org inventory" ON inventory_items
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert inventory items for their org
CREATE POLICY "Users can insert org inventory" ON inventory_items
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: Users can update inventory items for their org
CREATE POLICY "Users can update org inventory" ON inventory_items
  FOR UPDATE USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete inventory items for their org
CREATE POLICY "Users can delete org inventory" ON inventory_items
  FOR DELETE USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts linked to organizations';
COMMENT ON TABLE organizations IS 'Tenant organizations with subscription tiers';
COMMENT ON TABLE inventory_items IS 'Main inventory items with AI labels and tracking';
COMMENT ON TABLE imports IS 'Log of CSV imports and API syncs';

