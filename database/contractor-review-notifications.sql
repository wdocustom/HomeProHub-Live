-- Create notifications table for contractor review reminders
-- This triggers when a homeowner completes a project

-- Drop table if exists (for clean migrations)
DROP TABLE IF EXISTS public.notifications CASCADE;

CREATE TABLE public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  type TEXT NOT NULL, -- 'review_request', 'bid_accepted', 'project_complete', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_url TEXT,
  link_text TEXT,
  project_id UUID REFERENCES job_postings(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_email ON notifications(user_email);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid()::text = user_email);

CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid()::text = user_email);

-- Grant permissions
GRANT SELECT, UPDATE ON notifications TO authenticated;

-- Create contractor_homeowner_ratings table (contractors rating homeowners)
DROP TABLE IF EXISTS public.contractor_homeowner_ratings CASCADE;

CREATE TABLE public.contractor_homeowner_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  contractor_email TEXT NOT NULL,
  homeowner_email TEXT NOT NULL,

  -- Rating (1-5 stars)
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),

  -- Positive tags
  positive_tags TEXT[] DEFAULT '{}',

  -- Negative tags
  negative_tags TEXT[] DEFAULT '{}',

  -- Optional review text
  review_text TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one rating per project per contractor
  UNIQUE(project_id, contractor_email)
);

-- Enable RLS
ALTER TABLE public.contractor_homeowner_ratings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Contractors can insert ratings" ON public.contractor_homeowner_ratings;
DROP POLICY IF EXISTS "Anyone can read ratings" ON public.contractor_homeowner_ratings;

-- Policies
CREATE POLICY "Contractors can insert ratings"
ON public.contractor_homeowner_ratings
FOR INSERT
WITH CHECK (auth.uid()::text = contractor_email);

CREATE POLICY "Anyone can read ratings"
ON public.contractor_homeowner_ratings
FOR SELECT
USING (true);

-- Grant permissions
GRANT SELECT, INSERT ON contractor_homeowner_ratings TO authenticated;

-- Verify tables created
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    RAISE NOTICE '✓ notifications table created successfully';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contractor_homeowner_ratings') THEN
    RAISE NOTICE '✓ contractor_homeowner_ratings table created successfully';
  END IF;
END $$;
