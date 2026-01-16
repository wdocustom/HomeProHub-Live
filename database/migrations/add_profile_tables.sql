-- Migration: Add Profile Tables
-- Created: 2026-01-02
-- Purpose: Create contractor_profiles and home_profiles tables for user profile management

-- ========================================
-- 1. Contractor Profiles Table
-- ========================================
CREATE TABLE IF NOT EXISTS contractor_profiles (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  company_name TEXT,
  display_name TEXT,
  phone TEXT,
  website TEXT,
  bio TEXT,
  trades TEXT[], -- Array of strings e.g. ['Plumbing', 'Electrical']
  service_area_zipcodes TEXT[],
  avatar_url TEXT,
  gallery_urls TEXT[],
  license_verified BOOLEAN DEFAULT FALSE,
  insurance_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies for contractor_profiles
ALTER TABLE contractor_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Contractors can read their own profile
CREATE POLICY "Contractors can view own profile"
  ON contractor_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Contractors can update their own profile
CREATE POLICY "Contractors can update own profile"
  ON contractor_profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Contractors can insert their own profile
CREATE POLICY "Contractors can insert own profile"
  ON contractor_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Anyone can view contractor profiles (for public browsing)
CREATE POLICY "Anyone can view contractor profiles"
  ON contractor_profiles
  FOR SELECT
  USING (true);

-- ========================================
-- 2. Home Profiles Table
-- ========================================
CREATE TABLE IF NOT EXISTS home_profiles (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  address_line1 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  year_built INT,
  sqft INT,
  lot_sqft INT,
  beds INT,
  baths NUMERIC,
  last_sale_date DATE,
  property_type TEXT, -- 'Single Family', 'Condo', 'Townhouse', etc.
  data_source TEXT, -- 'User' or 'PublicRecord'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies for home_profiles
ALTER TABLE home_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Homeowners can read their own home profile
CREATE POLICY "Homeowners can view own home profile"
  ON home_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Homeowners can update their own home profile
CREATE POLICY "Homeowners can update own home profile"
  ON home_profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Homeowners can insert their own home profile
CREATE POLICY "Homeowners can insert own home profile"
  ON home_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ========================================
-- 3. Updated_at Triggers
-- ========================================

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for contractor_profiles
CREATE TRIGGER update_contractor_profiles_updated_at
  BEFORE UPDATE ON contractor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for home_profiles
CREATE TRIGGER update_home_profiles_updated_at
  BEFORE UPDATE ON home_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 4. Indexes for Performance
-- ========================================

-- Index on contractor trades for filtering
CREATE INDEX IF NOT EXISTS idx_contractor_trades ON contractor_profiles USING GIN(trades);

-- Index on service area zipcodes for location-based searches
CREATE INDEX IF NOT EXISTS idx_service_area_zipcodes ON contractor_profiles USING GIN(service_area_zipcodes);

-- Index on home zip_code for location-based queries
CREATE INDEX IF NOT EXISTS idx_home_zip_code ON home_profiles(zip_code);

-- Index on verification status for filtering
CREATE INDEX IF NOT EXISTS idx_license_verified ON contractor_profiles(license_verified);
CREATE INDEX IF NOT EXISTS idx_insurance_verified ON contractor_profiles(insurance_verified);
