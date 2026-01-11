-- Migration: Add Client Reviews System
-- Created: 2026-01-03
-- Purpose: Contractor-to-Homeowner review system with structured data for legal compliance

-- ========================================
-- 1. Client Reviews Table
-- ========================================
CREATE TABLE IF NOT EXISTS client_reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  contractor_id UUID REFERENCES auth.users(id),
  homeowner_id UUID REFERENCES auth.users(id),

  -- The Metrics (1-5 Star Scale)
  rating_payment INT NOT NULL CHECK (rating_payment >= 1 AND rating_payment <= 5), -- Speed of payment
  rating_scope INT NOT NULL CHECK (rating_scope >= 1 AND rating_scope <= 5),       -- Adherence to original plan
  rating_site INT NOT NULL CHECK (rating_site >= 1 AND rating_site <= 5),          -- Site accessibility/cleanliness

  -- The Tags (Pre-defined "Badges")
  tags TEXT[], -- e.g. ['Fast Payer', 'Scope Creep', 'Pet Issue', 'Communicator']

  -- Internal Verification
  is_verified_transaction BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 2. Row Level Security (RLS) Policies
-- ========================================
ALTER TABLE client_reviews ENABLE ROW LEVEL SECURITY;

-- Policy: Contractors can view their own reviews
CREATE POLICY "Contractors can view own reviews"
  ON client_reviews
  FOR SELECT
  USING (auth.uid() = contractor_id);

-- Policy: Contractors can insert reviews for their projects
CREATE POLICY "Contractors can insert reviews"
  ON client_reviews
  FOR INSERT
  WITH CHECK (auth.uid() = contractor_id);

-- Policy: Contractors can update their own reviews
CREATE POLICY "Contractors can update own reviews"
  ON client_reviews
  FOR UPDATE
  USING (auth.uid() = contractor_id);

-- ========================================
-- 3. Homeowner Scores View (Public Aggregate)
-- ========================================
CREATE OR REPLACE VIEW homeowner_scores AS
SELECT
  homeowner_id,
  AVG(rating_payment) as avg_payment,
  AVG(rating_scope) as avg_scope,
  AVG(rating_site) as avg_site,
  COUNT(*) as total_reviews,
  -- Calculate Weighted Score (Max 100)
  -- Payment: 50% weight (10 points per star)
  -- Scope: 30% weight (6 points per star)
  -- Site: 20% weight (4 points per star)
  ROUND((AVG(rating_payment) * 10) + (AVG(rating_scope) * 6) + (AVG(rating_site) * 4), 2) as trust_score,
  -- Calculate letter grade
  CASE
    WHEN ROUND((AVG(rating_payment) * 10) + (AVG(rating_scope) * 6) + (AVG(rating_site) * 4), 2) >= 90 THEN 'A+'
    WHEN ROUND((AVG(rating_payment) * 10) + (AVG(rating_scope) * 6) + (AVG(rating_site) * 4), 2) >= 85 THEN 'A'
    WHEN ROUND((AVG(rating_payment) * 10) + (AVG(rating_scope) * 6) + (AVG(rating_site) * 4), 2) >= 80 THEN 'A-'
    WHEN ROUND((AVG(rating_payment) * 10) + (AVG(rating_scope) * 6) + (AVG(rating_site) * 4), 2) >= 75 THEN 'B+'
    WHEN ROUND((AVG(rating_payment) * 10) + (AVG(rating_scope) * 6) + (AVG(rating_site) * 4), 2) >= 70 THEN 'B'
    WHEN ROUND((AVG(rating_payment) * 10) + (AVG(rating_scope) * 6) + (AVG(rating_site) * 4), 2) >= 65 THEN 'B-'
    WHEN ROUND((AVG(rating_payment) * 10) + (AVG(rating_scope) * 6) + (AVG(rating_site) * 4), 2) >= 60 THEN 'C+'
    WHEN ROUND((AVG(rating_payment) * 10) + (AVG(rating_scope) * 6) + (AVG(rating_site) * 4), 2) >= 55 THEN 'C'
    ELSE 'C-'
  END as grade
FROM client_reviews
WHERE is_verified_transaction = TRUE
GROUP BY homeowner_id;

-- Grant read access to homeowner_scores view (public aggregate data)
GRANT SELECT ON homeowner_scores TO authenticated;
GRANT SELECT ON homeowner_scores TO anon;

-- ========================================
-- 4. Indexes for Performance
-- ========================================
CREATE INDEX IF NOT EXISTS idx_client_reviews_contractor ON client_reviews(contractor_id);
CREATE INDEX IF NOT EXISTS idx_client_reviews_homeowner ON client_reviews(homeowner_id);
CREATE INDEX IF NOT EXISTS idx_client_reviews_project ON client_reviews(project_id);
CREATE INDEX IF NOT EXISTS idx_client_reviews_created ON client_reviews(created_at);

-- GIN index for tag searches
CREATE INDEX IF NOT EXISTS idx_client_reviews_tags ON client_reviews USING GIN(tags);

-- ========================================
-- 5. Updated_at Trigger
-- ========================================
CREATE TRIGGER update_client_reviews_updated_at
  BEFORE UPDATE ON client_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 6. Prevent Duplicate Reviews
-- ========================================
-- Ensure one review per contractor per project
CREATE UNIQUE INDEX idx_one_review_per_project
  ON client_reviews(contractor_id, project_id);

-- ========================================
-- 7. Tag Analysis Helper View
-- ========================================
-- View to see most common tags for a homeowner
CREATE OR REPLACE VIEW homeowner_tag_summary AS
SELECT
  homeowner_id,
  unnest(tags) as tag,
  COUNT(*) as tag_count
FROM client_reviews
WHERE is_verified_transaction = TRUE
GROUP BY homeowner_id, tag
ORDER BY homeowner_id, tag_count DESC;

GRANT SELECT ON homeowner_tag_summary TO authenticated;
