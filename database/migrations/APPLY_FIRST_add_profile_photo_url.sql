-- CRITICAL MIGRATION: Add profile_photo_url column
-- This migration fixes the contractor grade calculation error
--
-- ERROR FIXED: column "profile_photo_url" does not exist
--
-- APPLY THIS FIRST if you're experiencing grade calculation errors
--
-- To apply this migration:
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Create a new query
-- 4. Paste this entire file
-- 5. Click "Run" or press Cmd/Ctrl + Enter
--
-- This migration is IDEMPOTENT - it's safe to run multiple times

-- Add profile_photo_url column for contractor profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.profile_photo_url IS 'URL to contractor profile photo (used in grade calculation)';

-- Verify the column was added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_profiles'
    AND column_name = 'profile_photo_url'
  ) THEN
    RAISE NOTICE '✅ Migration successful: profile_photo_url column added';
  ELSE
    RAISE EXCEPTION '❌ Migration failed: profile_photo_url column not found';
  END IF;
END $$;
