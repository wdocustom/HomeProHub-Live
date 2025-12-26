-- ========================================
-- Migration: Add contractor_licenses table
-- Date: 2025-12-26
-- Purpose: Enable license verification and trust system
-- ========================================

-- Create contractor_licenses table
CREATE TABLE IF NOT EXISTS contractor_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contractor identification
  contractor_email TEXT NOT NULL,
  contractor_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- License details
  trade_type TEXT NOT NULL CHECK (trade_type IN (
    'general_contractor', 'plumbing', 'electrical', 'hvac',
    'roofing', 'painting', 'landscaping', 'flooring', 'carpentry',
    'masonry', 'concrete', 'drywall', 'insulation', 'siding'
  )),
  license_number TEXT NOT NULL,
  state TEXT NOT NULL CHECK (length(state) = 2),

  -- Verification status
  verification_status TEXT NOT NULL CHECK (verification_status IN (
    'pending', 'verified', 'rejected', 'expired'
  )) DEFAULT 'pending',
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by TEXT,

  -- License dates
  issue_date DATE,
  expiration_date DATE,

  -- Document upload
  license_document_url TEXT,

  -- Admin notes
  rejection_reason TEXT,
  admin_notes TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for contractor licenses
CREATE INDEX IF NOT EXISTS idx_contractor_licenses_email ON contractor_licenses(contractor_email);
CREATE INDEX IF NOT EXISTS idx_contractor_licenses_contractor_id ON contractor_licenses(contractor_id);
CREATE INDEX IF NOT EXISTS idx_contractor_licenses_status ON contractor_licenses(verification_status);
CREATE INDEX IF NOT EXISTS idx_contractor_licenses_trade ON contractor_licenses(trade_type);
CREATE INDEX IF NOT EXISTS idx_contractor_licenses_state ON contractor_licenses(state);
CREATE INDEX IF NOT EXISTS idx_contractor_licenses_expiration ON contractor_licenses(expiration_date);

-- Unique constraint: one license per contractor per trade per state
CREATE UNIQUE INDEX IF NOT EXISTS idx_contractor_licenses_unique
ON contractor_licenses(contractor_email, trade_type, state);

-- Add trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_contractor_licenses_updated_at ON contractor_licenses;
CREATE TRIGGER update_contractor_licenses_updated_at
  BEFORE UPDATE ON contractor_licenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verify the changes
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'contractor_licenses'
ORDER BY ordinal_position;
