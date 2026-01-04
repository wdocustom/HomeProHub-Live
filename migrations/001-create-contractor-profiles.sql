-- ================================================================
-- CRITICAL MIGRATION: Create contractor_profiles Table
-- ================================================================
-- This migration creates the missing contractor_profiles table
-- that is required for:
--   - Review link generation (fixes 500 error)
--   - Contractor directory loading
--   - Profile data persistence
--
-- HOW TO RUN:
--   1. Go to your Supabase Dashboard
--   2. Click "SQL Editor" in the sidebar
--   3. Click "New Query"
--   4. Copy and paste this entire file
--   5. Click "Run" or press Cmd/Ctrl + Enter
-- ================================================================

-- 1. Create the Missing Table
CREATE TABLE IF NOT EXISTS public.contractor_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY, -- Links to Login
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Security (RLS)
ALTER TABLE public.contractor_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can READ profiles (Directory)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.contractor_profiles;
CREATE POLICY "Public profiles are viewable by everyone"
ON public.contractor_profiles
FOR SELECT
USING (true);

-- Policy: Contractors can UPDATE their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.contractor_profiles;
CREATE POLICY "Users can update own profile"
ON public.contractor_profiles
FOR UPDATE
USING (auth.uid() = id);

-- Policy: Contractors can INSERT their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.contractor_profiles;
CREATE POLICY "Users can insert own profile"
ON public.contractor_profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- 3. SYNC & FIX (Critical)
-- Create profiles for existing users who are contractors but have no profile
INSERT INTO public.contractor_profiles (id, email, review_link_slug)
SELECT
  id,
  email,
  -- Auto-generate the missing slug so links work immediately
  lower(split_part(email, '@', 1)) || '-' || substr(md5(random()::text), 1, 4)
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.contractor_profiles)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- VERIFICATION QUERIES (Run these after to confirm success)
-- ================================================================

-- Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'contractor_profiles'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'contractor_profiles';

-- Check synced profiles count
SELECT COUNT(*) as profile_count
FROM public.contractor_profiles;
