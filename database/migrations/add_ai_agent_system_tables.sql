-- ========================================
-- Migration: AI Agent System Tables
-- Date: 2026-01-15
-- Purpose: Add tables to support the Auto-GC AI Agent system
-- ========================================

-- ========================================
-- 1. Project States Table
-- Stores the current state and AI "brain" for each project
-- ========================================
CREATE TABLE IF NOT EXISTS project_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,

  -- Current state tracking
  current_phase TEXT NOT NULL DEFAULT 'planning' CHECK (current_phase IN (
    'planning', 'demo', 'rough_in', 'inspection', 'finish', 'punchlist', 'complete'
  )),

  -- Blockers and issues (JSON array of strings)
  blockers JSONB DEFAULT '[]'::jsonb,

  -- AI agent logs (stores the AI's "thought process" and decisions)
  agent_logs JSONB DEFAULT '[]'::jsonb,

  -- Schedule tracking
  estimated_completion_date DATE,
  actual_start_date DATE,
  last_activity_date TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for project_states
CREATE INDEX IF NOT EXISTS idx_project_states_project ON project_states(project_id);
CREATE INDEX IF NOT EXISTS idx_project_states_phase ON project_states(current_phase);
CREATE INDEX IF NOT EXISTS idx_project_states_activity ON project_states(last_activity_date);

-- Ensure one state per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_states_unique_project
ON project_states(project_id);

-- ========================================
-- 2. Project Logs Table
-- Stores daily activity, contractor updates, and system events
-- ========================================
CREATE TABLE IF NOT EXISTS project_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,

  -- Log entry details
  entry_text TEXT NOT NULL,

  -- Source tracking
  source TEXT NOT NULL CHECK (source IN (
    'contractor_update', 'homeowner_update', 'system_event',
    'ai_agent', 'schedule_change', 'inspection', 'delivery'
  )),

  -- Who created this log
  created_by_email TEXT,
  created_by_name TEXT,

  -- Additional metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Photos/attachments
  photos JSONB DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for project_logs
CREATE INDEX IF NOT EXISTS idx_project_logs_project ON project_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_project_logs_source ON project_logs(source);
CREATE INDEX IF NOT EXISTS idx_project_logs_created_at ON project_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_logs_created_by ON project_logs(created_by_email);

-- ========================================
-- 3. AI Agent Activity Table
-- Tracks AI agent actions and decisions
-- ========================================
CREATE TABLE IF NOT EXISTS ai_agent_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,

  -- Agent type that performed the action
  agent_type TEXT NOT NULL CHECK (agent_type IN (
    'orchestrator', 'visionary', 'hawk', 'whip', 'diplomat', 'summarizer'
  )),

  -- Action details
  action_type TEXT NOT NULL,
  action_description TEXT NOT NULL,
  action_result TEXT,

  -- Input/Output for debugging
  input_data JSONB,
  output_data JSONB,

  -- Status tracking
  status TEXT DEFAULT 'completed' CHECK (status IN (
    'pending', 'in_progress', 'completed', 'failed'
  )),
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for ai_agent_activity
CREATE INDEX IF NOT EXISTS idx_ai_agent_activity_project ON ai_agent_activity(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_activity_type ON ai_agent_activity(agent_type);
CREATE INDEX IF NOT EXISTS idx_ai_agent_activity_status ON ai_agent_activity(status);
CREATE INDEX IF NOT EXISTS idx_ai_agent_activity_created ON ai_agent_activity(created_at DESC);

-- ========================================
-- 4. Update Functions (Auto-update timestamps)
-- ========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for project_states
DROP TRIGGER IF EXISTS update_project_states_updated_at ON project_states;
CREATE TRIGGER update_project_states_updated_at
  BEFORE UPDATE ON project_states
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 5. Helper Views
-- ========================================

-- View to see active projects with their current state
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
SELECT 'AI Agent System tables created successfully!' as status;
