-- ========================================
-- CRITICAL FIX: Ensure ALL notifications columns exist
-- ========================================

-- Add all missing columns that code expects
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES job_postings(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS bid_id UUID REFERENCES contractor_bids(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message_id UUID REFERENCES messages(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT;

-- Verify all columns exist
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'notifications'
  AND column_name IN ('user_id', 'job_id', 'bid_id', 'message_id', 'action_url')
ORDER BY column_name;
