-- SAFE Auto-GC Database Setup (Fixes all migration errors)
-- Run this in Supabase SQL Editor

-- 1. CREATE project_states (missing table)
CREATE TABLE IF NOT EXISTS project_states (
  project_id UUID PRIMARY KEY REFERENCES job_postings(id) ON DELETE CASCADE,
  current_phase TEXT,
  current_milestone_id TEXT,
  completed_milestones JSONB DEFAULT '[]'::jsonb,
  pending_inspections JSONB DEFAULT '[]'::jsonb,
  schedule_variance_days INTEGER DEFAULT 0,
  critical_path_status TEXT DEFAULT 'on_track' CHECK (critical_path_status IN ('on_track', 'at_risk', 'delayed', 'ahead')),
  last_activity_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CREATE project_templates table
CREATE TABLE IF NOT EXISTS project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL UNIQUE,
  template_type TEXT NOT NULL CHECK (template_type IN ('new_construction', 'addition', 'remodel', 'repair', 'custom')),
  display_name TEXT NOT NULL,
  description TEXT,
  typical_duration_days INTEGER,
  complexity_level TEXT CHECK (complexity_level IN ('simple', 'moderate', 'complex', 'very_complex')),
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

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ language 'plpgsql';

CREATE TRIGGER update_project_templates_updated_at BEFORE UPDATE ON project_templates FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 3. CREATE other Auto-GC tables (template_milestones, project_milestones)
CREATE TABLE IF NOT EXISTS template_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
  milestone_id TEXT NOT NULL,
  milestone_name TEXT NOT NULL,
  milestone_order INTEGER NOT NULL,
  estimated_duration_days INTEGER NOT NULL DEFAULT 1,
  is_critical_path BOOLEAN DEFAULT false,
  depends_on JSONB DEFAULT '[]'::jsonb,
  requires_inspection BOOLEAN DEFAULT false,
  inspection_type TEXT,
  required_trades JSONB DEFAULT '[]'::jsonb,
  checklist_items JSONB DEFAULT '[]'::jsonb,
  quality_checks JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_template_milestones_unique ON template_milestones(template_id, milestone_id);

CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  template_milestone_id UUID REFERENCES template_milestones(id) ON DELETE SET NULL,
  milestone_id TEXT NOT NULL,
  milestone_name TEXT NOT NULL,
  milestone_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'inspection_pending', 'inspection_passed', 'inspection_failed', 'completed', 'blocked', 'skipped')),
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  requires_inspection BOOLEAN DEFAULT false,
  inspection_status TEXT CHECK (inspection_status IN ('not_required', 'pending', 'scheduled', 'passed', 'failed', 'reinspection_required')),
  inspection_notes TEXT,
  inspection_document_url TEXT,
  depends_on JSONB DEFAULT '[]'::jsonb,
  blocks JSONB DEFAULT '[]'::jsonb,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  is_blocked BOOLEAN DEFAULT false,
  blocker_reason TEXT,
  blocker_resolved_at TIMESTAMP WITH TIME ZONE,
  assigned_trades JSONB DEFAULT '[]'::jsonb,
  progress_photos JSONB DEFAULT '[]'::jsonb,
  completion_photos JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_project_milestones_updated_at BEFORE UPDATE ON project_milestones FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_milestones_unique ON project_milestones(project_id, milestone_id);

-- 4. SEED TEMPLATES (abbreviated - add full from seed_project_templates.sql)
INSERT INTO project_templates (template_name, template_type, display_name, description, typical_duration_days, complexity_level, phases, required_trades) VALUES
('kitchen_remodel', 'remodel', 'Kitchen Remodel', 'Full kitchen renovation', 42, 'moderate', '[{"phase_id": "demo", "phase_name": "Demolition", "order": 1}]'::jsonb, '["plumbing", "electrical"]'::jsonb),
('new_home', 'new_construction', 'New Custom Home', 'Ground-up construction', 270, 'very_complex', '[{"phase_id": "foundation", "phase_name": "Foundation", "order": 1}]'::jsonb, '["concrete", "framing"]'::jsonb)
ON CONFLICT (template_name) DO NOTHING;

-- 5. FIXED GRADE FUNCTION (already edited)
-- Paste the full fixed contractor-grade-function.sql content here

-- 6. Verify
SELECT 'Auto-GC Setup Complete!' as status;
SELECT COUNT(*) as templates FROM project_templates;
