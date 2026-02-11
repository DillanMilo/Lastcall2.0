-- Thrive Validation Mode Schema Update
-- Adds columns to organizations table to support parallel running of LastCallIQ alongside Thrive
-- Run this in your Supabase SQL Editor

-- Add Thrive validation mode columns to organizations table
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS thrive_validation_mode boolean DEFAULT false;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS thrive_validation_started_at timestamptz;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS thrive_validation_ended_at timestamptz;

-- Comments for documentation
COMMENT ON COLUMN organizations.thrive_validation_mode IS 'When true, LastCallIQ runs in read-only mode alongside Thrive for data capture validation. Push to Clover is blocked.';
COMMENT ON COLUMN organizations.thrive_validation_started_at IS 'Timestamp when Thrive validation mode was last enabled';
COMMENT ON COLUMN organizations.thrive_validation_ended_at IS 'Timestamp when Thrive validation mode was last disabled';
