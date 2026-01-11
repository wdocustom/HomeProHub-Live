-- ========================================
-- Migration: Add action_url column to notifications table
-- Date: 2025-01-01
-- Purpose: Fix "Could not find the 'action_url' column" error
-- ========================================

-- Add action_url column to notifications table if it doesn't exist
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS action_url TEXT;

-- Add index for faster queries on action_url (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_notifications_action_url
ON notifications(action_url) WHERE action_url IS NOT NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'notifications'
  AND column_name = 'action_url';
