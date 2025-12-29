-- Add missing grade/score columns to user_profiles
-- These are required for review submission and contractor grading to work

-- Homeowner columns
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS homeowner_grade TEXT DEFAULT 'B';

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS homeowner_score NUMERIC DEFAULT 75.0;

-- Contractor columns
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS contractor_score NUMERIC DEFAULT 80.0;

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_homeowner_grade ON user_profiles(homeowner_grade);
CREATE INDEX IF NOT EXISTS idx_user_profiles_homeowner_score ON user_profiles(homeowner_score);
CREATE INDEX IF NOT EXISTS idx_user_profiles_contractor_score ON user_profiles(contractor_score);

-- Grant permissions
GRANT SELECT, UPDATE ON user_profiles TO authenticated;

-- Verify columns exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles'
    AND column_name = 'homeowner_grade'
  ) THEN
    RAISE NOTICE '✓ homeowner_grade column created successfully';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles'
    AND column_name = 'homeowner_score'
  ) THEN
    RAISE NOTICE '✓ homeowner_score column created successfully';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles'
    AND column_name = 'contractor_score'
  ) THEN
    RAISE NOTICE '✓ contractor_score column created successfully';
  END IF;
END $$;
