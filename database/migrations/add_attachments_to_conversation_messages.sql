-- ========================================
-- Migration: Add attachments to conversation_messages
-- Date: 2025-12-26
-- Purpose: Enable file/photo uploads in messaging
-- ========================================

-- Add attachments column to conversation_messages table
ALTER TABLE conversation_messages
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Verify the changes
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'conversation_messages'
  AND column_name = 'attachments';
