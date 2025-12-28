-- RLS Policy for Reviews Table
-- Fix for "Failed to submit review" error

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
