-- Add license verification fields to user_profiles table
-- Run this migration in your Supabase SQL Editor

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS verification_id TEXT,
ADD COLUMN IF NOT EXISTS license_state TEXT,
ADD COLUMN IF NOT EXISTS license_number TEXT,
ADD COLUMN IF NOT EXISTS license_type TEXT,
ADD COLUMN IF NOT EXISTS license_expiration DATE,
ADD COLUMN IF NOT EXISTS license_verified TEXT DEFAULT 'unverified' CHECK (license_verified IN ('unverified', 'pending', 'verified', 'rejected')),
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS insurance_provider TEXT,
ADD COLUMN IF NOT EXISTS insurance_policy_number TEXT,
ADD COLUMN IF NOT EXISTS insurance_expiration DATE,
ADD COLUMN IF NOT EXISTS insurance_coverage NUMERIC;

-- Create index on verification_id for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_verification_id ON user_profiles(verification_id);

-- Create index on license_verified status
CREATE INDEX IF NOT EXISTS idx_user_profiles_license_verified ON user_profiles(license_verified);

-- Add comment to table
COMMENT ON COLUMN user_profiles.verification_id IS 'Unique ID for license verification tracking (format: lic_{timestamp}_{random})';
COMMENT ON COLUMN user_profiles.license_verified IS 'License verification status: unverified, pending, verified, or rejected';
COMMENT ON COLUMN user_profiles.verified_at IS 'Timestamp when license was verified/rejected by admin';
