-- ========================================
-- Migration: Project Template Engine
-- Date: 2026-01-15
-- Purpose: Add template-driven state machine for Universal Auto-GC
-- ========================================
-- This enables the Auto-GC to handle ANY project type:
-- - New Construction (ground-up homes)
-- - Additions (room additions, garages, ADUs)
-- - Remodels (kitchen, bathroom, basement)
-- ========================================

-- ========================================
-- 1. Project Templates Table
-- Stores the "Master Plans" for different project types
-- ========================================
CREATE TABLE IF NOT EXISTS project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Template identification
  template_name TEXT NOT NULL UNIQUE,
  template_type TEXT NOT NULL CHECK (template_type IN (
    'new_construction', 'addition', 'remodel', 'repair', 'custom'
  )),

  -- Template metadata
  display_name TEXT NOT NULL,
  description TEXT,

  -- Project characteristics
  typical_duration_days INTEGER,
  complexity_level TEXT CHECK (complexity_level IN ('simple', 'moderate', 'complex', 'very_complex')),

  -- Required documents/blueprints
  requires_blueprints BOOLEAN DEFAULT false,
  requires_permits BOOLEAN DEFAULT true,
  requires_engineering BOOLEAN DEFAULT false,

  -- Template configuration (JSON structure)
  phases JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Example structure:
  -- [
  --   {
  --     "phase_id": "excavation",
  --     "phase_name": "Excavation",
  --     "order": 1,
  --     "estimated_days": 3,
  --     "critical_path": true,
  --     "requires_inspection": true,
  --     "dependencies": []
  --   },
  --   {
  --     "phase_id": "foundation",
  --     "phase_name": "Foundation & Concrete",
  --     "order": 2,
  --     "estimated_days": 7,
  --     "critical_path": true,
  --     "requires_inspection": true,
  --     "dependencies": ["excavation"]
  --   }
  -- ]

  -- Required trades/contractors
  required_trades JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Example: ["excavator", "concrete_contractor", "framing_contractor", "electrician", "plumber", "hvac", "drywall", "painter"]

  -- Inspection requirements
  inspection_points JSONB DEFAULT '[]'::jsonb,
  -- Example: [{"phase": "foundation", "type": "structural", "required": true}, {"phase": "framing", "type": "structural", "required": true}]

  -- Critical dependencies (for CPM)
  critical_dependencies JSONB DEFAULT '{}'::jsonb,
  -- Example: {"foundation": ["excavation"], "framing": ["foundation"], "drywall": ["electrical", "plumbing", "hvac"]}

  -- Deliverable checklist
  deliverables JSONB DEFAULT '[]'::jsonb,
  -- Example: ["blueprints", "permits", "material_list", "schedule", "final_walkthrough", "certificate_of_occupancy"]

  -- Code requirements
  applicable_codes JSONB DEFAULT '[]'::jsonb,
  -- Example: ["IRC", "IBC", "NEC", "IPC", "IMC", "IECC"]

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for project_templates
CREATE INDEX IF NOT EXISTS idx_project_templates_type ON project_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_project_templates_active ON project_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_project_templates_name ON project_templates(template_name);

-- ========================================
-- 2. Template Milestones Table
-- Defines specific milestones/phases for each template
-- ========================================
CREATE TABLE IF NOT EXISTS template_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,

  -- Milestone details
  milestone_id TEXT NOT NULL, -- e.g., "foundation", "framing"
  milestone_name TEXT NOT NULL,
  milestone_order INTEGER NOT NULL,

  -- Duration and scheduling
  estimated_duration_days INTEGER NOT NULL DEFAULT 1,
  is_critical_path BOOLEAN DEFAULT false,

  -- Dependencies
  depends_on JSONB DEFAULT '[]'::jsonb, -- Array of milestone_ids that must complete first

  -- Inspection requirements
  requires_inspection BOOLEAN DEFAULT false,
  inspection_type TEXT, -- e.g., "structural", "electrical", "final"

  -- Trade requirements
  required_trades JSONB DEFAULT '[]'::jsonb, -- Array of trade types needed

  -- Checklist items
  checklist_items JSONB DEFAULT '[]'::jsonb,
  -- Example: ["Pour footings", "Set forms", "Place rebar", "Pour concrete", "Cure 7 days"]

  -- Quality control
  quality_checks JSONB DEFAULT '[]'::jsonb,
  -- Example: [{"check": "Level foundation", "tolerance": "1/4 inch in 10 feet"}]

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for template_milestones
CREATE INDEX IF NOT EXISTS idx_template_milestones_template ON template_milestones(template_id);
CREATE INDEX IF NOT EXISTS idx_template_milestones_order ON template_milestones(milestone_order);
CREATE INDEX IF NOT EXISTS idx_template_milestones_critical ON template_milestones(is_critical_path);

-- Unique constraint: milestone_id must be unique within a template
CREATE UNIQUE INDEX IF NOT EXISTS idx_template_milestones_unique
ON template_milestones(template_id, milestone_id);

-- ========================================
-- 3. Update job_postings table
-- Add template reference and blueprints
-- ========================================
ALTER TABLE job_postings
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES project_templates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS blueprints_url TEXT,
ADD COLUMN IF NOT EXISTS blueprint_pages JSONB DEFAULT '[]'::jsonb,
-- Example: [{"page": 1, "url": "https://...", "type": "site_plan"}, {"page": 2, "url": "https://...", "type": "floor_plan"}]
ADD COLUMN IF NOT EXISTS project_metadata JSONB DEFAULT '{}'::jsonb;
-- Example: {"square_footage": 2500, "stories": 2, "bedrooms": 4, "bathrooms": 3, "special_requirements": ["home_theater", "wine_cellar"]}

-- Create indexes for new job_postings columns
CREATE INDEX IF NOT EXISTS idx_job_postings_template ON job_postings(template_id);

-- ========================================
-- 4. Update project_states table
-- Remove hardcoded phase enum, use TEXT instead
-- ========================================
-- Drop views that depend on current_phase column
DROP VIEW IF EXISTS active_projects_with_state CASCADE;
DROP VIEW IF EXISTS projects_with_templates CASCADE;

-- Drop the existing constraint
ALTER TABLE project_states DROP CONSTRAINT IF EXISTS project_states_current_phase_check;

-- Change column type to TEXT to allow dynamic phases
ALTER TABLE project_states ALTER COLUMN current_phase TYPE TEXT;

-- Add new columns for template-driven workflow
ALTER TABLE project_states
ADD COLUMN IF NOT EXISTS current_milestone_id TEXT,
ADD COLUMN IF NOT EXISTS completed_milestones JSONB DEFAULT '[]'::jsonb,
-- Example: [{"milestone_id": "excavation", "completed_at": "2026-01-10T14:30:00Z", "status": "passed"}]
ADD COLUMN IF NOT EXISTS pending_inspections JSONB DEFAULT '[]'::jsonb,
-- Example: [{"milestone_id": "foundation", "inspection_type": "structural", "scheduled_date": "2026-01-15", "status": "pending"}]
ADD COLUMN IF NOT EXISTS schedule_variance_days INTEGER DEFAULT 0,
-- Tracks ahead (+) or behind (-) schedule
ADD COLUMN IF NOT EXISTS critical_path_status TEXT DEFAULT 'on_track' CHECK (critical_path_status IN (
  'on_track', 'at_risk', 'delayed', 'ahead'
));

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_project_states_milestone ON project_states(current_milestone_id);
CREATE INDEX IF NOT EXISTS idx_project_states_critical_path ON project_states(critical_path_status);

-- ========================================
-- 5. Project Milestones Tracking Table
-- Tracks actual milestone progress for each project
-- ========================================
CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  template_milestone_id UUID REFERENCES template_milestones(id) ON DELETE SET NULL,

  -- Milestone identification
  milestone_id TEXT NOT NULL,
  milestone_name TEXT NOT NULL,
  milestone_order INTEGER NOT NULL,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'inspection_pending', 'inspection_passed',
    'inspection_failed', 'completed', 'blocked', 'skipped'
  )),

  -- Scheduling
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,

  -- Inspection tracking
  requires_inspection BOOLEAN DEFAULT false,
  inspection_scheduled_date DATE,
  inspection_status TEXT CHECK (inspection_status IN (
    'not_required', 'pending', 'scheduled', 'passed', 'failed', 'reinspection_required'
  )),
  inspection_notes TEXT,
  inspection_document_url TEXT,

  -- Dependencies
  depends_on JSONB DEFAULT '[]'::jsonb,
  blocks JSONB DEFAULT '[]'::jsonb, -- Milestones that depend on this one

  -- Progress tracking
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),

  -- Issues and blockers
  is_blocked BOOLEAN DEFAULT false,
  blocker_reason TEXT,
  blocker_resolved_at TIMESTAMP WITH TIME ZONE,

  -- Assigned trades
  assigned_trades JSONB DEFAULT '[]'::jsonb,
  -- Example: [{"trade": "electrician", "contractor_id": "uuid", "status": "assigned"}]

  -- Photos and documentation
  progress_photos JSONB DEFAULT '[]'::jsonb,
  completion_photos JSONB DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for project_milestones
CREATE INDEX IF NOT EXISTS idx_project_milestones_project ON project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_status ON project_milestones(status);
CREATE INDEX IF NOT EXISTS idx_project_milestones_order ON project_milestones(project_id, milestone_order);
CREATE INDEX IF NOT EXISTS idx_project_milestones_inspection ON project_milestones(inspection_status) WHERE requires_inspection = true;
CREATE INDEX IF NOT EXISTS idx_project_milestones_blocked ON project_milestones(is_blocked) WHERE is_blocked = true;

-- Unique constraint: one milestone instance per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_milestones_unique
ON project_milestones(project_id, milestone_id);

-- ========================================
-- 6. Update ai_agent_activity table
-- Add new agent types
-- ========================================
ALTER TABLE ai_agent_activity DROP CONSTRAINT IF EXISTS ai_agent_activity_agent_type_check;
ALTER TABLE ai_agent_activity ADD CONSTRAINT ai_agent_activity_agent_type_check
CHECK (agent_type IN (
  'orchestrator', 'visionary', 'hawk', 'shark', 'whip', 'diplomat', 'summarizer', 'sentinel', 'inspector'
));

-- ========================================
-- 7. Template Trade Requirements Table
-- Defines which trades are needed for each template
-- ========================================
CREATE TABLE IF NOT EXISTS template_trade_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,

  -- Trade details
  trade_type TEXT NOT NULL CHECK (trade_type IN (
    'general_contractor', 'excavation', 'concrete', 'foundation', 'framing',
    'roofing', 'siding', 'windows_doors', 'plumbing', 'electrical', 'hvac',
    'insulation', 'drywall', 'painting', 'flooring', 'cabinets', 'countertops',
    'tile', 'landscaping', 'masonry', 'carpentry', 'architect', 'engineer'
  )),

  trade_name TEXT NOT NULL,

  -- When is this trade needed
  required_for_phases JSONB DEFAULT '[]'::jsonb,
  -- Example: ["framing", "rough_in"]

  -- Is this trade critical path?
  is_critical BOOLEAN DEFAULT false,

  -- Typical timing
  typical_start_milestone TEXT,
  typical_duration_days INTEGER,

  -- Qualifications required
  license_required BOOLEAN DEFAULT true,
  insurance_required BOOLEAN DEFAULT true,
  bond_required BOOLEAN DEFAULT false,

  -- Procurement priority (1 = highest)
  procurement_priority INTEGER DEFAULT 10,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for template_trade_requirements
CREATE INDEX IF NOT EXISTS idx_template_trade_requirements_template ON template_trade_requirements(template_id);
CREATE INDEX IF NOT EXISTS idx_template_trade_requirements_type ON template_trade_requirements(trade_type);
CREATE INDEX IF NOT EXISTS idx_template_trade_requirements_critical ON template_trade_requirements(is_critical);
CREATE INDEX IF NOT EXISTS idx_template_trade_requirements_priority ON template_trade_requirements(procurement_priority);

-- ========================================
-- 8. Update Trigger for new tables
-- ========================================
DROP TRIGGER IF EXISTS update_project_templates_updated_at ON project_templates;
CREATE TRIGGER update_project_templates_updated_at
  BEFORE UPDATE ON project_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_milestones_updated_at ON project_milestones;
CREATE TRIGGER update_project_milestones_updated_at
  BEFORE UPDATE ON project_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 9. Helper Views
-- ========================================

-- View: Active projects with template information
CREATE OR REPLACE VIEW projects_with_templates AS
SELECT
  j.id as project_id,
  j.title as project_title,
  j.homeowner_email,
  j.status as project_status,
  pt.template_name,
  pt.template_type,
  pt.display_name as template_display_name,
  pt.typical_duration_days,
  ps.current_phase,
  ps.current_milestone_id,
  ps.critical_path_status,
  ps.schedule_variance_days,
  ps.last_activity_date,
  (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = j.id) as total_milestones,
  (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = j.id AND pm.status = 'completed') as completed_milestones,
  (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = j.id AND pm.is_blocked = true) as blocked_milestones
FROM job_postings j
LEFT JOIN project_templates pt ON j.template_id = pt.id
LEFT JOIN project_states ps ON j.id = ps.project_id
WHERE j.status IN ('in_progress', 'active');

-- View: Critical Path Analysis
CREATE OR REPLACE VIEW project_critical_path_view AS
SELECT
  pm.project_id,
  j.title as project_title,
  pm.milestone_id,
  pm.milestone_name,
  pm.status,
  pm.planned_start_date,
  pm.planned_end_date,
  pm.actual_start_date,
  pm.actual_end_date,
  pm.is_blocked,
  pm.blocker_reason,
  CASE
    WHEN pm.actual_end_date IS NOT NULL AND pm.planned_end_date IS NOT NULL
    THEN (pm.actual_end_date - pm.planned_end_date)
    ELSE NULL
  END as days_variance,
  tm.is_critical_path,
  pm.depends_on,
  pm.inspection_status
FROM project_milestones pm
JOIN job_postings j ON pm.project_id = j.id
LEFT JOIN template_milestones tm ON pm.template_milestone_id = tm.id
WHERE tm.is_critical_path = true OR pm.is_blocked = true
ORDER BY pm.project_id, pm.milestone_order;

-- View: Inspection Schedule
CREATE OR REPLACE VIEW inspection_schedule_view AS
SELECT
  pm.project_id,
  j.title as project_title,
  j.homeowner_email,
  pm.milestone_id,
  pm.milestone_name,
  pm.inspection_status,
  pm.inspection_scheduled_date,
  tm.inspection_type,
  pm.status as milestone_status,
  pm.inspection_notes,
  j.address as project_address
FROM project_milestones pm
JOIN job_postings j ON pm.project_id = j.id
LEFT JOIN template_milestones tm ON pm.template_milestone_id = tm.id
WHERE pm.requires_inspection = true
  AND pm.inspection_status IN ('pending', 'scheduled', 'failed', 'reinspection_required')
ORDER BY pm.inspection_scheduled_date ASC NULLS LAST;

-- ========================================
-- 10. Recreate active_projects_with_state view
-- This view was dropped earlier to allow current_phase column type change
-- ========================================
CREATE OR REPLACE VIEW active_projects_with_state AS
SELECT
  j.id as project_id,
  j.title as project_title,
  j.homeowner_email,
  ps.current_phase,
  ps.blockers,
  ps.last_activity_date,
  ps.estimated_completion_date,
  (SELECT COUNT(*) FROM project_logs pl WHERE pl.project_id = j.id AND pl.created_at > NOW() - INTERVAL '24 hours') as recent_activity_count
FROM job_postings j
LEFT JOIN project_states ps ON j.id = ps.project_id
WHERE j.status IN ('in_progress', 'active');

-- ========================================
-- Verification
-- ========================================
SELECT 'Project Template Engine tables created successfully!' as status;
SELECT 'Tables created: project_templates, template_milestones, template_trade_requirements, project_milestones' as info;
SELECT 'Tables updated: job_postings (template_id, blueprints_url), project_states (dynamic phases)' as updates;
