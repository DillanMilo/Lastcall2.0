-- Operational Inventory Support Migration
-- Run this SQL in your Supabase SQL Editor to add support for operational/back-of-house items

-- Add item_type column to distinguish between sellable stock and operational items
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'stock' CHECK (item_type IN ('stock', 'operational'));

-- Add operational_category for categorizing back-of-house items
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS operational_category TEXT;

-- Create index for efficient filtering by item_type
CREATE INDEX IF NOT EXISTS idx_inventory_items_type ON inventory_items(org_id, item_type);

-- Add comments for documentation
COMMENT ON COLUMN inventory_items.item_type IS 'Type of item: stock (sellable, syncs to POS) or operational (back-of-house, LastCall only)';
COMMENT ON COLUMN inventory_items.operational_category IS 'Category for operational items: Cleaning, Office, Kitchen, Packaging, etc.';

-- Common operational categories reference (for UI dropdowns):
-- - Cleaning (cleaning supplies, sanitizers, mops, etc.)
-- - Office (printer paper, pens, staplers, etc.)
-- - Kitchen (spices, utensils, pots, pans, etc.)
-- - Packaging (boxes, bags, labels, stickers, etc.)
-- - Tableware (plates, cups, napkins, straws, etc.)
-- - Maintenance (tools, light bulbs, batteries, etc.)
-- - Safety (first aid, fire extinguisher, etc.)
-- - Other (miscellaneous operational items)
