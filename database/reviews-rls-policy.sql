-- RLS Policy for Reviews Table
-- Fix for "Failed to submit review" error

-- Create reviews table if it doesn't exist
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

-- Enable insert for authenticated users
CREATE POLICY "Enable insert for authenticated users"
ON "public"."reviews"
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Enable read for authenticated users (so they can see their own reviews)
CREATE POLICY "Enable read for authenticated users"
ON "public"."reviews"
FOR SELECT
USING (auth.role() = 'authenticated');

-- Enable update for review owners (so they can edit their reviews)
CREATE POLICY "Enable update for review owners"
ON "public"."reviews"
FOR UPDATE
USING (auth.uid()::text = reviewer_email OR auth.uid()::text = reviewee_email);
