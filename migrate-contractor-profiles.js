#!/usr/bin/env node
/**
 * CRITICAL MIGRATION: Create contractor_profiles table
 *
 * This migration creates the missing contractor_profiles table
 * that is required for:
 * - Review link generation
 * - Contractor directory
 * - Profile management
 */

require('dotenv').config();
const { Client } = require('pg');

const sql = `
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
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'contractor_profiles'
    AND policyname = 'Public profiles are viewable by everyone'
  ) THEN
    CREATE POLICY "Public profiles are viewable by everyone"
    ON public.contractor_profiles
    FOR SELECT
    USING (true);
  END IF;
END $$;

-- Policy: Contractors can UPDATE their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'contractor_profiles'
    AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
    ON public.contractor_profiles
    FOR UPDATE
    USING (auth.uid() = id);
  END IF;
END $$;

-- Policy: Contractors can INSERT their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'contractor_profiles'
    AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile"
    ON public.contractor_profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);
  END IF;
END $$;

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
`;

async function runMigration() {
  // Get the database connection string from environment
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

  if (!connectionString) {
    console.error('❌ ERROR: No database connection string found!');
    console.error('Set DATABASE_URL or SUPABASE_DB_URL in your .env file');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false // Supabase requires SSL
    }
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    console.log('\n📋 Running migration...');
    await client.query(sql);
    console.log('✅ Migration completed successfully!');

    console.log('\n🔍 Verifying table creation...');
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'contractor_profiles'
      ORDER BY ordinal_position;
    `);

    console.log(`✅ Table created with ${result.rows.length} columns:`);
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`);
    });

    console.log('\n🔒 Verifying RLS policies...');
    const policies = await client.query(`
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename = 'contractor_profiles';
    `);

    console.log(`✅ ${policies.rows.length} RLS policies created:`);
    policies.rows.forEach(row => {
      console.log(`   - ${row.policyname}`);
    });

    console.log('\n👥 Checking synced profiles...');
    const profileCount = await client.query(`
      SELECT COUNT(*) as count
      FROM public.contractor_profiles;
    `);
    console.log(`✅ ${profileCount.rows[0].count} contractor profiles synced`);

    console.log('\n🎉 MIGRATION COMPLETE! The contractor_profiles table is ready.');
    console.log('   - Review links will now work');
    console.log('   - Contractor directory can load');
    console.log('   - Profile pages can save data');

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:');
    console.error(error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the migration
runMigration();
