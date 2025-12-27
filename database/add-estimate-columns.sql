-- Add estimate columns to contractor_bids table
-- This allows contractors to attach AI-generated estimates to their bids

DO $$
BEGIN
  -- Add estimate JSONB column to store estimate data
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contractor_bids' AND column_name = 'estimate'
  ) THEN
    ALTER TABLE contractor_bids ADD COLUMN estimate JSONB;
  END IF;

  -- Add has_estimate boolean flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contractor_bids' AND column_name = 'has_estimate'
  ) THEN
    ALTER TABLE contractor_bids ADD COLUMN has_estimate BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create index for searching bids with estimates
CREATE INDEX IF NOT EXISTS idx_contractor_bids_has_estimate ON contractor_bids(has_estimate) WHERE has_estimate = true;

-- Comment
COMMENT ON COLUMN contractor_bids.estimate IS 'AI-generated estimate data attached to bid';
COMMENT ON COLUMN contractor_bids.has_estimate IS 'Flag indicating if bid has an attached estimate';
