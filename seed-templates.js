/**
 * Seed Project Templates Script
 * Seeds the project_templates table with sample templates
 */

const { supabase } = require('./database/db');
const fs = require('fs');

async function seedTemplates() {
  console.log('🌱 Starting template seeding...\n');

  try {
    // Read SQL file
    const sql = fs.readFileSync('./database/migrations/seed_project_templates.sql', 'utf8');

    // Execute SQL using Supabase RPC or raw query
    // Since Supabase doesn't support multi-statement SQL directly,
    // we'll parse and execute individual INSERT statements

    const insertStatements = sql.split(/INSERT INTO project_templates/i).slice(1);

    console.log(`Found ${insertStatements.length} template definitions\n`);

    for (let i = 0; i < insertStatements.length; i++) {
      const statement = 'INSERT INTO project_templates' + insertStatements[i].split(';')[0] + ';';

      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });

        if (error) {
          console.error(`❌ Error inserting template ${i + 1}:`, error.message);
        } else {
          console.log(`✅ Template ${i + 1} inserted successfully`);
        }
      } catch (err) {
        console.error(`❌ Error executing statement ${i + 1}:`, err.message);
      }
    }

    // Verify templates were inserted
    const { data, error, count } = await supabase
      .from('project_templates')
      .select('template_name, display_name', { count: 'exact' });

    if (error) {
      console.error('\n❌ Error verifying templates:', error);
    } else {
      console.log(`\n✅ Seeding complete! Total templates in database: ${count || data.length}`);
      console.log('\nTemplates:');
      data.forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.display_name} (${t.template_name})`);
      });
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run seeding
seedTemplates();
