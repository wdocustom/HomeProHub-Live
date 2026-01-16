-- Add business_start_date column to user_profiles table
-- This stores the actual start date of the contractor's business
-- The years_in_business field will be calculated from this date

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS business_start_date DATE;

-- Add comment
COMMENT ON COLUMN user_profiles.business_start_date IS 'The month/year when the contractor started their business (used to calculate years_in_business)';

-- Create index for potential date-based queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_business_start_date ON user_profiles(business_start_date) WHERE business_start_date IS NOT NULL;
