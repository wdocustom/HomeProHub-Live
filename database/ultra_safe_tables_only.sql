-- ULTRA-SAFE: Tables Only (No Triggers/Functions - Run First)
-- Copy to Supabase SQL Editor

CREATE TABLE IF NOT EXISTS project_states (
  project_id UUID PRIMARY KEY REFERENCES job_postings(id) ON DELETE CASCADE,
  current_phase TEXT,
  current_milestone_id TEXT,
  completed_milestones JSONB DEFAULT '[]',
  pending_inspections JSONB DEFAULT '[]',
  schedule_variance_days INTEGER DEFAULT 0,
  critical_path_status TEXT DEFAULT 'on_track',
  last_activity_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
  phases JSONB NOT NULL DEFAULT '[]',
  required_trades JSONB NOT NULL DEFAULT '[]',
  inspection_points JSONB DEFAULT '[]',
  critical_dependencies JSONB DEFAULT '{}',
  deliverables JSONB DEFAULT '[]',
  applicable_codes JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS template_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
  milestone_id TEXT NOT NULL,
  milestone_name TEXT NOT NULL,
  milestone_order INTEGER NOT NULL,
  estimated_duration_days INTEGER NOT NULL DEFAULT 1,
  is_critical_path BOOLEAN DEFAULT false,
  depends_on JSONB DEFAULT '[]',
  requires_inspection BOOLEAN DEFAULT false,
  inspection_type TEXT,
  required_trades JSONB DEFAULT '[]',
  checklist_items JSONB DEFAULT '[]',
  quality_checks JSONB DEFAULT '[]',
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
  status TEXT NOT NULL DEFAULT 'pending',
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  requires_inspection BOOLEAN DEFAULT false,
  inspection_status TEXT,
  inspection_notes TEXT,
  inspection_document_url TEXT,
  depends_on JSONB DEFAULT '[]',
  blocks JSONB DEFAULT '[]',
  progress_percentage INTEGER DEFAULT 0,
  is_blocked BOOLEAN DEFAULT false,
  blocker_reason TEXT,
  blocker_resolved_at TIMESTAMP WITH TIME ZONE,
  assigned_trades JSONB DEFAULT '[]',
  progress_photos JSONB DEFAULT '[]',
  completion_photos JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_milestones_unique ON project_milestones(project_id, milestone_id);

-- Seed
INSERT INTO project_templates (template_name, template_type, display_name, description, typical_duration_days, complexity_level, phases, required_trades) VALUES
('kitchen_remodel', 'remodel', 'Kitchen Remodel', 'Full kitchen', 42, 'moderate', '[]', '[]')
ON CONFLICT DO NOTHING;

SELECT 'Tables Created!';