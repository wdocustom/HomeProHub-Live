-- RLS Policy for Job Postings (Projects) Table
-- Fix for contractor opportunity feed "Unable to Load" error

-- Enable RLS on job_postings table
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow contractors to view open jobs" ON public.job_postings;
DROP POLICY IF EXISTS "Allow homeowners to view their own jobs" ON public.job_postings;
DROP POLICY IF EXISTS "Allow homeowners to insert jobs" ON public.job_postings;
DROP POLICY IF EXISTS "Allow homeowners to update their own jobs" ON public.job_postings;

-- Allow contractors to view open jobs
CREATE POLICY "Allow contractors to view open jobs"
ON "public"."job_postings"
FOR SELECT
USING (status = 'open');

-- Allow homeowners to view their own jobs (all statuses)
CREATE POLICY "Allow homeowners to view their own jobs"
ON "public"."job_postings"
FOR SELECT
USING (auth.uid()::text = homeowner_email);

-- Allow homeowners to insert their own jobs
CREATE POLICY "Allow homeowners to insert jobs"
ON "public"."job_postings"
FOR INSERT
WITH CHECK (auth.uid()::text = homeowner_email);

-- Allow homeowners to update their own jobs
CREATE POLICY "Allow homeowners to update their own jobs"
ON "public"."job_postings"
FOR UPDATE
USING (auth.uid()::text = homeowner_email);
