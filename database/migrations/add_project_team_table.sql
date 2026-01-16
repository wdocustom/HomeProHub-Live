-- ========================================
-- Migration: Add project_team table for Sub-Hunter feature
-- Date: 2026-01-01
-- Purpose: Track team members (GC + Subs) assigned to projects
-- ========================================

-- Create project_team table
CREATE TABLE IF NOT EXISTS project_team (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  contractor_email TEXT NOT NULL,
  contractor_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('lead_contractor', 'subcontractor')),
  trade_type TEXT, -- plumbing, electrical, hvac, etc.
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined')),
  invited_by TEXT, -- email of GC who invited them
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_project_team_job ON project_team(job_id);
CREATE INDEX IF NOT EXISTS idx_project_team_contractor ON project_team(contractor_email);
CREATE INDEX IF NOT EXISTS idx_project_team_status ON project_team(status);
CREATE INDEX IF NOT EXISTS idx_project_team_trade ON project_team(trade_type);

-- Unique constraint: one role per contractor per job
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_team_unique
ON project_team(job_id, contractor_email);

-- Verify table was created
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'project_team'
ORDER BY ordinal_position;
