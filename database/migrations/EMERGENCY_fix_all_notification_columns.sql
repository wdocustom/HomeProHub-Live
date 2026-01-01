-- EMERGENCY FIX: Add ALL missing notification columns

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_type TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS job_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS bid_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT;
