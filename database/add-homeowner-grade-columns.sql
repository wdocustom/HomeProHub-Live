-- Add missing homeowner grade columns to user_profiles
-- These are required for review submission to work

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS homeowner_grade TEXT DEFAULT 'B';

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS homeowner_score NUMERIC DEFAULT 75.0;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_homeowner_grade ON user_profiles(homeowner_grade);

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
    RAISE NOTICE 'homeowner_grade column created successfully';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles'
    AND column_name = 'homeowner_score'
  ) THEN
    RAISE NOTICE 'homeowner_score column created successfully';
  END IF;
END $$;
