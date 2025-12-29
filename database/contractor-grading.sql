-- ========================================
-- Contractor Grading & Directory System
-- ========================================
-- This adds grading calculations and directory views

-- ========================================
-- 1. Contractor Ratings Table (for reviews)
-- ========================================
CREATE TABLE IF NOT EXISTS contractor_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_email TEXT NOT NULL,
  contractor_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Reviewer (homeowner)
  homeowner_email TEXT NOT NULL,
  homeowner_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  job_id UUID, -- References job_postings(id) if rating is for a completed job

  -- Rating scores (1-5)
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  timeliness_rating INTEGER CHECK (timeliness_rating >= 1 AND timeliness_rating <= 5),
  professionalism_rating INTEGER CHECK (professionalism_rating >= 1 AND professionalism_rating <= 5),
  value_rating INTEGER CHECK (value_rating >= 1 AND value_rating <= 5),

  -- Review text
  review_title TEXT,
  review_text TEXT,

  -- Would recommend
  would_recommend BOOLEAN DEFAULT true,

  -- Verification
  verified_job BOOLEAN DEFAULT false, -- True if this was a completed job through the platform

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contractor_ratings_contractor ON contractor_ratings(contractor_email);
CREATE INDEX IF NOT EXISTS idx_contractor_ratings_contractor_id ON contractor_ratings(contractor_id);
CREATE INDEX IF NOT EXISTS idx_contractor_ratings_homeowner ON contractor_ratings(homeowner_email);
CREATE INDEX IF NOT EXISTS idx_contractor_ratings_job ON contractor_ratings(job_id);

-- ========================================
-- 2. Contractor Grade Calculation Function
-- ========================================
CREATE OR REPLACE FUNCTION calculate_contractor_grade(p_contractor_email TEXT)
RETURNS JSONB AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
  v_license contractor_licenses%ROWTYPE;
  v_rating_avg NUMERIC;
  v_rating_count INTEGER;

  -- Score components (0-100 scale)
  v_profile_score NUMERIC := 0;
  v_license_score NUMERIC := 0;
  v_review_score NUMERIC := 0;

  -- Weighted total
  v_total_score NUMERIC := 0;
  v_letter_grade TEXT;
  v_grade_color TEXT;
BEGIN
  -- Get contractor profile
  SELECT * INTO v_profile
  FROM user_profiles
  WHERE email = p_contractor_email AND role = 'contractor';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'grade', 'N/A',
      'score', 0,
      'message', 'Contractor not found'
    );
  END IF;

  -- ========================================
  -- PROFILE COMPLETENESS SCORE (40% weight)
  -- ========================================
  v_profile_score := 0;

  -- Basic info (10 points each)
  IF v_profile.company_name IS NOT NULL OR v_profile.business_name IS NOT NULL THEN
    v_profile_score := v_profile_score + 10;
  END IF;

  IF v_profile.phone IS NOT NULL THEN
    v_profile_score := v_profile_score + 10;
  END IF;

  IF v_profile.trade IS NOT NULL THEN
    v_profile_score := v_profile_score + 10;
  END IF;

  IF v_profile.years_in_business IS NOT NULL AND v_profile.years_in_business > 0 THEN
    v_profile_score := v_profile_score + 10;
  END IF;

  -- Location info (10 points)
  IF v_profile.city IS NOT NULL AND v_profile.state IS NOT NULL AND v_profile.zip_code IS NOT NULL THEN
    v_profile_score := v_profile_score + 10;
  END IF;

  -- Profile completion flag (20 points)
  IF v_profile.profile_complete = true THEN
    v_profile_score := v_profile_score + 20;
  END IF;

  -- Social media presence (5 points each, max 30)
  IF v_profile.instagram_url IS NOT NULL THEN
    v_profile_score := v_profile_score + 5;
  END IF;
  IF v_profile.facebook_url IS NOT NULL THEN
    v_profile_score := v_profile_score + 5;
  END IF;
  IF v_profile.youtube_url IS NOT NULL THEN
    v_profile_score := v_profile_score + 5;
  END IF;

  -- Cap profile score at 100
  v_profile_score := LEAST(v_profile_score, 100);

  -- ========================================
  -- LICENSE VERIFICATION SCORE (30% weight)
  -- ========================================
  v_license_score := 0;

  -- Get most recent verified license
  SELECT * INTO v_license
  FROM contractor_licenses
  WHERE contractor_email = p_contractor_email
    AND verification_status = 'verified'
    AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
  ORDER BY verified_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- Has verified license (80 points base)
    v_license_score := 80;

    -- Bonus for active unexpired license (20 points)
    IF v_license.expiration_date IS NOT NULL AND v_license.expiration_date > CURRENT_DATE THEN
      v_license_score := 100;
    END IF;
  ELSE
    -- Check if they have a pending license
    SELECT * INTO v_license
    FROM contractor_licenses
    WHERE contractor_email = p_contractor_email
      AND verification_status = 'pending'
    LIMIT 1;

    IF FOUND THEN
      v_license_score := 30; -- Pending verification
    ELSE
      v_license_score := 0; -- No license at all
    END IF;
  END IF;

  -- ========================================
  -- REVIEW SCORE (30% weight)
  -- ========================================
  v_review_score := 0;

  -- Get average rating and count
  SELECT
    COUNT(*),
    AVG((quality_rating + communication_rating + timeliness_rating + professionalism_rating + value_rating) / 5.0)
  INTO v_rating_count, v_rating_avg
  FROM contractor_ratings
  WHERE contractor_email = p_contractor_email;

  IF v_rating_count > 0 AND v_rating_avg IS NOT NULL THEN
    -- Convert 1-5 rating to 0-100 score
    v_review_score := (v_rating_avg - 1) * 25; -- 1=0, 5=100

    -- Bonus for having multiple reviews (up to 10 bonus points)
    v_review_score := v_review_score + LEAST(v_rating_count * 2, 10);

    -- Cap at 100
    v_review_score := LEAST(v_review_score, 100);
  ELSE
    -- No reviews yet - use neutral score
    v_review_score := 50;
  END IF;

  -- ========================================
  -- CALCULATE WEIGHTED TOTAL
  -- ========================================
  v_total_score :=
    (v_profile_score * 0.40) +  -- 40% profile completeness
    (v_license_score * 0.30) +  -- 30% license verification
    (v_review_score * 0.30);    -- 30% reviews

  -- Determine letter grade
  IF v_total_score >= 90 THEN
    v_letter_grade := 'A+';
    v_grade_color := '#10b981'; -- Green
  ELSIF v_total_score >= 85 THEN
    v_letter_grade := 'A';
    v_grade_color := '#10b981';
  ELSIF v_total_score >= 80 THEN
    v_letter_grade := 'A-';
    v_grade_color := '#10b981';
  ELSIF v_total_score >= 75 THEN
    v_letter_grade := 'B+';
    v_grade_color := '#3b82f6'; -- Blue
  ELSIF v_total_score >= 70 THEN
    v_letter_grade := 'B';
    v_grade_color := '#3b82f6';
  ELSIF v_total_score >= 65 THEN
    v_letter_grade := 'B-';
    v_grade_color := '#3b82f6';
  ELSIF v_total_score >= 60 THEN
    v_letter_grade := 'C+';
    v_grade_color := '#f59e0b'; -- Yellow/Orange
  ELSIF v_total_score >= 55 THEN
    v_letter_grade := 'C';
    v_grade_color := '#f59e0b';
  ELSIF v_total_score >= 50 THEN
    v_letter_grade := 'C-';
    v_grade_color := '#f59e0b';
  ELSIF v_total_score >= 40 THEN
    v_letter_grade := 'D';
    v_grade_color := '#f97316'; -- Dark orange
  ELSE
    v_letter_grade := 'F';
    v_grade_color := '#ef4444'; -- Red
  END IF;

  -- Return detailed grade breakdown
  RETURN jsonb_build_object(
    'grade', v_letter_grade,
    'score', ROUND(v_total_score, 1),
    'color', v_grade_color,
    'breakdown', jsonb_build_object(
      'profile_score', ROUND(v_profile_score, 1),
      'license_score', ROUND(v_license_score, 1),
      'review_score', ROUND(v_review_score, 1)
    ),
    'details', jsonb_build_object(
      'has_verified_license', (v_license.verification_status = 'verified'),
      'review_count', COALESCE(v_rating_count, 0),
      'average_rating', ROUND(COALESCE(v_rating_avg, 0), 2),
      'profile_complete', v_profile.profile_complete
    )
  );
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 3. Contractor Directory View
-- ========================================
CREATE OR REPLACE VIEW contractor_directory_view AS
SELECT
  up.id,
  up.email,
  COALESCE(up.company_name, up.business_name, up.full_name) as contractor_name,
  up.trade,
  up.years_in_business,
  up.city,
  up.state,
  up.zip_code,
  up.phone,
  up.profile_complete,

  -- License info
  cl.verification_status as license_status,
  cl.trade_type as licensed_trade,
  cl.state as license_state,

  -- Ratings
  COUNT(DISTINCT cr.id) as review_count,
  ROUND(AVG((cr.quality_rating + cr.communication_rating + cr.timeliness_rating +
             cr.professionalism_rating + cr.value_rating) / 5.0), 2) as average_rating,

  -- Calculate grade (stored as text for view)
  calculate_contractor_grade(up.email)->>'grade' as grade,
  (calculate_contractor_grade(up.email)->>'score')::numeric as grade_score,
  calculate_contractor_grade(up.email)->>'color' as grade_color,

  -- Social media
  up.instagram_url,
  up.facebook_url,
  up.youtube_url,

  -- Timestamps
  up.created_at,
  up.updated_at

FROM user_profiles up
LEFT JOIN contractor_licenses cl ON up.email = cl.contractor_email
  AND cl.verification_status = 'verified'
  AND (cl.expiration_date IS NULL OR cl.expiration_date > CURRENT_DATE)
LEFT JOIN contractor_ratings cr ON up.email = cr.contractor_email

WHERE up.role = 'contractor'
  AND up.profile_complete = true

GROUP BY
  up.id, up.email, up.company_name, up.business_name, up.full_name,
  up.trade, up.years_in_business, up.city, up.state, up.zip_code,
  up.phone, up.profile_complete, cl.verification_status, cl.trade_type,
  cl.state, up.instagram_url, up.facebook_url, up.youtube_url,
  up.created_at, up.updated_at;

-- ========================================
-- 4. Distance Calculation Function
-- ========================================
-- Calculate distance between two ZIP codes (simplified - uses lat/long if available)
-- For production, integrate with a ZIP code geocoding service

CREATE OR REPLACE FUNCTION calculate_distance_miles(
  from_zip TEXT,
  to_zip TEXT
) RETURNS NUMERIC AS $$
BEGIN
  -- Placeholder: return random distance for now
  -- In production, integrate with ZIP code database or geocoding API
  -- This would query a zip_codes table with lat/long

  IF from_zip = to_zip THEN
    RETURN 0;
  ELSE
    -- Return mock distance (1-50 miles)
    RETURN FLOOR(RANDOM() * 50 + 1);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 5. Triggers
-- ========================================
DROP TRIGGER IF EXISTS update_contractor_ratings_updated_at ON contractor_ratings;
CREATE TRIGGER update_contractor_ratings_updated_at
  BEFORE UPDATE ON contractor_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
