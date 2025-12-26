-- Add estimate fields to contractor_bids table
-- This allows contractors to attach professional AI-generated estimates to their bids

ALTER TABLE contractor_bids
ADD COLUMN IF NOT EXISTS has_estimate BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS estimate JSONB;

-- Create index for querying bids with estimates
CREATE INDEX IF NOT EXISTS idx_contractor_bids_has_estimate ON contractor_bids(has_estimate) WHERE has_estimate = TRUE;

-- Add comments
COMMENT ON COLUMN contractor_bids.has_estimate IS 'Flag indicating if this bid includes a detailed estimate';
COMMENT ON COLUMN contractor_bids.estimate IS 'Full estimate data from pricing estimator (line items, costs, project details)';
