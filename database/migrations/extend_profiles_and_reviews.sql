-- ================================================================
-- EXTENSION: Profile & Review System Enhancements
-- Purpose: Support external reviews, bio, gallery, and public review links
-- ================================================================

-- 1. Extend contractor_profiles table
ALTER TABLE contractor_profiles
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS gallery_urls TEXT[],
ADD COLUMN IF NOT EXISTS review_link_slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS license_document_url TEXT,
ADD COLUMN IF NOT EXISTS insurance_document_url TEXT,
ADD COLUMN IF NOT EXISTS pending_verification BOOLEAN DEFAULT FALSE;

-- Create index for review link lookup
CREATE INDEX IF NOT EXISTS idx_contractor_profiles_review_link_slug
ON contractor_profiles(review_link_slug);

-- 2. Extend client_reviews table for external reviews
ALTER TABLE client_reviews
ADD COLUMN IF NOT EXISTS client_email TEXT,
ADD COLUMN IF NOT EXISTS client_name TEXT,
ADD COLUMN IF NOT EXISTS client_phone TEXT,
ADD COLUMN IF NOT EXISTS proof_document_url TEXT,
ADD COLUMN IF NOT EXISTS is_external_import BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected'));

-- Update constraint to allow external reviews without project_id
ALTER TABLE client_reviews
DROP CONSTRAINT IF EXISTS client_reviews_project_id_fkey;

ALTER TABLE client_reviews
ADD CONSTRAINT client_reviews_project_id_fkey
FOREIGN KEY (project_id)
REFERENCES projects(id)
ON DELETE CASCADE
DEFERRABLE INITIALLY DEFERRED;

-- Make project_id nullable for external imports
ALTER TABLE client_reviews
ALTER COLUMN project_id DROP NOT NULL;

-- 3. Update unique constraint to handle external reviews
ALTER TABLE client_reviews
DROP CONSTRAINT IF EXISTS client_reviews_contractor_id_project_id_key;

-- Add composite unique constraint that handles both platform and external reviews
CREATE UNIQUE INDEX IF NOT EXISTS unique_platform_review
ON client_reviews(contractor_id, project_id)
WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_external_review
ON client_reviews(contractor_id, client_email)
WHERE is_external_import = TRUE;

-- 4. Update RLS policies for external reviews
DROP POLICY IF EXISTS "Contractors can view own reviews" ON client_reviews;
CREATE POLICY "Contractors can view own reviews"
ON client_reviews FOR SELECT
USING (contractor_id = auth.uid());

DROP POLICY IF EXISTS "Contractors can insert reviews" ON client_reviews;
CREATE POLICY "Contractors can insert reviews"
ON client_reviews FOR INSERT
WITH CHECK (contractor_id = auth.uid());

-- 5. Create public review link view (for rate-pro.html)
CREATE OR REPLACE VIEW public_contractor_profiles AS
SELECT
  cp.review_link_slug,
  cp.company_name,
  cp.display_name,
  cp.bio,
  cp.avatar_url,
  cp.gallery_urls,
  cp.license_verified,
  cp.insurance_verified,
  cp.created_at,
  EXTRACT(YEAR FROM cp.created_at) as member_since_year,
  u.email as business_email
FROM contractor_profiles cp
JOIN auth.users u ON cp.user_id = u.id
WHERE cp.review_link_slug IS NOT NULL;

-- Enable RLS on the view
ALTER VIEW public_contractor_profiles SET (security_invoker = true);

-- 6. Comments for documentation
COMMENT ON COLUMN contractor_profiles.bio IS 'Contractor bio displayed on public review page';
COMMENT ON COLUMN contractor_profiles.gallery_urls IS 'Array of portfolio image URLs (max 10)';
COMMENT ON COLUMN contractor_profiles.review_link_slug IS 'Unique slug for public review page (e.g., abc-construction)';
COMMENT ON COLUMN client_reviews.is_external_import IS 'True if review was imported from off-platform work';
COMMENT ON COLUMN client_reviews.proof_document_url IS 'Invoice/contract URL for external review verification';
