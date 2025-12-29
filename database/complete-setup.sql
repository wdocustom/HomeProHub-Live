-- Complete Database Setup Script
-- Run this FIRST to create all necessary tables and policies

-- ========================================
-- 1. CREATE REVIEWS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  reviewer_email TEXT NOT NULL,
  reviewee_email TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  positive_tags TEXT[] DEFAULT '{}',
  negative_tags TEXT[] DEFAULT '{}',
  review_text TEXT,
  photos TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on reviews table
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.reviews;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.reviews;
DROP POLICY IF EXISTS "Enable update for review owners" ON public.reviews;

-- Create RLS policies for reviews
CREATE POLICY "Enable insert for authenticated users"
ON "public"."reviews"
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable read for authenticated users"
ON "public"."reviews"
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Enable update for review owners"
ON "public"."reviews"
FOR UPDATE
USING (auth.uid()::text = reviewer_email OR auth.uid()::text = reviewee_email);

-- ========================================
-- 2. JOB POSTINGS RLS POLICIES
-- ========================================

-- Enable RLS on job_postings table (if not already enabled)
ALTER TABLE IF EXISTS public.job_postings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow contractors to view open jobs" ON public.job_postings;
DROP POLICY IF EXISTS "Allow homeowners to view their own jobs" ON public.job_postings;
DROP POLICY IF EXISTS "Allow homeowners to insert jobs" ON public.job_postings;
DROP POLICY IF EXISTS "Allow homeowners to update their own jobs" ON public.job_postings;

-- Allow contractors to view open and active jobs
CREATE POLICY "Allow contractors to view open jobs"
ON "public"."job_postings"
FOR SELECT
USING (status IN ('open', 'active'));

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

-- ========================================
-- 3. CONTRACTOR GRADE CALCULATION FUNCTION
-- ========================================

-- Drop existing function if it exists (CASCADE removes dependent views)
DROP FUNCTION IF EXISTS calculate_contractor_grade(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION calculate_contractor_grade(p_contractor_email TEXT)
RETURNS JSON AS $$
DECLARE
  verification_score INTEGER := 0;
  reputation_score INTEGER := 0;
  velocity_score INTEGER := 0;
  profile_score INTEGER := 0;
  total_score INTEGER := 0;
  grade_letter TEXT;
  grade_color TEXT;
  percentile INTEGER := 0;
  review_count INTEGER := 0;
  avg_rating NUMERIC := 0;
  completed_jobs INTEGER := 0;
BEGIN
  -- Get profile completeness (0-100 points)
  SELECT
    CASE WHEN business_name IS NOT NULL THEN 20 ELSE 0 END +
    CASE WHEN phone IS NOT NULL THEN 15 ELSE 0 END +
    CASE WHEN bio IS NOT NULL AND LENGTH(bio) > 50 THEN 20 ELSE 0 END +
    CASE WHEN profile_photo_url IS NOT NULL THEN 15 ELSE 0 END +
    CASE WHEN years_experience IS NOT NULL AND years_experience > 0 THEN 15 ELSE 0 END +
    CASE WHEN service_area IS NOT NULL THEN 15 ELSE 0 END
  INTO profile_score
  FROM user_profiles
  WHERE email = p_contractor_email;

  -- Default to 0 if profile not found
  profile_score := COALESCE(profile_score, 0);

  -- Get verification status (0-100 points)
  SELECT
    CASE
      WHEN COUNT(*) FILTER (WHERE verification_status = 'verified') >= 1 THEN 100
      WHEN COUNT(*) FILTER (WHERE verification_status = 'pending') >= 1 THEN 50
      ELSE 0
    END
  INTO verification_score
  FROM contractor_licenses
  WHERE contractor_email = p_contractor_email;

  -- Default to 0 if no licenses
  verification_score := COALESCE(verification_score, 0);

  -- Get review count and average rating (0-100 points)
  SELECT
    COUNT(*),
    AVG((quality_rating + communication_rating + timeliness_rating + professionalism_rating + value_rating) / 5.0)
  INTO review_count, avg_rating
  FROM contractor_ratings
  WHERE contractor_email = p_contractor_email;

  -- Handle NULL ratings
  review_count := COALESCE(review_count, 0);
  avg_rating := COALESCE(avg_rating, 0);

  -- Calculate reputation score based on reviews
  IF review_count = 0 THEN
    reputation_score := 0;
  ELSE
    -- Base score from rating (0-70 points)
    reputation_score := LEAST(FLOOR((avg_rating / 5.0) * 70), 70);
    -- Bonus for number of reviews (0-30 points)
    reputation_score := reputation_score + LEAST(review_count * 3, 30);
  END IF;

  -- Get completed jobs count (0-100 points)
  SELECT COUNT(*)
  INTO completed_jobs
  FROM contractor_bids
  WHERE contractor_email = p_contractor_email
    AND status = 'accepted';

  completed_jobs := COALESCE(completed_jobs, 0);

  -- Calculate velocity score
  IF completed_jobs = 0 THEN
    velocity_score := 0;
  ELSE
    velocity_score := LEAST(completed_jobs * 10, 100);
  END IF;

  -- Calculate total score (average of all categories)
  total_score := FLOOR((verification_score + reputation_score + velocity_score + profile_score) / 4.0);

  -- Determine grade letter
  IF total_score >= 90 THEN
    grade_letter := 'A';
    grade_color := '#10b981';
  ELSIF total_score >= 80 THEN
    grade_letter := 'B';
    grade_color := '#3b82f6';
  ELSIF total_score >= 70 THEN
    grade_letter := 'C';
    grade_color := '#f59e0b';
  ELSIF total_score >= 60 THEN
    grade_letter := 'D';
    grade_color := '#f97316';
  ELSE
    grade_letter := 'F';
    grade_color := '#ef4444';
  END IF;

  -- Calculate percentile (simplified)
  percentile := GREATEST(total_score - 10, 0);

  -- Return JSON with all data
  RETURN json_build_object(
    'grade', grade_letter,
    'score', total_score,
    'color', grade_color,
    'percentile', percentile,
    'breakdown', json_build_object(
      'verification_score', verification_score,
      'reputation_score', reputation_score,
      'velocity_score', velocity_score,
      'profile_score', profile_score
    ),
    'stats', json_build_object(
      'review_count', review_count,
      'avg_rating', ROUND(avg_rating, 2),
      'completed_jobs', completed_jobs
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION calculate_contractor_grade(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_contractor_grade(TEXT) TO anon;

-- ========================================
-- SETUP COMPLETE
-- ========================================

-- Verify tables exist
DO $$
BEGIN
  RAISE NOTICE 'Setup complete! Verifying tables...';

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reviews') THEN
    RAISE NOTICE '✓ reviews table created';
  ELSE
    RAISE WARNING '✗ reviews table NOT created';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'job_postings') THEN
    RAISE NOTICE '✓ job_postings table exists';
  ELSE
    RAISE WARNING '✗ job_postings table does not exist';
  END IF;

  RAISE NOTICE 'Database setup complete!';
END $$;
