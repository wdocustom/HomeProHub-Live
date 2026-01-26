-- ========================================
-- Fix: Update ai_agent_activity constraint to allow correct agent names
-- Date: 2026-01-26
-- Purpose: Allow 'Visionary', 'Shark', 'Whip', 'Sentinel' agent types
-- ========================================

-- Drop the old constraint
ALTER TABLE ai_agent_activity
DROP CONSTRAINT IF EXISTS ai_agent_activity_agent_type_check;

-- Add new constraint with updated agent names
ALTER TABLE ai_agent_activity
ADD CONSTRAINT ai_agent_activity_agent_type_check
CHECK (agent_type IN (
  'Orchestrator', 'Visionary', 'Shark', 'Whip', 'Sentinel', 'Diplomat', 'Summarizer',
  'orchestrator', 'visionary', 'hawk', 'whip', 'diplomat', 'summarizer'
));

SELECT 'AI agent_type constraint updated successfully!' as status;
