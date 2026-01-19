#!/usr/bin/env node
/**
 * CRITICAL MIGRATION: Apply project template engine migration
 *
 * This migration adds the missing template_id and project_metadata columns
 * to the job_postings table, which are required for the Job Board → AI Project
 * deep link workflow.
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

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

    // Read the migration SQL file
    console.log('\n📖 Reading migration file...');
    const migrationPath = path.join(__dirname, 'database', 'migrations', 'add_project_template_engine.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration file loaded');

    console.log('\n📋 Running migration...');
    await client.query(sql);
    console.log('✅ Migration completed successfully!');

    // Verify the columns were added to job_postings
    console.log('\n🔍 Verifying job_postings columns...');
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'job_postings'
      AND column_name IN ('template_id', 'project_metadata', 'blueprints_url', 'blueprint_pages')
      ORDER BY column_name;
    `);

    if (result.rows.length > 0) {
      console.log(`✅ Found ${result.rows.length} new columns in job_postings:`);
      result.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.warn('⚠️  Warning: Expected columns not found');
    }

    // Check if project_templates table was created
    console.log('\n🔍 Verifying project_templates table...');
    const templatesCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'project_templates'
      );
    `);

    if (templatesCheck.rows[0].exists) {
      const templateCount = await client.query(`SELECT COUNT(*) as count FROM project_templates;`);
      console.log(`✅ project_templates table exists with ${templateCount.rows[0].count} templates`);
    } else {
      console.warn('⚠️  Warning: project_templates table not found');
    }

    // Check if template_milestones table was created
    console.log('\n🔍 Verifying template_milestones table...');
    const milestonesCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'template_milestones'
      );
    `);

    if (milestonesCheck.rows[0].exists) {
      const milestoneCount = await client.query(`SELECT COUNT(*) as count FROM template_milestones;`);
      console.log(`✅ template_milestones table exists with ${milestoneCount.rows[0].count} milestones`);
    } else {
      console.warn('⚠️  Warning: template_milestones table not found');
    }

    console.log('\n🎉 MIGRATION COMPLETE! Project Template Engine is ready.');
    console.log('   ✓ job_postings.template_id column added');
    console.log('   ✓ job_postings.project_metadata column added');
    console.log('   ✓ Job Board → AI Project deep link will now work');

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:');
    console.error(error.message);

    // Check if it's a specific error we can provide guidance on
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.error('\n💡 This might be a dependency issue. Some tables may need to be created first.');
    }

    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the migration
runMigration();
