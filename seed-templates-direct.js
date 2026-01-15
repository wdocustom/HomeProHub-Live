/**
 * Seed Project Templates Script
 * Inserts project templates directly using Supabase client
 */

const { supabase } = require('./database/db');

// Template data extracted from seed_project_templates.sql
const templates = [
  {
    template_name: 'new_custom_home_2500sqft',
    template_type: 'new_construction',
    display_name: 'New Custom Home (2500 sqft)',
    description: 'Ground-up construction of a single-family custom home with full architectural plans and engineering',
    typical_duration_days: 270,
    complexity_level: 'very_complex',
    requires_blueprints: true,
    requires_permits: true,
    requires_engineering: true,
    phases: [
      {
        phase_id: 'pre_construction',
        phase_name: 'Pre-Construction & Permits',
        order: 1,
        estimated_days: 30,
        critical_path: true,
        requires_inspection: false,
        dependencies: []
      },
      {
        phase_id: 'site_prep',
        phase_name: 'Site Preparation & Clearing',
        order: 2,
        estimated_days: 5,
        critical_path: true,
        requires_inspection: false,
        dependencies: ['pre_construction']
      },
      {
        phase_id: 'excavation',
        phase_name: 'Excavation',
        order: 3,
        estimated_days: 3,
        critical_path: true,
        requires_inspection: true,
        dependencies: ['site_prep']
      },
      {
        phase_id: 'foundation',
        phase_name: 'Foundation & Concrete',
        order: 4,
        estimated_days: 14,
        critical_path: true,
        requires_inspection: true,
        dependencies: ['excavation']
      },
      {
        phase_id: 'framing',
        phase_name: 'Framing',
        order: 5,
        estimated_days: 21,
        critical_path: true,
        requires_inspection: true,
        dependencies: ['foundation']
      },
      {
        phase_id: 'roofing',
        phase_name: 'Roofing',
        order: 6,
        estimated_days: 7,
        critical_path: true,
        requires_inspection: false,
        dependencies: ['framing']
      },
      {
        phase_id: 'rough_plumbing',
        phase_name: 'Rough Plumbing',
        order: 9,
        estimated_days: 7,
        critical_path: true,
        requires_inspection: true,
        dependencies: ['framing']
      },
      {
        phase_id: 'rough_electrical',
        phase_name: 'Rough Electrical',
        order: 10,
        estimated_days: 7,
        critical_path: true,
        requires_inspection: true,
        dependencies: ['framing']
      },
      {
        phase_id: 'insulation',
        phase_name: 'Insulation',
        order: 12,
        estimated_days: 5,
        critical_path: true,
        requires_inspection: true,
        dependencies: ['rough_plumbing', 'rough_electrical']
      },
      {
        phase_id: 'drywall',
        phase_name: 'Drywall',
        order: 13,
        estimated_days: 14,
        critical_path: true,
        requires_inspection: false,
        dependencies: ['insulation']
      },
      {
        phase_id: 'final_inspection',
        phase_name: 'Final Inspection & Certificate of Occupancy',
        order: 25,
        estimated_days: 5,
        critical_path: true,
        requires_inspection: true,
        dependencies: []
      }
    ],
    required_trades: ['architect', 'engineer', 'excavation', 'concrete', 'framing', 'roofing', 'plumbing', 'electrical', 'hvac', 'insulation', 'drywall', 'carpentry', 'painting'],
    inspection_points: [
      { phase: 'excavation', type: 'excavation', required: true },
      { phase: 'foundation', type: 'foundation', required: true },
      { phase: 'framing', type: 'framing', required: true },
      { phase: 'rough_electrical', type: 'electrical', required: true },
      { phase: 'final_inspection', type: 'final', required: true }
    ],
    critical_dependencies: {
      foundation: ['excavation'],
      framing: ['foundation'],
      insulation: ['rough_plumbing', 'rough_electrical'],
      drywall: ['insulation']
    },
    deliverables: ['architectural_plans', 'building_permit', 'certificate_of_occupancy'],
    applicable_codes: ['IRC', 'IBC', 'NEC', 'IPC', 'IMC']
  },
  {
    template_name: 'kitchen_remodel_high_end',
    template_type: 'remodel',
    display_name: 'Kitchen Remodel (High-End)',
    description: 'Complete kitchen renovation including cabinets, countertops, appliances, flooring, and lighting',
    typical_duration_days: 42,
    complexity_level: 'moderate',
    requires_blueprints: false,
    requires_permits: true,
    requires_engineering: false,
    phases: [
      {
        phase_id: 'planning',
        phase_name: 'Design & Planning',
        order: 1,
        estimated_days: 7,
        critical_path: true,
        requires_inspection: false,
        dependencies: []
      },
      {
        phase_id: 'demo',
        phase_name: 'Demolition',
        order: 2,
        estimated_days: 3,
        critical_path: true,
        requires_inspection: false,
        dependencies: ['planning']
      },
      {
        phase_id: 'rough_plumbing',
        phase_name: 'Plumbing Rough-In',
        order: 3,
        estimated_days: 3,
        critical_path: true,
        requires_inspection: true,
        dependencies: ['demo']
      },
      {
        phase_id: 'rough_electrical',
        phase_name: 'Electrical Rough-In',
        order: 4,
        estimated_days: 3,
        critical_path: true,
        requires_inspection: true,
        dependencies: ['demo']
      },
      {
        phase_id: 'drywall',
        phase_name: 'Drywall Repair & Patching',
        order: 5,
        estimated_days: 5,
        critical_path: true,
        requires_inspection: false,
        dependencies: ['rough_plumbing', 'rough_electrical']
      },
      {
        phase_id: 'cabinets',
        phase_name: 'Cabinet Installation',
        order: 7,
        estimated_days: 5,
        critical_path: true,
        requires_inspection: false,
        dependencies: ['drywall']
      },
      {
        phase_id: 'countertops',
        phase_name: 'Countertop Installation',
        order: 8,
        estimated_days: 2,
        critical_path: true,
        requires_inspection: false,
        dependencies: ['cabinets']
      }
    ],
    required_trades: ['general_contractor', 'plumbing', 'electrical', 'drywall', 'cabinets', 'countertops', 'tile', 'painting'],
    inspection_points: [
      { phase: 'rough_plumbing', type: 'plumbing', required: true },
      { phase: 'rough_electrical', type: 'electrical', required: true }
    ],
    critical_dependencies: {
      rough_plumbing: ['demo'],
      rough_electrical: ['demo'],
      drywall: ['rough_plumbing', 'rough_electrical'],
      cabinets: ['drywall'],
      countertops: ['cabinets']
    },
    deliverables: ['design_plans', 'material_selections', 'plumbing_permit', 'electrical_permit'],
    applicable_codes: ['NEC', 'IPC', 'IRC']
  },
  {
    template_name: 'bathroom_remodel_full',
    template_type: 'remodel',
    display_name: 'Full Bathroom Remodel',
    description: 'Complete bathroom renovation with new fixtures, tile, vanity, and lighting',
    typical_duration_days: 28,
    complexity_level: 'moderate',
    requires_blueprints: false,
    requires_permits: true,
    requires_engineering: false,
    phases: [
      {
        phase_id: 'planning',
        phase_name: 'Design & Material Selection',
        order: 1,
        estimated_days: 5,
        critical_path: true,
        requires_inspection: false,
        dependencies: []
      },
      {
        phase_id: 'demo',
        phase_name: 'Demolition',
        order: 2,
        estimated_days: 2,
        critical_path: true,
        requires_inspection: false,
        dependencies: ['planning']
      },
      {
        phase_id: 'rough_plumbing',
        phase_name: 'Plumbing Rough-In',
        order: 3,
        estimated_days: 3,
        critical_path: true,
        requires_inspection: true,
        dependencies: ['demo']
      },
      {
        phase_id: 'tile',
        phase_name: 'Tile Work (Floor & Shower)',
        order: 7,
        estimated_days: 5,
        critical_path: true,
        requires_inspection: false,
        dependencies: []
      }
    ],
    required_trades: ['general_contractor', 'plumbing', 'electrical', 'drywall', 'tile', 'painting'],
    inspection_points: [
      { phase: 'rough_plumbing', type: 'plumbing', required: true }
    ],
    critical_dependencies: {
      rough_plumbing: ['demo']
    },
    deliverables: ['design_plans', 'material_selections', 'plumbing_permit'],
    applicable_codes: ['NEC', 'IPC', 'IRC']
  }
];

async function seedTemplates() {
  console.log('🌱 Starting template seeding...\n');

  try {
    // Check if templates already exist
    const { data: existing, error: checkError } = await supabase
      .from('project_templates')
      .select('template_name');

    if (checkError) {
      console.error('❌ Error checking existing templates:', checkError);
      process.exit(1);
    }

    const existingNames = existing.map(t => t.template_name);
    console.log(`Found ${existingNames.length} existing templates in database\n`);

    // Insert each template
    for (const template of templates) {
      if (existingNames.includes(template.template_name)) {
        console.log(`⏭️  Skipping "${template.display_name}" (already exists)`);
        continue;
      }

      const { data, error } = await supabase
        .from('project_templates')
        .insert(template)
        .select();

      if (error) {
        console.error(`❌ Error inserting "${template.display_name}":`, error.message);
      } else {
        console.log(`✅ Inserted "${template.display_name}"`);
      }
    }

    // Verify final count
    const { data: final, error: finalError, count } = await supabase
      .from('project_templates')
      .select('id, template_name, display_name', { count: 'exact' });

    if (finalError) {
      console.error('\n❌ Error verifying final count:', finalError);
    } else {
      console.log(`\n✅ Seeding complete! Total templates in database: ${count || final.length}`);
      console.log('\nAll Templates:');
      final.forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.display_name} (ID: ${t.id})`);
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
