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
 * Add project template columns if they don't exist
 */
async function ensureProjectTemplateColumns() {
  try {
    console.log('🔍 Checking for project template columns...');

    const templateIdExists = await columnExists('job_postings', 'template_id');
    const metadataExists = await columnExists('job_postings', 'project_metadata');

    if (templateIdExists && metadataExists) {
      console.log('✅ Project template columns exist');
      return true;
    }

    console.log('⚠️  Project template columns missing - attempting to add...');

    // Full migration including table creation
    const migration = `
      -- Create project_templates table if it doesn't exist
      CREATE TABLE IF NOT EXISTS project_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_name TEXT NOT NULL UNIQUE,
        template_type TEXT NOT NULL,
        display_name TEXT NOT NULL,
        description TEXT,
        typical_duration_days INTEGER,
        complexity_level TEXT,
        requires_blueprints BOOLEAN DEFAULT false,
        requires_permits BOOLEAN DEFAULT true,
        requires_engineering BOOLEAN DEFAULT false,
        phases JSONB NOT NULL DEFAULT '[]'::jsonb,
        required_trades JSONB NOT NULL DEFAULT '[]'::jsonb,
        inspection_points JSONB DEFAULT '[]'::jsonb,
        critical_dependencies JSONB DEFAULT '{}'::jsonb,
        deliverables JSONB DEFAULT '[]'::jsonb,
        applicable_codes JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Add columns to job_postings
      ALTER TABLE job_postings
      ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES project_templates(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS blueprints_url TEXT,
      ADD COLUMN IF NOT EXISTS blueprint_pages JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS project_metadata JSONB DEFAULT '{}'::jsonb;

      -- Create index
      CREATE INDEX IF NOT EXISTS idx_job_postings_template ON job_postings(template_id);
    `;

    // Attempt to execute via RPC (requires a custom SQL executor function in Supabase)
    const { error } = await db.supabase.rpc('exec_sql', { sql_query: migration });

    if (error) {
      console.log('📝 MANUAL MIGRATION REQUIRED:');
      console.log('─'.repeat(60));
      console.log('Please run this SQL in your Supabase SQL Editor:');
      console.log(migration);
      console.log('─'.repeat(60));
      console.log('\n💡 This is needed for Job Board → AI Project deep link workflow');
      console.log('💡 After running the SQL, restart the server or redeploy');
      return false;
    }

    console.log('✅ Project template columns added successfully');
    return true;

  } catch (error) {
    console.error('❌ Error checking/adding project template columns:', error.message);
    return false;
  }
}

/**
 * Ensure agent_configs table exists and is seeded
 */
async function ensureAgentConfigsTable() {
  try {
    console.log('🔍 Checking for agent_configs table...');

    // Try to query the table
    const { data, error } = await db.supabase
      .from('agent_configs')
      .select('id')
      .limit(1);

    if (!error) {
      console.log('✅ agent_configs table exists');
      return true;
    }

    console.log('⚠️  agent_configs table missing - attempting to create...');

    // Migration SQL to create agent_configs table
    const migration = `
      -- Create Agent Configs Table
      CREATE TABLE IF NOT EXISTS agent_configs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          agent_name TEXT NOT NULL UNIQUE,
          role TEXT NOT NULL,
          status TEXT DEFAULT 'active',
          model TEXT DEFAULT 'gpt-4-turbo',
          temperature NUMERIC DEFAULT 0.7,
          system_prompt TEXT,
          last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Seed Default Agents
      INSERT INTO agent_configs (agent_name, role, status, system_prompt)
      VALUES
          ('Orchestrator', 'Project Manager', 'active', 'You are the Orchestrator. You manage the project timeline and coordinate other agents.'),
          ('Hawk', 'Lead Scout', 'active', 'You are the Hawk. You find contractors and suppliers.'),
          ('Diplomat', 'Communicator', 'active', 'You are the Diplomat. You handle client and contractor communication.')
      ON CONFLICT (agent_name) DO NOTHING;
    `;

    // Attempt to execute via RPC
    const { error: rpcError } = await db.supabase.rpc('exec_sql', { sql_query: migration });

    if (rpcError) {
      console.log('📝 MANUAL MIGRATION REQUIRED:');
      console.log('─'.repeat(60));
      console.log('Please run this SQL in your Supabase SQL Editor:');
      console.log(migration);
      console.log('─'.repeat(60));
      console.log('\n💡 Or run: database/migrations/01_sync_schema.sql');
      return false;
    }

    console.log('✅ agent_configs table created successfully');
    return true;

  } catch (error) {
    console.error('❌ Error checking/creating agent_configs table:', error.message);
    return false;
  }
}

/**
 * Ensure contractor_profiles has required columns
 */
async function ensureContractorProfilesColumns() {
  try {
    console.log('🔍 Checking for contractor_profiles columns...');

    const tradeTypeExists = await columnExists('contractor_profiles', 'trade_type');
    const yearsExperienceExists = await columnExists('contractor_profiles', 'years_experience');
    const licenseNumberExists = await columnExists('contractor_profiles', 'license_number');

    if (tradeTypeExists && yearsExperienceExists && licenseNumberExists) {
      console.log('✅ contractor_profiles columns exist');
      return true;
    }

    console.log('⚠️  contractor_profiles columns missing - attempting to add...');

    const migration = `
      ALTER TABLE contractor_profiles ADD COLUMN IF NOT EXISTS trade_type TEXT DEFAULT 'General Contractor';
      ALTER TABLE contractor_profiles ADD COLUMN IF NOT EXISTS years_experience INTEGER DEFAULT 1;
      ALTER TABLE contractor_profiles ADD COLUMN IF NOT EXISTS license_number TEXT;
    `;

    // Attempt to execute via RPC
    const { error } = await db.supabase.rpc('exec_sql', { sql_query: migration });

    if (error) {
      console.log('📝 MANUAL MIGRATION REQUIRED:');
      console.log('─'.repeat(60));
      console.log('Please run this SQL in your Supabase SQL Editor:');
      console.log(migration);
      console.log('─'.repeat(60));
      console.log('\n💡 Or run: database/migrations/01_sync_schema.sql');
      return false;
    }

    console.log('✅ contractor_profiles columns added successfully');
    return true;

  } catch (error) {
    console.error('❌ Error checking/adding contractor_profiles columns:', error.message);
    return false;
  }
}

/**
 * Run all auto-migrations
 */
async function runAutoMigrations() {
  console.log('\n🔧 Running auto-migrations...');

  const results = {
    profilePhotoUrl: await ensureProfilePhotoUrlColumn(),
    projectTemplateColumns: await ensureProjectTemplateColumns(),
    agentConfigsTable: await ensureAgentConfigsTable(),
    contractorProfilesColumns: await ensureContractorProfilesColumns()
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
  ensureProjectTemplateColumns,
  ensureAgentConfigsTable,
  ensureContractorProfilesColumns,
  columnExists
};
