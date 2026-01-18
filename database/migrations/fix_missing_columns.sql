-- ========================================
-- Migration: Fix Missing Columns
-- Date: 2026-01-18
-- Purpose: Add missing columns to project_states and notifications tables
-- ========================================

-- ========================================
-- 1. Add missing columns to project_states
-- ========================================

DO $$
BEGIN
  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_states' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE project_states
    ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

    RAISE NOTICE 'Added updated_at column to project_states';
  ELSE
    RAISE NOTICE 'Column updated_at already exists in project_states';
  END IF;

  -- Add estimated_completion_date if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_states' AND column_name = 'estimated_completion_date'
  ) THEN
    ALTER TABLE project_states
    ADD COLUMN estimated_completion_date DATE;

    RAISE NOTICE 'Added estimated_completion_date column to project_states';
  ELSE
    RAISE NOTICE 'Column estimated_completion_date already exists in project_states';
  END IF;

  -- Add actual_start_date if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_states' AND column_name = 'actual_start_date'
  ) THEN
    ALTER TABLE project_states
    ADD COLUMN actual_start_date DATE;

    RAISE NOTICE 'Added actual_start_date column to project_states';
  ELSE
    RAISE NOTICE 'Column actual_start_date already exists in project_states';
  END IF;

  -- Add last_activity_date if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_states' AND column_name = 'last_activity_date'
  ) THEN
    ALTER TABLE project_states
    ADD COLUMN last_activity_date TIMESTAMP WITH TIME ZONE;

    RAISE NOTICE 'Added last_activity_date column to project_states';
  ELSE
    RAISE NOTICE 'Column last_activity_date already exists in project_states';
  END IF;
END $$;

-- ========================================
-- 2. Add missing columns to notifications
-- ========================================

DO $$
BEGIN
  -- Add metadata column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE notifications
    ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;

    RAISE NOTICE 'Added metadata column to notifications';
  ELSE
    RAISE NOTICE 'Column metadata already exists in notifications';
  END IF;
END $$;

-- ========================================
-- 3. Ensure trigger exists for updated_at
-- ========================================

-- Create or replace the update function (idempotent)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create it
DROP TRIGGER IF EXISTS update_project_states_updated_at ON project_states;
CREATE TRIGGER update_project_states_updated_at
  BEFORE UPDATE ON project_states
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- Verification
-- ========================================

SELECT
  'project_states' as table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'project_states'
  AND column_name IN ('updated_at', 'estimated_completion_date', 'actual_start_date', 'last_activity_date', 'blockers', 'agent_logs')
ORDER BY column_name;

SELECT
  'notifications' as table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'notifications'
  AND column_name = 'metadata';

SELECT '✅ Missing columns migration completed successfully!' as status;
