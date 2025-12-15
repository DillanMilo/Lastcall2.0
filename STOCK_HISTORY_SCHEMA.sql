-- Stock Movement History Table
-- This table tracks all inventory changes over time for smart ordering predictions
-- Run this in your Supabase SQL Editor

-- Create the inventory_history table
CREATE TABLE IF NOT EXISTS inventory_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid REFERENCES organizations (id) ON DELETE CASCADE,
  item_id uuid REFERENCES inventory_items (id) ON DELETE CASCADE,
  item_name text NOT NULL,
  sku text,
  previous_quantity int NOT NULL DEFAULT 0,
  new_quantity int NOT NULL DEFAULT 0,
  quantity_change int NOT NULL DEFAULT 0,
  change_type text NOT NULL DEFAULT 'sync',
  source text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_inventory_history_org_id ON inventory_history(org_id);
CREATE INDEX IF NOT EXISTS idx_inventory_history_item_id ON inventory_history(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_history_created_at ON inventory_history(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_history_sku ON inventory_history(sku);

-- Add RLS policies
ALTER TABLE inventory_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read history for their org
CREATE POLICY "Users can read org inventory history" ON inventory_history
  FOR SELECT 
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: Service role can insert history
CREATE POLICY "Service role can insert history" ON inventory_history
  FOR INSERT 
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE inventory_history IS 'Tracks all inventory quantity changes for analytics and smart ordering predictions';
COMMENT ON COLUMN inventory_history.quantity_change IS 'Positive = restock/increase, Negative = sale/decrease';
COMMENT ON COLUMN inventory_history.change_type IS 'Type of change: sync, manual, sale, restock, adjustment, webhook';

-- Create a view for easy stock movement analysis
CREATE OR REPLACE VIEW stock_movement_summary AS
SELECT 
  h.org_id,
  h.item_id,
  h.item_name,
  h.sku,
  SUM(CASE WHEN h.quantity_change < 0 THEN ABS(h.quantity_change) ELSE 0 END) AS total_sold,
  SUM(CASE WHEN h.quantity_change > 0 THEN h.quantity_change ELSE 0 END) AS total_restocked,
  COUNT(*) AS change_count,
  MIN(h.created_at) AS first_tracked,
  MAX(h.created_at) AS last_tracked
FROM inventory_history h
WHERE h.created_at >= now() - interval '30 days'
GROUP BY h.org_id, h.item_id, h.item_name, h.sku;
