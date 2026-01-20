-- ========================================
-- Migration: Schema Synchronization
-- Date: 2026-01-20
-- Purpose: Fix PGRST205 Missing Table Error and Sync Schema
-- ========================================
-- CRITICAL: This migration fixes the Agent Dashboard crash by:
--   1. Creating the missing 'agent_configs' table
--   2. Adding missing columns to 'contractor_profiles'
-- ========================================

-- ========================================
-- 1. Create Agent Configs Table
-- ========================================
CREATE TABLE IF NOT EXISTS agent_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    status TEXT DEFAULT 'active', -- 'active', 'paused', 'learning'
    model TEXT DEFAULT 'gpt-4-turbo',
    temperature NUMERIC DEFAULT 0.7,
    system_prompt TEXT,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 2. Seed Default Agents (if they don't exist)
-- ========================================
INSERT INTO agent_configs (agent_name, role, status, system_prompt)
VALUES
    ('Orchestrator', 'Project Manager', 'active', 'You are the Orchestrator. You manage the project timeline and coordinate other agents.'),
    ('Hawk', 'Lead Scout', 'active', 'You are the Hawk. You find contractors and suppliers.'),
    ('Diplomat', 'Communicator', 'active', 'You are the Diplomat. You handle client and contractor communication.')
ON CONFLICT (agent_name) DO NOTHING;

-- ========================================
-- 3. Fix Contractor Profiles (Add missing columns)
-- ========================================
ALTER TABLE contractor_profiles ADD COLUMN IF NOT EXISTS trade_type TEXT DEFAULT 'General Contractor';
ALTER TABLE contractor_profiles ADD COLUMN IF NOT EXISTS years_experience INTEGER DEFAULT 1;
ALTER TABLE contractor_profiles ADD COLUMN IF NOT EXISTS license_number TEXT;

-- ========================================
-- 4. Verification
-- ========================================
-- Check agent_configs table
SELECT
  'agent_configs' as table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'agent_configs'
ORDER BY ordinal_position;

-- Check contractor_profiles new columns
SELECT
  'contractor_profiles' as table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'contractor_profiles'
  AND column_name IN ('trade_type', 'years_experience', 'license_number')
ORDER BY column_name;

-- Count seeded agents
SELECT COUNT(*) as agent_count, 'Default agents seeded' as message
FROM agent_configs;

SELECT '✅ Schema synchronization completed successfully!' as status;
