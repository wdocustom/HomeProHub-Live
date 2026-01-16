-- Seed open projects for testing the contractor opportunity feed
-- Run this to populate the feed with test data

-- Create 3 sample open projects
INSERT INTO public.job_postings (
  title,
  description,
  category,
  address,
  zip_code,
  budget_low,
  budget_high,
  urgency,
  status,
  homeowner_email,
  original_question,
  posted_at
) VALUES
(
  'Kitchen Renovation - New Countertops & Cabinets',
  'Looking to update my kitchen with new granite countertops and refaced cabinets. Kitchen is approximately 12x15 feet. Would like modern white cabinets and dark granite.',
  'general',
  '123 Main Street, San Francisco, CA',
  '94102',
  8000,
  15000,
  'flexible',
  'open',
  'homeowner@example.com',
  'I want to remodel my kitchen with new countertops',
  NOW()
),
(
  'Bathroom Remodel - Shower & Tile Work',
  'Full bathroom remodel needed. Replace old shower/tub combo with walk-in shower. New tile flooring and walls. Modern fixtures. Bathroom is 8x10 feet.',
  'general',
  '456 Oak Avenue, Los Angeles, CA',
  '90001',
  12000,
  20000,
  'soon',
  'open',
  'homeowner@example.com',
  'Need help remodeling my bathroom',
  NOW() - INTERVAL '2 days'
),
(
  'Deck Repair & Staining - Urgent',
  'Existing wood deck needs repairs (some boards rotting) and complete re-staining. Deck is about 400 square feet. Want it done before summer.',
  'general',
  '789 Pine Street, Seattle, WA',
  '98101',
  3000,
  6000,
  'urgent',
  'open',
  'homeowner@example.com',
  'My deck needs repair and staining',
  NOW() - INTERVAL '1 day'
);

-- Verify the insert
DO $$
DECLARE
  open_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO open_count FROM job_postings WHERE status = 'open';
  RAISE NOTICE '✓ Total open projects in database: %', open_count;
END $$;
