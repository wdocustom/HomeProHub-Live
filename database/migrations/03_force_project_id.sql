-- Force add the column safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agent_configs' AND column_name='project_id') THEN
        ALTER TABLE agent_configs ADD COLUMN project_id UUID;
    END IF;
END $$;

-- Update existing NULLs
UPDATE agent_configs SET project_id = NULL WHERE project_id IS NULL;
