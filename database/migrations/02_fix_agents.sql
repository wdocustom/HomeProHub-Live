-- Migration 02: Fix Agent Configs Schema
-- Adds missing project_id column to agent_configs table
-- This allows agents to be scoped to specific projects

-- Add project_id column if it doesn't exist
ALTER TABLE agent_configs ADD COLUMN IF NOT EXISTS project_id UUID;

-- Add foreign key constraint to link agents to projects
-- Use ON DELETE CASCADE so agents are removed when projects are deleted
ALTER TABLE agent_configs
DROP CONSTRAINT IF EXISTS agent_configs_project_id_fkey;

ALTER TABLE agent_configs
ADD CONSTRAINT agent_configs_project_id_fkey
FOREIGN KEY (project_id)
REFERENCES job_postings(id)
ON DELETE CASCADE;

-- Create index on project_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_agent_configs_project_id ON agent_configs(project_id);

-- Add other missing columns for complete schema alignment
ALTER TABLE agent_configs ADD COLUMN IF NOT EXISTS config_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE agent_configs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE agent_configs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Ensure we have a default/template set for new projects (global templates have NULL project_id)
UPDATE agent_configs SET project_id = NULL WHERE project_id IS NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 02 completed: agent_configs.project_id column added';
END $$;
