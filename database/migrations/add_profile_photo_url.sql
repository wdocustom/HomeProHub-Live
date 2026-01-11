-- Add profile_photo_url column for contractor profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

COMMENT ON COLUMN user_profiles.profile_photo_url IS 'URL to contractor profile photo';
