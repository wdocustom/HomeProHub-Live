-- Migration: Add ai_scope_data column to job_postings table
-- Purpose: Store full AI-generated project data (estimates, scope breakdown, etc.)
-- Date: 2026-01-24

-- Add ai_scope_data JSONB column to job_postings table
ALTER TABLE job_postings
ADD COLUMN IF NOT EXISTS ai_scope_data JSONB;

-- Create index on ai_scope_data for faster queries
CREATE INDEX IF NOT EXISTS idx_job_postings_ai_scope_data
ON job_postings USING GIN (ai_scope_data);

-- Add comment to explain the column
COMMENT ON COLUMN job_postings.ai_scope_data IS 'Stores full AI-generated project data including estimates, scope breakdown, work packages, and pricing details from /api/projects/analyze';
