-- ================================================================
-- FIX MIGRATION: Correct contractor_profiles Column Name
-- ================================================================
-- The previous migration used 'id' but server.js expects 'user_id'
-- This migration:
--   1. Drops the incorrectly created table
--   2. Recreates with correct 'user_id' column name
--   3. Re-syncs all 13 contractor profiles
-- ================================================================

-- 1. Drop the incorrect table
DROP TABLE IF EXISTS public.contractor_profiles CASCADE;

-- 2. Create the table with CORRECT column name (user_id, not id)
CREATE TABLE public.contractor_profiles (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY, -- FIXED: was 'id', now 'user_id'
  company_name TEXT,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  bio TEXT,
  website TEXT,

  -- Professional Data
  trades TEXT[], -- e.g. ['Plumber', 'HVAC']
  service_area_zips TEXT[],
  license_number TEXT,
  insurance_provider TEXT,

  -- Media
  avatar_url TEXT,
  gallery_urls TEXT[],

  -- Reputation System (The Missing Link)
  review_link_slug TEXT UNIQUE, -- This fixes the 500 Error
  grade TEXT DEFAULT 'B', -- The HomeProHub Grade
  rating NUMERIC DEFAULT 0,
  reviews_count INT DEFAULT 0,

  -- Verification Flags
  is_verified BOOLEAN DEFAULT FALSE,
  license_verified BOOLEAN DEFAULT FALSE,
  insurance_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable Security (RLS)
ALTER TABLE public.contractor_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can READ profiles (Directory)
CREATE POLICY "Public profiles are viewable by everyone"
ON public.contractor_profiles
FOR SELECT
USING (true);

-- Policy: Contractors can UPDATE their own profile
CREATE POLICY "Users can update own profile"
ON public.contractor_profiles
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Contractors can INSERT their own profile
CREATE POLICY "Users can insert own profile"
ON public.contractor_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 4. SYNC & FIX (Critical)
-- Create profiles for existing users who are contractors
INSERT INTO public.contractor_profiles (user_id, email, review_link_slug)
SELECT
  id,
  email,
  -- Auto-generate the missing slug so links work immediately
  lower(split_part(email, '@', 1)) || '-' || substr(md5(random()::text), 1, 4)
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contractor_trades ON contractor_profiles USING GIN(trades);
CREATE INDEX IF NOT EXISTS idx_service_area_zips ON contractor_profiles USING GIN(service_area_zips);
CREATE INDEX IF NOT EXISTS idx_review_link_slug ON contractor_profiles(review_link_slug);
CREATE INDEX IF NOT EXISTS idx_license_verified ON contractor_profiles(license_verified);
CREATE INDEX IF NOT EXISTS idx_insurance_verified ON contractor_profiles(insurance_verified);

-- 6. Create updated_at trigger
CREATE OR REPLACE FUNCTION update_contractor_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contractor_profiles_updated_at
  BEFORE UPDATE ON contractor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_contractor_profiles_updated_at();
