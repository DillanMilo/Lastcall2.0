-- Add invoice field to inventory_items table
-- Run this in Supabase SQL Editor

ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS invoice TEXT;

-- Create index for invoice lookups
CREATE INDEX IF NOT EXISTS idx_inventory_invoice ON inventory_items(invoice);

-- Add comment
COMMENT ON COLUMN inventory_items.invoice IS 'Invoice/batch number for tracking product lots with different expiry dates';

