/**
 * Auto-Migration System
 *
 * This module automatically applies critical schema fixes on server startup
 * to ensure the database schema matches the application's expectations.
 */

const db = require('./db');

/**
 * Check if a column exists in a table
 */
async function columnExists(tableName, columnName) {
  try {
    const { data, error } = await db.supabase
      .from(tableName)
      .select(columnName)
      .limit(1);

    // If no error, column exists
    return !error || error.code !== '42703'; // 42703 = column does not exist
  } catch (err) {
    return false;
  }
}

/**
 * Add profile_photo_url column if it doesn't exist
 */
async function ensureProfilePhotoUrlColumn() {
  try {
    console.log('🔍 Checking for profile_photo_url column...');

    const exists = await columnExists('user_profiles', 'profile_photo_url');

    if (exists) {
      console.log('✅ profile_photo_url column exists');
      return true;
    }

    console.log('⚠️  profile_photo_url column missing - attempting to add...');

    // Try to use Supabase's query method if available
    const migration = `
      ALTER TABLE user_profiles
      ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
    `;

    // Attempt to execute via RPC (requires a custom SQL executor function in Supabase)
    const { error } = await db.supabase.rpc('exec_sql', { sql_query: migration });

    if (error) {
      console.log('📝 MANUAL MIGRATION REQUIRED:');
      console.log('─'.repeat(60));
      console.log('Please run this SQL in your Supabase SQL Editor:');
      console.log(migration);
      console.log('─'.repeat(60));
      return false;
    }

    console.log('✅ profile_photo_url column added successfully');
    return true;

  } catch (error) {
    console.error('❌ Error checking/adding profile_photo_url column:', error.message);
    return false;
  }
}

/**
 * Run all auto-migrations
 */
async function runAutoMigrations() {
  console.log('\n🔧 Running auto-migrations...');

  const results = {
    profilePhotoUrl: await ensureProfilePhotoUrlColumn()
  };

  const allPassed = Object.values(results).every(r => r === true);

  if (allPassed) {
    console.log('✅ All auto-migrations completed successfully\n');
  } else {
    console.log('⚠️  Some migrations require manual intervention\n');
  }

  return results;
}

module.exports = {
  runAutoMigrations,
  ensureProfilePhotoUrlColumn,
  columnExists
};
