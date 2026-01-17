#!/usr/bin/env node
/**
 * MIGRATION: Add profile_photo_url column to user_profiles
 *
 * This migration adds the missing profile_photo_url column
 * that is required for the contractor grade calculation function
 */

require('dotenv').config();
const db = require('./database/db');

const migration = `
-- Add profile_photo_url column for contractor profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

COMMENT ON COLUMN user_profiles.profile_photo_url IS 'URL to contractor profile photo';
`;

async function runMigration() {
  try {
    console.log('📋 Running migration to add profile_photo_url column...');

    // Execute the migration using Supabase's raw SQL execution
    const { data, error } = await db.supabase.rpc('exec_sql', {
      sql_query: migration
    });

    if (error) {
      // If exec_sql function doesn't exist, we'll use the UI or manual approach
      console.log('⚠️  Direct SQL execution not available via RPC');
      console.log('📝 Migration SQL to run manually:');
      console.log('─'.repeat(60));
      console.log(migration);
      console.log('─'.repeat(60));
      console.log('\nPlease run this SQL in your Supabase SQL Editor:');
      console.log('1. Go to your Supabase dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Copy and paste the above SQL');
      console.log('4. Click "Run"');
      return;
    }

    console.log('✅ Migration completed successfully!');

    console.log('\n🔍 Verifying column creation...');
    const { data: columns, error: checkError } = await db.supabase
      .from('user_profiles')
      .select('profile_photo_url')
      .limit(1);

    if (!checkError) {
      console.log('✅ Column verified - profile_photo_url is now available');
    }

    console.log('\n🎉 MIGRATION COMPLETE!');
    console.log('   - Contractor grade calculation will now work');
    console.log('   - Profile completeness scoring includes photo');

  } catch (error) {
    console.error('\n❌ MIGRATION ERROR:');
    console.error(error.message);

    console.log('\n📝 Manual Migration SQL:');
    console.log('─'.repeat(60));
    console.log(migration);
    console.log('─'.repeat(60));
    console.log('\nRun this SQL in your Supabase SQL Editor to complete the migration.');
  }

  process.exit(0);
}

// Run the migration
runMigration();
