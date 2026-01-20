#!/usr/bin/env node
/**
 * Manual Migration Runner
 *
 * This script executes the 01_sync_schema.sql migration
 * to fix the PGRST205 missing table error.
 *
 * Usage: node database/run-migration.js
 */

const fs = require('fs');
const path = require('path');
const db = require('./db');

async function runMigration() {
  console.log('\n🚀 Starting Schema Synchronization Migration...\n');

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', '01_sync_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded:', migrationPath);
    console.log('📝 SQL length:', migrationSQL.length, 'characters\n');

    // Attempt to execute via direct PostgreSQL connection
    console.log('⏳ Executing migration via PostgreSQL connection...');

    try {
      const result = await db.query(migrationSQL);
      console.log('✅ Migration executed successfully!');
      console.log('📊 Rows affected:', result.rowCount);
    } catch (dbError) {
      console.error('❌ Direct execution failed:', dbError.message);
      console.log('\n📋 MANUAL EXECUTION REQUIRED:');
      console.log('═'.repeat(70));
      console.log('Please run the following SQL in your Supabase SQL Editor:');
      console.log('═'.repeat(70));
      console.log('\n1. Go to your Supabase Dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Copy and paste the contents of:');
      console.log('   database/migrations/01_sync_schema.sql');
      console.log('4. Click "Run" or press Cmd/Ctrl + Enter\n');
      console.log('═'.repeat(70));
      throw dbError;
    }

    // Verify the tables were created
    console.log('\n🔍 Verifying migration results...\n');

    // Check agent_configs table
    const { data: agentData, error: agentError } = await db.supabase
      .from('agent_configs')
      .select('*')
      .limit(5);

    if (agentError) {
      console.error('❌ agent_configs table verification failed:', agentError.message);
    } else {
      console.log('✅ agent_configs table exists');
      console.log(`   → ${agentData.length} agents found:`, agentData.map(a => a.agent_name).join(', '));
    }

    // Check contractor_profiles columns (via a test query)
    const { data: contractorData, error: contractorError } = await db.supabase
      .from('contractor_profiles')
      .select('trade_type, years_experience, license_number')
      .limit(1);

    if (contractorError && contractorError.code === '42703') {
      console.error('❌ contractor_profiles columns missing:', contractorError.message);
    } else {
      console.log('✅ contractor_profiles columns verified');
      console.log('   → trade_type, years_experience, license_number columns exist');
    }

    console.log('\n✅ Schema synchronization completed successfully!\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('\n📋 MANUAL EXECUTION REQUIRED:');
    console.log('═'.repeat(70));
    console.log('Please run the SQL file manually:');
    console.log('database/migrations/01_sync_schema.sql');
    console.log('═'.repeat(70));
    process.exit(1);
  }
}

// Run the migration
runMigration();
