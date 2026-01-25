-- ========================================
-- Comprehensive Project Templates
-- Date: 2026-01-25
-- Purpose: Add realistic templates for common project types
-- ========================================

-- ========================================
-- 1. BASEMENT REFINISH (No Bathroom)
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
  'basement_refinish',
  'remodel',
  'Basement Refinish',
  'Finish existing basement space including framing, drywall, flooring, electrical, and HVAC',
  49, -- 7 weeks
  'moderate',
  false,
  true,
  false,
  '[
    {
      "phase_id": "planning",
      "phase_name": "Planning & Permits",
      "order": 1,
      "estimated_days": 7,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": []
    },
    {
      "phase_id": "waterproofing",
      "phase_name": "Waterproofing & Drainage",
      "order": 2,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["planning"]
    },
    {
      "phase_id": "framing",
      "phase_name": "Framing Walls & Ceiling",
      "order": 3,
      "estimated_days": 7,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["waterproofing"]
    },
    {
      "phase_id": "rough_electrical",
      "phase_name": "Electrical Rough-In",
      "order": 4,
      "estimated_days": 5,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["framing"]
    },
    {
      "phase_id": "rough_hvac",
      "phase_name": "HVAC Rough-In",
      "order": 5,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["framing"]
    },
    {
      "phase_id": "insulation",
      "phase_name": "Insulation",
      "order": 6,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["rough_electrical", "rough_hvac"]
    },
    {
      "phase_id": "drywall",
      "phase_name": "Drywall Installation & Finishing",
      "order": 7,
      "estimated_days": 7,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["insulation"]
    },
    {
      "phase_id": "flooring",
      "phase_name": "Flooring Installation",
      "order": 8,
      "estimated_days": 5,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["drywall"]
    },
    {
      "phase_id": "trim",
      "phase_name": "Trim & Doors",
      "order": 9,
      "estimated_days": 3,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["drywall"]
    },
    {
      "phase_id": "painting",
      "phase_name": "Painting",
      "order": 10,
      "estimated_days": 3,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["trim"]
    },
    {
      "phase_id": "finish_electrical",
      "phase_name": "Electrical Finish (Outlets, Lights)",
      "order": 11,
      "estimated_days": 2,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["painting"]
    },
    {
      "phase_id": "finish_hvac",
      "phase_name": "HVAC Finish (Registers, Thermostats)",
      "order": 12,
      "estimated_days": 1,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["painting"]
    },
    {
      "phase_id": "final_inspection",
      "phase_name": "Final Inspection",
      "order": 13,
      "estimated_days": 1,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["finish_electrical", "finish_hvac", "flooring"]
    },
    {
      "phase_id": "punchlist",
      "phase_name": "Punchlist & Cleanup",
      "order": 14,
      "estimated_days": 2,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["final_inspection"]
    }
  ]'::jsonb,
  '["general_contractor", "waterproofing", "framing", "electrical", "hvac", "insulation", "drywall", "flooring", "carpentry", "painting"]'::jsonb,
  '[
    {"phase": "framing", "type": "framing", "required": true},
    {"phase": "rough_electrical", "type": "electrical", "required": true},
    {"phase": "rough_hvac", "type": "mechanical", "required": true},
    {"phase": "insulation", "type": "insulation", "required": true},
    {"phase": "final_inspection", "type": "final", "required": true}
  ]'::jsonb,
  '{
    "framing": ["waterproofing"],
    "rough_electrical": ["framing"],
    "rough_hvac": ["framing"],
    "insulation": ["rough_electrical", "rough_hvac"],
    "drywall": ["insulation"],
    "final_inspection": ["finish_electrical", "finish_hvac"]
  }'::jsonb,
  '["building_permit", "electrical_permit", "mechanical_permit", "design_layout", "material_list", "final_inspection_report"]'::jsonb,
  '["IRC", "NEC", "IMC", "IECC"]'::jsonb
)
ON CONFLICT (template_name) DO NOTHING;

-- ========================================
-- 2. BASEMENT BATHROOM ADDITION
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
  'basement_bathroom_addition',
  'addition',
  'Basement Bathroom Addition',
  'Add new full bathroom in basement including plumbing, electrical, fixtures, and finishes',
  35, -- 5 weeks
  'complex',
  false,
  true,
  false,
  '[
    {
      "phase_id": "planning",
      "phase_name": "Planning & Permits",
      "order": 1,
      "estimated_days": 7,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": []
    },
    {
      "phase_id": "demo",
      "phase_name": "Demolition & Floor Opening",
      "order": 2,
      "estimated_days": 2,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["planning"]
    },
    {
      "phase_id": "drainage",
      "phase_name": "Drainage & Sewer Connection",
      "order": 3,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["demo"]
    },
    {
      "phase_id": "framing",
      "phase_name": "Framing Walls",
      "order": 4,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["drainage"]
    },
    {
      "phase_id": "rough_plumbing",
      "phase_name": "Rough Plumbing",
      "order": 5,
      "estimated_days": 4,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["framing", "drainage"]
    },
    {
      "phase_id": "rough_electrical",
      "phase_name": "Rough Electrical",
      "order": 6,
      "estimated_days": 2,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["framing"]
    },
    {
      "phase_id": "rough_hvac",
      "phase_name": "HVAC & Ventilation",
      "order": 7,
      "estimated_days": 2,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["framing"]
    },
    {
      "phase_id": "insulation",
      "phase_name": "Insulation",
      "order": 8,
      "estimated_days": 1,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["rough_plumbing", "rough_electrical", "rough_hvac"]
    },
    {
      "phase_id": "drywall",
      "phase_name": "Drywall & Backer Board",
      "order": 9,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["insulation"]
    },
    {
      "phase_id": "waterproofing",
      "phase_name": "Shower Waterproofing",
      "order": 10,
      "estimated_days": 1,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["drywall"]
    },
    {
      "phase_id": "tile",
      "phase_name": "Tile Work",
      "order": 11,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["waterproofing"]
    },
    {
      "phase_id": "vanity",
      "phase_name": "Vanity & Storage",
      "order": 12,
      "estimated_days": 1,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["tile"]
    },
    {
      "phase_id": "painting",
      "phase_name": "Painting",
      "order": 13,
      "estimated_days": 2,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["drywall"]
    },
    {
      "phase_id": "finish_plumbing",
      "phase_name": "Plumbing Fixtures",
      "order": 14,
      "estimated_days": 2,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["tile", "vanity"]
    },
    {
      "phase_id": "finish_electrical",
      "phase_name": "Electrical Fixtures",
      "order": 15,
      "estimated_days": 1,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["painting"]
    },
    {
      "phase_id": "final_inspection",
      "phase_name": "Final Inspection",
      "order": 16,
      "estimated_days": 1,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["finish_plumbing", "finish_electrical"]
    },
    {
      "phase_id": "cleanup",
      "phase_name": "Final Cleanup",
      "order": 17,
      "estimated_days": 1,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["final_inspection"]
    }
  ]'::jsonb,
  '["general_contractor", "excavation", "plumbing", "electrical", "hvac", "framing", "drywall", "tile", "painting"]'::jsonb,
  '[
    {"phase": "drainage", "type": "plumbing", "required": true},
    {"phase": "framing", "type": "framing", "required": true},
    {"phase": "rough_plumbing", "type": "plumbing", "required": true},
    {"phase": "rough_electrical", "type": "electrical", "required": true},
    {"phase": "rough_hvac", "type": "mechanical", "required": true},
    {"phase": "insulation", "type": "insulation", "required": true},
    {"phase": "final_inspection", "type": "final", "required": true}
  ]'::jsonb,
  '{
    "drainage": ["demo"],
    "framing": ["drainage"],
    "rough_plumbing": ["framing", "drainage"],
    "insulation": ["rough_plumbing", "rough_electrical", "rough_hvac"],
    "drywall": ["insulation"],
    "final_inspection": ["finish_plumbing", "finish_electrical"]
  }'::jsonb,
  '["plumbing_permit", "electrical_permit", "mechanical_permit", "building_permit", "design_layout", "material_list", "final_inspection_report"]'::jsonb,
  '["IRC", "IPC", "NEC", "IMC"]'::jsonb
)
ON CONFLICT (template_name) DO NOTHING;

-- ========================================
-- 3. DECK CONSTRUCTION
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
  'deck_construction_400sqft',
  'new_construction',
  'Deck Construction (400 sqft)',
  'New deck construction with footings, framing, decking, and railing',
  21, -- 3 weeks
  'simple',
  false,
  true,
  false,
  '[
    {
      "phase_id": "planning",
      "phase_name": "Planning & Permits",
      "order": 1,
      "estimated_days": 5,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": []
    },
    {
      "phase_id": "layout",
      "phase_name": "Site Layout & Marking",
      "order": 2,
      "estimated_days": 1,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["planning"]
    },
    {
      "phase_id": "footings",
      "phase_name": "Dig & Pour Footings",
      "order": 3,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["layout"]
    },
    {
      "phase_id": "posts",
      "phase_name": "Install Posts",
      "order": 4,
      "estimated_days": 2,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["footings"]
    },
    {
      "phase_id": "ledger",
      "phase_name": "Attach Ledger Board",
      "order": 5,
      "estimated_days": 1,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["posts"]
    },
    {
      "phase_id": "framing",
      "phase_name": "Frame Deck (Joists & Beams)",
      "order": 6,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["ledger", "posts"]
    },
    {
      "phase_id": "decking",
      "phase_name": "Install Decking Boards",
      "order": 7,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["framing"]
    },
    {
      "phase_id": "railing",
      "phase_name": "Install Railing",
      "order": 8,
      "estimated_days": 2,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["decking"]
    },
    {
      "phase_id": "final_inspection",
      "phase_name": "Final Inspection",
      "order": 9,
      "estimated_days": 1,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["railing"]
    }
  ]'::jsonb,
  '["general_contractor", "concrete", "carpentry"]'::jsonb,
  '[
    {"phase": "footings", "type": "footing", "required": true},
    {"phase": "ledger", "type": "ledger", "required": true},
    {"phase": "framing", "type": "framing", "required": true},
    {"phase": "final_inspection", "type": "final", "required": true}
  ]'::jsonb,
  '{
    "footings": ["layout"],
    "posts": ["footings"],
    "framing": ["ledger", "posts"],
    "decking": ["framing"],
    "final_inspection": ["railing"]
  }'::jsonb,
  '["building_permit", "site_plan", "material_list", "final_inspection_report"]'::jsonb,
  '["IRC", "IBC"]'::jsonb
)
ON CONFLICT (template_name) DO NOTHING;

-- ========================================
-- 4. ROOF REPLACEMENT
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
  'roof_replacement_2000sqft',
  'replacement',
  'Roof Replacement (2000 sqft)',
  'Complete roof tear-off and replacement with new shingles, underlayment, and flashing',
  7, -- 1 week
  'moderate',
  false,
  true,
  false,
  '[
    {
      "phase_id": "planning",
      "phase_name": "Planning & Material Delivery",
      "order": 1,
      "estimated_days": 2,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": []
    },
    {
      "phase_id": "tearoff",
      "phase_name": "Tear Off Old Roofing",
      "order": 2,
      "estimated_days": 1,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["planning"]
    },
    {
      "phase_id": "decking_repair",
      "phase_name": "Deck Inspection & Repair",
      "order": 3,
      "estimated_days": 1,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["tearoff"]
    },
    {
      "phase_id": "underlayment",
      "phase_name": "Install Underlayment & Ice Shield",
      "order": 4,
      "estimated_days": 1,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["decking_repair"]
    },
    {
      "phase_id": "shingles",
      "phase_name": "Install Shingles",
      "order": 5,
      "estimated_days": 1,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["underlayment"]
    },
    {
      "phase_id": "flashing",
      "phase_name": "Install Flashing & Vents",
      "order": 6,
      "estimated_days": 1,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["shingles"]
    },
    {
      "phase_id": "cleanup",
      "phase_name": "Cleanup & Final Inspection",
      "order": 7,
      "estimated_days": 1,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["flashing"]
    }
  ]'::jsonb,
  '["roofing"]'::jsonb,
  '[
    {"phase": "cleanup", "type": "final", "required": true}
  ]'::jsonb,
  '{
    "decking_repair": ["tearoff"],
    "underlayment": ["decking_repair"],
    "shingles": ["underlayment"],
    "cleanup": ["flashing"]
  }'::jsonb,
  '["roofing_permit", "material_specifications", "warranty_documents"]'::jsonb,
  '["IRC", "IBC"]'::jsonb
)
ON CONFLICT (template_name) DO NOTHING;

-- ========================================
-- 5. MASTER BATHROOM ADDITION (New Space)
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
  'master_bathroom_addition',
  'addition',
  'Master Bathroom Addition (200 sqft)',
  'New master bathroom addition with separate shower, soaking tub, dual vanity',
  84, -- 12 weeks
  'complex',
  true,
  true,
  true,
  '[
    {
      "phase_id": "planning",
      "phase_name": "Planning & Permits",
      "order": 1,
      "estimated_days": 14,
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
      "phase_id": "foundation",
      "phase_name": "Foundation Work",
      "order": 3,
      "estimated_days": 7,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["demo"]
    },
    {
      "phase_id": "framing",
      "phase_name": "Framing Walls & Ceiling",
      "order": 4,
      "estimated_days": 7,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["foundation"]
    },
    {
      "phase_id": "roofing",
      "phase_name": "Roofing",
      "order": 5,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["framing"]
    },
    {
      "phase_id": "windows",
      "phase_name": "Windows & Doors",
      "order": 6,
      "estimated_days": 2,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["framing"]
    },
    {
      "phase_id": "rough_plumbing",
      "phase_name": "Rough Plumbing",
      "order": 7,
      "estimated_days": 5,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["framing"]
    },
    {
      "phase_id": "rough_electrical",
      "phase_name": "Rough Electrical",
      "order": 8,
      "estimated_days": 4,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["framing"]
    },
    {
      "phase_id": "rough_hvac",
      "phase_name": "HVAC Rough-In",
      "order": 9,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["framing"]
    },
    {
      "phase_id": "insulation",
      "phase_name": "Insulation",
      "order": 10,
      "estimated_days": 2,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["rough_plumbing", "rough_electrical", "rough_hvac"]
    },
    {
      "phase_id": "drywall",
      "phase_name": "Drywall & Backer Board",
      "order": 11,
      "estimated_days": 7,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["insulation"]
    },
    {
      "phase_id": "waterproofing",
      "phase_name": "Shower & Tub Waterproofing",
      "order": 12,
      "estimated_days": 2,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["drywall"]
    },
    {
      "phase_id": "tile",
      "phase_name": "Tile Work (Floor & Walls)",
      "order": 13,
      "estimated_days": 7,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["waterproofing"]
    },
    {
      "phase_id": "cabinets",
      "phase_name": "Dual Vanity Installation",
      "order": 14,
      "estimated_days": 2,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["tile"]
    },
    {
      "phase_id": "countertops",
      "phase_name": "Countertops",
      "order": 15,
      "estimated_days": 2,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["cabinets"]
    },
    {
      "phase_id": "painting",
      "phase_name": "Painting",
      "order": 16,
      "estimated_days": 3,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["drywall"]
    },
    {
      "phase_id": "finish_plumbing",
      "phase_name": "Plumbing Fixtures (Tub, Shower, Sinks)",
      "order": 17,
      "estimated_days": 3,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["tile", "countertops"]
    },
    {
      "phase_id": "finish_electrical",
      "phase_name": "Electrical Fixtures",
      "order": 18,
      "estimated_days": 2,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["painting"]
    },
    {
      "phase_id": "finish_hvac",
      "phase_name": "HVAC Finish",
      "order": 19,
      "estimated_days": 1,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["painting"]
    },
    {
      "phase_id": "final_inspection",
      "phase_name": "Final Inspection",
      "order": 20,
      "estimated_days": 2,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["finish_plumbing", "finish_electrical", "finish_hvac"]
    },
    {
      "phase_id": "punchlist",
      "phase_name": "Punchlist & Cleanup",
      "order": 21,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["final_inspection"]
    }
  ]'::jsonb,
  '["architect", "engineer", "general_contractor", "concrete", "framing", "roofing", "windows_doors", "plumbing", "electrical", "hvac", "insulation", "drywall", "tile", "cabinets", "countertops", "painting"]'::jsonb,
  '[
    {"phase": "foundation", "type": "foundation", "required": true},
    {"phase": "framing", "type": "framing", "required": true},
    {"phase": "rough_plumbing", "type": "plumbing", "required": true},
    {"phase": "rough_electrical", "type": "electrical", "required": true},
    {"phase": "rough_hvac", "type": "mechanical", "required": true},
    {"phase": "insulation", "type": "insulation", "required": true},
    {"phase": "final_inspection", "type": "final", "required": true}
  ]'::jsonb,
  '{
    "foundation": ["demo"],
    "framing": ["foundation"],
    "rough_plumbing": ["framing"],
    "rough_electrical": ["framing"],
    "rough_hvac": ["framing"],
    "insulation": ["rough_plumbing", "rough_electrical", "rough_hvac"],
    "drywall": ["insulation"],
    "final_inspection": ["finish_plumbing", "finish_electrical", "finish_hvac"]
  }'::jsonb,
  '["architectural_plans", "engineering_plans", "building_permit", "plumbing_permit", "electrical_permit", "mechanical_permit", "material_selections", "final_inspection_report"]'::jsonb,
  '["IRC", "IBC", "NEC", "IPC", "IMC", "IECC"]'::jsonb
)
ON CONFLICT (template_name) DO NOTHING;

-- ========================================
-- 6. GARAGE CONSTRUCTION (2-Car Detached)
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
  'garage_2car_detached',
  'new_construction',
  '2-Car Detached Garage',
  'New 24x24 detached garage with foundation, framing, roofing, siding, and garage doors',
  56, -- 8 weeks
  'moderate',
  true,
  true,
  false,
  '[
    {
      "phase_id": "planning",
      "phase_name": "Planning & Permits",
      "order": 1,
      "estimated_days": 10,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": []
    },
    {
      "phase_id": "site_prep",
      "phase_name": "Site Preparation",
      "order": 2,
      "estimated_days": 2,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["planning"]
    },
    {
      "phase_id": "excavation",
      "phase_name": "Excavation",
      "order": 3,
      "estimated_days": 1,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["site_prep"]
    },
    {
      "phase_id": "foundation",
      "phase_name": "Foundation & Slab",
      "order": 4,
      "estimated_days": 7,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["excavation"]
    },
    {
      "phase_id": "framing",
      "phase_name": "Wall & Roof Framing",
      "order": 5,
      "estimated_days": 10,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["foundation"]
    },
    {
      "phase_id": "roofing",
      "phase_name": "Roofing",
      "order": 6,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["framing"]
    },
    {
      "phase_id": "siding",
      "phase_name": "Siding",
      "order": 7,
      "estimated_days": 5,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["framing"]
    },
    {
      "phase_id": "garage_doors",
      "phase_name": "Garage Doors",
      "order": 8,
      "estimated_days": 2,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["framing"]
    },
    {
      "phase_id": "electrical",
      "phase_name": "Electrical (Lights & Outlets)",
      "order": 9,
      "estimated_days": 3,
      "critical_path": false,
      "requires_inspection": true,
      "dependencies": ["framing"]
    },
    {
      "phase_id": "painting",
      "phase_name": "Exterior & Interior Painting",
      "order": 10,
      "estimated_days": 3,
      "critical_path": false,
      "requires_inspection": false,
      "dependencies": ["siding"]
    },
    {
      "phase_id": "final_inspection",
      "phase_name": "Final Inspection",
      "order": 11,
      "estimated_days": 2,
      "critical_path": true,
      "requires_inspection": true,
      "dependencies": ["electrical", "garage_doors", "painting"]
    },
    {
      "phase_id": "cleanup",
      "phase_name": "Cleanup & Grading",
      "order": 12,
      "estimated_days": 3,
      "critical_path": true,
      "requires_inspection": false,
      "dependencies": ["final_inspection"]
    }
  ]'::jsonb,
  '["general_contractor", "excavation", "concrete", "framing", "roofing", "siding", "garage_doors", "electrical", "painting"]'::jsonb,
  '[
    {"phase": "foundation", "type": "foundation", "required": true},
    {"phase": "framing", "type": "framing", "required": true},
    {"phase": "electrical", "type": "electrical", "required": true},
    {"phase": "final_inspection", "type": "final", "required": true}
  ]'::jsonb,
  '{
    "foundation": ["excavation"],
    "framing": ["foundation"],
    "roofing": ["framing"],
    "electrical": ["framing"],
    "final_inspection": ["electrical", "garage_doors"]
  }'::jsonb,
  '["architectural_plans", "building_permit", "electrical_permit", "site_plan", "material_list", "final_inspection_report"]'::jsonb,
  '["IRC", "IBC", "NEC"]'::jsonb
)
ON CONFLICT (template_name) DO NOTHING;

-- ========================================
-- Verification
-- ========================================
SELECT 'Comprehensive project templates added successfully!' as status;

SELECT
  template_name,
  template_type,
  display_name,
  typical_duration_days,
  complexity_level,
  (SELECT COUNT(*) FROM jsonb_array_elements(phases)) as phase_count
FROM project_templates
WHERE template_name IN (
  'basement_refinish',
  'basement_bathroom_addition',
  'deck_construction_400sqft',
  'roof_replacement_2000sqft',
  'master_bathroom_addition',
  'garage_2car_detached'
)
ORDER BY typical_duration_days DESC;
