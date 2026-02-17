-- Add timezone column to organizations table.
-- This allows daily sales reports to use the business's local midnight
-- instead of UTC midnight, which fixes incorrect date boundaries.
-- Uses IANA timezone identifiers (e.g. 'America/Chicago', 'America/Los_Angeles').

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Chicago';

COMMENT ON COLUMN organizations.timezone IS 'IANA timezone for the business (e.g. America/Chicago). Used for daily sales report date boundaries.';
