-- Add AI feature flags to user_profiles
-- This enables phased rollout and user-level AI control

-- Add AI preferences columns to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS ai_beta_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_enrolled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_automation_mode TEXT CHECK (ai_automation_mode IN ('manual', 'assisted', 'automatic')) DEFAULT 'assisted';

-- Add project-level AI tracking
ALTER TABLE job_postings
ADD COLUMN IF NOT EXISTS ai_initialized BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_initialized_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_initialization_mode TEXT; -- 'auto' or 'manual'

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_ai_beta ON user_profiles(ai_beta_enabled) WHERE ai_beta_enabled = true;
CREATE INDEX IF NOT EXISTS idx_job_postings_ai_initialized ON job_postings(ai_initialized) WHERE ai_initialized = true;

-- Comments for documentation
COMMENT ON COLUMN user_profiles.ai_beta_enabled IS 'User has opted into AI beta program';
COMMENT ON COLUMN user_profiles.ai_enrolled_at IS 'When user enrolled in AI beta';
COMMENT ON COLUMN user_profiles.ai_automation_mode IS 'Level of AI automation: manual, assisted, or automatic';
COMMENT ON COLUMN job_postings.ai_initialized IS 'Whether AI Command Center has been initialized for this project';
COMMENT ON COLUMN job_postings.ai_initialized_at IS 'When AI was initialized';
COMMENT ON COLUMN job_postings.ai_initialization_mode IS 'How AI was initialized: auto or manual';
