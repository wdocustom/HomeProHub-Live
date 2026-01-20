-- ========================================
-- Seed Data: Project Templates
-- Date: 2026-01-15
-- Purpose: Insert sample templates for different project types
-- ========================================

-- ========================================
-- 1. NEW CONSTRUCTION - Custom Single Family Home (2500 sqft)
-- ========================================
INSERT INTO project_templates (
  template_name,
  template_type,
  display_name,
  description,
  typical_duration_days,
  complexity_level,
  requires_blueprints,
  requires_permits,
  requires_engineering,
  phases,
  required_trades,
  inspection_points,
  critical_dependencies,
  deliverables,
  applicable_codes
) VALUES (
  'new_custom_home_2500sqft',
  'new_construction',
  'New Custom Home (2500 sqft)',
  'Ground-up construction of a single-family custom home with full architectural plans and engineering',
  270, -- 9 months
  'very_complex',
  true,
  true,
  true,
  '[
    {
      "phase_id": "pre_construction",
      "phase_name": "Pre-Construction & Permits",
      "order": 1,
      "estimated_days": 30,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": []
    },
    {
      "phase_id": "site_prep",
      "phase_name": "Site Preparation & Clearing",
      "order": 2,
      "estimated_days": 5,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["pre_construction"]
    },
    {
      "phase_id": "excavation",
      "phase_name": "Excavation",
      "order": 3,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["site_prep"]
    },
    {
      "phase_id": "foundation",
      "phase_name": "Foundation & Concrete",
      "order": 4,
      "estimated_days": 14,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["excavation"]
    },
    {
      "phase_id": "framing",
      "phase_name": "Framing",
      "order": 5,
      "estimated_days": 21,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["foundation"]
    },
    {
      "phase_id": "roofing",
      "phase_name": "Roofing",
      "order": 6,
      "estimated_days": 7,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["framing"]
    },
    {
      "phase_id": "windows_doors",
      "phase_name": "Windows & Exterior Doors",
      "order": 7,
      "estimated_days": 5,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["framing"]
    },
    {
      "phase_id": "siding",
      "phase_name": "Exterior Siding",
      "order": 8,
      "estimated_days": 10,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["windows_doors", "roofing"]
    },
    {
      "phase_id": "rough_plumbing",
      "phase_name": "Rough Plumbing",
      "order": 9,
      "estimated_days": 7,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["framing"]
    },
    {
      "phase_id": "rough_electrical",
      "phase_name": "Rough Electrical",
      "order": 10,
      "estimated_days": 7,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["framing"]
    },
    {
      "phase_id": "rough_hvac",
      "phase_name": "Rough HVAC",
      "order": 11,
      "estimated_days": 7,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["framing"]
    },
    {
      "phase_id": "insulation",
      "phase_name": "Insulation",
      "order": 12,
      "estimated_days": 5,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["rough_plumbing", "rough_electrical", "rough_hvac"]
    },
    {
      "phase_id": "drywall",
      "phase_name": "Drywall",
      "order": 13,
      "estimated_days": 14,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["insulation"]
    },
    {
      "phase_id": "interior_trim",
      "phase_name": "Interior Trim & Doors",
      "order": 14,
      "estimated_days": 10,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["drywall"]
    },
    {
      "phase_id": "cabinets",
      "phase_name": "Cabinetry Installation",
      "order": 15,
      "estimated_days": 7,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["drywall"]
    },
    {
      "phase_id": "countertops",
      "phase_name": "Countertops",
      "order": 16,
      "estimated_days": 3,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["cabinets"]
    },
    {
      "phase_id": "flooring",
      "phase_name": "Flooring",
      "order": 17,
      "estimated_days": 10,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["drywall", "interior_trim"]
    },
    {
      "phase_id": "tile",
      "phase_name": "Tile Work",
      "order": 18,
      "estimated_days": 7,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["drywall"]
    },
    {
      "phase_id": "painting",
      "phase_name": "Interior & Exterior Painting",
      "order": 19,
      "estimated_days": 10,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["interior_trim", "drywall"]
    },
    {
      "phase_id": "finish_plumbing",
      "phase_name": "Finish Plumbing (Fixtures)",
      "order": 20,
      "estimated_days": 3,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["tile", "countertops"]
    },
    {
      "phase_id": "finish_electrical",
      "phase_name": "Finish Electrical (Fixtures)",
      "order": 21,
      "estimated_days": 3,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["painting"]
    },
    {
      "phase_id": "finish_hvac",
      "phase_name": "Finish HVAC (Registers/Thermostats)",
      "order": 22,
      "estimated_days": 2,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["painting"]
    },
    {
      "phase_id": "appliances",
      "phase_name": "Appliance Installation",
      "order": 23,
      "estimated_days": 2,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["finish_electrical", "countertops"]
    },
    {
      "phase_id": "landscaping",
      "phase_name": "Landscaping & Grading",
      "order": 24,
      "estimated_days": 10,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["siding"]
    },
    {
      "phase_id": "final_inspection",
      "phase_name": "Final Inspection & Certificate of Occupancy",
      "order": 25,
      "estimated_days": 5,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["finish_plumbing", "finish_electrical", "finish_hvac", "appliances"]
    },
    {
      "phase_id": "punchlist",
      "phase_name": "Punchlist & Touch-ups",
      "order": 26,
      "estimated_days": 7,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["final_inspection"]
    }
  ]'::jsonb,
  '["architect", "engineer", "excavation", "concrete", "framing", "roofing", "siding", "windows_doors", "plumbing", "electrical", "hvac", "insulation", "drywall", "carpentry", "cabinets", "countertops", "tile", "flooring", "painting", "landscaping"]'::jsonb,
  '[
    {"phase": "excavation", "type": "excavation", "required": true},
    {"phase": "foundation", "type": "foundation", "required": true},
    {"phase": "framing", "type": "framing", "required": true},
    {"phase": "rough_plumbing", "type": "plumbing", "required": true},
    {"phase": "rough_electrical", "type": "electrical", "required": true},
    {"phase": "rough_hvac", "type": "mechanical", "required": true},
    {"phase": "insulation", "type": "insulation", "required": true},
    {"phase": "final_inspection", "type": "final", "required": true}
  ]'::jsonb,
  '{
    "foundation": ["excavation"],
    "framing": ["foundation"],
    "rough_plumbing": ["framing"],
    "rough_electrical": ["framing"],
    "rough_hvac": ["framing"],
    "insulation": ["rough_plumbing", "rough_electrical", "rough_hvac"],
    "drywall": ["insulation"],
    "final_inspection": ["finish_plumbing", "finish_electrical", "finish_hvac"]
  }'::jsonb,
  '["architectural_plans", "engineering_plans", "building_permit", "plumbing_permit", "electrical_permit", "mechanical_permit", "energy_compliance", "site_plan", "material_schedule", "gantt_schedule", "final_inspection_report", "certificate_of_occupancy", "warranty_documents"]'::jsonb,
  '["IRC", "IBC", "NEC", "IPC", "IMC", "IECC", "IEBC"]'::jsonb
)
ON CONFLICT (template_name) DO NOTHING;

-- ========================================
-- 2. ADDITION - 1000 sqft Room Addition
-- ========================================
INSERT INTO project_templates (
  template_name,
  template_type,
  display_name,
  description,
  typical_duration_days,
  complexity_level,
  requires_blueprints,
  requires_permits,
  requires_engineering,
  phases,
  required_trades,
  inspection_points,
  critical_dependencies,
  deliverables,
  applicable_codes
) VALUES (
  'room_addition_1000sqft',
  'addition',
  'Room Addition (1000 sqft)',
  'Single-story room addition including foundation, framing, and full finish work',
  120, -- 4 months
  'complex',
  true,
  true,
  false,
  '[
    {
      "phase_id": "planning",
      "phase_name": "Planning & Permits",
      "order": 1,
      "estimated_days": 21,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": []
    },
    {
      "phase_id": "demo",
      "phase_name": "Demolition & Opening Wall",
      "order": 2,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["planning"]
    },
    {
      "phase_id": "foundation",
      "phase_name": "Foundation Work",
      "order": 3,
      "estimated_days": 10,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["demo"]
    },
    {
      "phase_id": "framing",
      "phase_name": "Framing",
      "order": 4,
      "estimated_days": 14,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["foundation"]
    },
    {
      "phase_id": "roofing",
      "phase_name": "Roofing",
      "order": 5,
      "estimated_days": 5,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["framing"]
    },
    {
      "phase_id": "windows_doors",
      "phase_name": "Windows & Doors",
      "order": 6,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["framing"]
    },
    {
      "phase_id": "rough_in",
      "phase_name": "Rough-In (Plumbing, Electrical, HVAC)",
      "order": 7,
      "estimated_days": 10,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["framing", "roofing"]
    },
    {
      "phase_id": "insulation",
      "phase_name": "Insulation",
      "order": 8,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["rough_in"]
    },
    {
      "phase_id": "drywall",
      "phase_name": "Drywall",
      "order": 9,
      "estimated_days": 10,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["insulation"]
    },
    {
      "phase_id": "flooring",
      "phase_name": "Flooring",
      "order": 10,
      "estimated_days": 7,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["drywall"]
    },
    {
      "phase_id": "trim",
      "phase_name": "Interior Trim",
      "order": 11,
      "estimated_days": 5,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["drywall"]
    },
    {
      "phase_id": "painting",
      "phase_name": "Painting",
      "order": 12,
      "estimated_days": 7,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["trim", "drywall"]
    },
    {
      "phase_id": "finish",
      "phase_name": "Finish Work (Fixtures & Hardware)",
      "order": 13,
      "estimated_days": 5,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["painting"]
    },
    {
      "phase_id": "final_inspection",
      "phase_name": "Final Inspection",
      "order": 14,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["finish"]
    },
    {
      "phase_id": "punchlist",
      "phase_name": "Punchlist",
      "order": 15,
      "estimated_days": 5,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["final_inspection"]
    }
  ]'::jsonb,
  '["general_contractor", "concrete", "framing", "roofing", "windows_doors", "plumbing", "electrical", "hvac", "insulation", "drywall", "flooring", "carpentry", "painting"]'::jsonb,
  '[
    {"phase": "foundation", "type": "foundation", "required": true},
    {"phase": "framing", "type": "framing", "required": true},
    {"phase": "rough_in", "type": "rough", "required": true},
    {"phase": "insulation", "type": "insulation", "required": true},
    {"phase": "final_inspection", "type": "final", "required": true}
  ]'::jsonb,
  '{
    "foundation": ["demo"],
    "framing": ["foundation"],
    "rough_in": ["framing", "roofing"],
    "insulation": ["rough_in"],
    "drywall": ["insulation"],
    "final_inspection": ["finish"]
  }'::jsonb,
  '["architectural_plans", "building_permit", "plumbing_permit", "electrical_permit", "mechanical_permit", "site_plan", "material_list", "schedule", "final_inspection_report"]'::jsonb,
  '["IRC", "IBC", "NEC", "IPC", "IMC", "IECC"]'::jsonb
)
ON CONFLICT (template_name) DO NOTHING;

-- ========================================
-- 3. REMODEL - Kitchen Remodel (High-End)
-- ========================================
INSERT INTO project_templates (
  template_name,
  template_type,
  display_name,
  description,
  typical_duration_days,
  complexity_level,
  requires_blueprints,
  requires_permits,
  requires_engineering,
  phases,
  required_trades,
  inspection_points,
  critical_dependencies,
  deliverables,
  applicable_codes
) VALUES (
  'kitchen_remodel_high_end',
  'remodel',
  'Kitchen Remodel (High-End)',
  'Complete kitchen renovation including cabinets, countertops, appliances, flooring, and lighting',
  42, -- 6 weeks
  'moderate',
  false,
  true,
  false,
  '[
    {
      "phase_id": "planning",
      "phase_name": "Design & Planning",
      "order": 1,
      "estimated_days": 7,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": []
    },
    {
      "phase_id": "demo",
      "phase_name": "Demolition",
      "order": 2,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["planning"]
    },
    {
      "phase_id": "rough_plumbing",
      "phase_name": "Plumbing Rough-In",
      "order": 3,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["demo"]
    },
    {
      "phase_id": "rough_electrical",
      "phase_name": "Electrical Rough-In",
      "order": 4,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["demo"]
    },
    {
      "phase_id": "drywall",
      "phase_name": "Drywall Repair & Patching",
      "order": 5,
      "estimated_days": 5,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["rough_plumbing", "rough_electrical"]
    },
    {
      "phase_id": "flooring",
      "phase_name": "Flooring Installation",
      "order": 6,
      "estimated_days": 3,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["drywall"]
    },
    {
      "phase_id": "cabinets",
      "phase_name": "Cabinet Installation",
      "order": 7,
      "estimated_days": 5,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["drywall", "flooring"]
    },
    {
      "phase_id": "countertops",
      "phase_name": "Countertop Installation",
      "order": 8,
      "estimated_days": 2,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["cabinets"]
    },
    {
      "phase_id": "backsplash",
      "phase_name": "Tile Backsplash",
      "order": 9,
      "estimated_days": 3,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["countertops"]
    },
    {
      "phase_id": "painting",
      "phase_name": "Painting",
      "order": 10,
      "estimated_days": 3,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["drywall"]
    },
    {
      "phase_id": "finish_plumbing",
      "phase_name": "Plumbing Finish (Sink, Faucet)",
      "order": 11,
      "estimated_days": 1,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["countertops"]
    },
    {
      "phase_id": "finish_electrical",
      "phase_name": "Electrical Finish (Outlets, Lights)",
      "order": 12,
      "estimated_days": 2,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["backsplash", "painting"]
    },
    {
      "phase_id": "appliances",
      "phase_name": "Appliance Installation",
      "order": 13,
      "estimated_days": 1,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["finish_plumbing", "finish_electrical", "countertops"]
    },
    {
      "phase_id": "final_inspection",
      "phase_name": "Final Inspection",
      "order": 14,
      "estimated_days": 1,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["appliances", "finish_electrical", "finish_plumbing"]
    },
    {
      "phase_id": "punchlist",
      "phase_name": "Punchlist & Cleanup",
      "order": 15,
      "estimated_days": 2,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["final_inspection"]
    }
  ]'::jsonb,
  '["general_contractor", "plumbing", "electrical", "drywall", "flooring", "cabinets", "countertops", "tile", "painting"]'::jsonb,
  '[
    {"phase": "rough_plumbing", "type": "plumbing", "required": true},
    {"phase": "rough_electrical", "type": "electrical", "required": true},
    {"phase": "final_inspection", "type": "final", "required": true}
  ]'::jsonb,
  '{
    "rough_plumbing": ["demo"],
    "rough_electrical": ["demo"],
    "drywall": ["rough_plumbing", "rough_electrical"],
    "cabinets": ["drywall"],
    "countertops": ["cabinets"],
    "final_inspection": ["appliances", "finish_electrical", "finish_plumbing"]
  }'::jsonb,
  '["design_plans", "material_selections", "plumbing_permit", "electrical_permit", "final_inspection_report", "warranty_documents"]'::jsonb,
  '["NEC", "IPC", "IRC"]'::jsonb
)
ON CONFLICT (template_name) DO NOTHING;

-- ========================================
-- 4. REMODEL - Bathroom Remodel (Full)
-- ========================================
INSERT INTO project_templates (
  template_name,
  template_type,
  display_name,
  description,
  typical_duration_days,
  complexity_level,
  requires_blueprints,
  requires_permits,
  requires_engineering,
  phases,
  required_trades,
  inspection_points,
  critical_dependencies,
  deliverables,
  applicable_codes
) VALUES (
  'bathroom_remodel_full',
  'remodel',
  'Full Bathroom Remodel',
  'Complete bathroom renovation with new fixtures, tile, vanity, and lighting',
  28, -- 4 weeks
  'moderate',
  false,
  true,
  false,
  '[
    {
      "phase_id": "planning",
      "phase_name": "Design & Material Selection",
      "order": 1,
      "estimated_days": 5,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": []
    },
    {
      "phase_id": "demo",
      "phase_name": "Demolition",
      "order": 2,
      "estimated_days": 2,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["planning"]
    },
    {
      "phase_id": "rough_plumbing",
      "phase_name": "Plumbing Rough-In",
      "order": 3,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["demo"]
    },
    {
      "phase_id": "rough_electrical",
      "phase_name": "Electrical Rough-In",
      "order": 4,
      "estimated_days": 2,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["demo"]
    },
    {
      "phase_id": "drywall",
      "phase_name": "Drywall & Backer Board",
      "order": 5,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["rough_plumbing", "rough_electrical"]
    },
    {
      "phase_id": "waterproofing",
      "phase_name": "Shower Waterproofing",
      "order": 6,
      "estimated_days": 2,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["drywall"]
    },
    {
      "phase_id": "tile",
      "phase_name": "Tile Work (Floor & Shower)",
      "order": 7,
      "estimated_days": 5,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["waterproofing"]
    },
    {
      "phase_id": "vanity",
      "phase_name": "Vanity Installation",
      "order": 8,
      "estimated_days": 1,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["tile"]
    },
    {
      "phase_id": "painting",
      "phase_name": "Painting",
      "order": 9,
      "estimated_days": 2,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["drywall"]
    },
    {
      "phase_id": "finish_plumbing",
      "phase_name": "Plumbing Fixtures",
      "order": 10,
      "estimated_days": 2,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["tile", "vanity"]
    },
    {
      "phase_id": "finish_electrical",
      "phase_name": "Electrical Fixtures",
      "order": 11,
      "estimated_days": 1,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["painting", "tile"]
    },
    {
      "phase_id": "final_inspection",
      "phase_name": "Final Inspection",
      "order": 12,
      "estimated_days": 1,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["finish_plumbing", "finish_electrical"]
    },
    {
      "phase_id": "cleanup",
      "phase_name": "Final Cleanup",
      "order": 13,
      "estimated_days": 1,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["final_inspection"]
    }
  ]'::jsonb,
  '["general_contractor", "plumbing", "electrical", "drywall", "tile", "painting"]'::jsonb,
  '[
    {"phase": "rough_plumbing", "type": "plumbing", "required": true},
    {"phase": "rough_electrical", "type": "electrical", "required": true},
    {"phase": "final_inspection", "type": "final", "required": true}
  ]'::jsonb,
  '{
    "rough_plumbing": ["demo"],
    "rough_electrical": ["demo"],
    "drywall": ["rough_plumbing", "rough_electrical"],
    "tile": ["waterproofing"],
    "final_inspection": ["finish_plumbing", "finish_electrical"]
  }'::jsonb,
  '["design_plans", "material_selections", "plumbing_permit", "electrical_permit", "final_inspection_report"]'::jsonb,
  '["NEC", "IPC", "IRC"]'::jsonb
)
ON CONFLICT (template_name) DO NOTHING;

-- ========================================
-- Verification
-- ========================================
SELECT 'Sample project templates seeded successfully!' as status;
SELECT
  template_name,
  template_type,
  display_name,
  typical_duration_days,
  complexity_level
FROM project_templates
ORDER BY
  CASE template_type
    WHEN 'new_construction' THEN 1
    WHEN 'addition' THEN 2
    WHEN 'remodel' THEN 3
  END,
  typical_duration_days DESC;
