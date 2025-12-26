-- ========================================
-- Migration: Add category field to job_postings table
-- Date: 2025-12-26
-- ========================================

-- Add category column to job_postings table
ALTER TABLE job_postings
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';

-- Add index on category field for better query performance
CREATE INDEX IF NOT EXISTS idx_job_postings_category
ON job_postings(category);

-- Update any NULL categories to 'general'
UPDATE job_postings
SET category = 'general'
WHERE category IS NULL;

-- Verify the changes
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'job_postings'
  AND column_name = 'category';
