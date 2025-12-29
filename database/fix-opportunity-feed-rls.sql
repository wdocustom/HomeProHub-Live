-- Fix RLS Policy for Contractor Opportunity Feed
-- Ensure contractors can view ALL open jobs
-- NOTE: Schema uses 'open' status, not 'active'!

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Allow contractors to view open jobs" ON public.job_postings;
DROP POLICY IF EXISTS "Contractors can view ALL open projects" ON public.job_postings;
DROP POLICY IF EXISTS "Contractors can view all open and active jobs" ON public.job_postings;

-- Create permissive policy for contractors to view any open job
CREATE POLICY "Contractors can view all open jobs"
ON public.job_postings
FOR SELECT
TO authenticated
USING (status = 'open');

-- Verify the policy was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'job_postings'
    AND policyname = 'Contractors can view all open jobs'
  ) THEN
    RAISE NOTICE '✓ RLS Policy created successfully - contractors can now view all open jobs';
  ELSE
    RAISE WARNING '✗ Failed to create RLS policy';
  END IF;
END $$;
