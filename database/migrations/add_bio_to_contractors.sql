-- Add bio column to user_profiles table for contractors
-- This allows contractors to add a biography/description to their profile

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add comment
COMMENT ON COLUMN user_profiles.bio IS 'Contractor biography/description shown on their profile';
