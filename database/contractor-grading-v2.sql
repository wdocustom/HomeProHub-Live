-- ========================================
-- Updated Contractor Grading Function
-- New Weighted Formula:
-- 40% Verification (License + Insurance)
-- 35% Reputation (Star Rating + Job Completion Rate)
-- 15% Velocity (Avg Response Time)
-- 10% Profile (Photos + Bio)
-- ========================================

CREATE OR REPLACE FUNCTION calculate_contractor_grade(p_contractor_email TEXT)
RETURNS JSONB AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
  v_license contractor_licenses%ROWTYPE;
  v_rating_avg NUMERIC;
  v_rating_count INTEGER;
  v_completed_jobs INTEGER;
  v_total_jobs INTEGER;
  v_avg_response_hours NUMERIC;

  -- Score components (0-100 scale)
  v_verification_score NUMERIC := 0;
  v_reputation_score NUMERIC := 0;
  v_velocity_score NUMERIC := 0;
  v_profile_score NUMERIC := 0;

  -- Weighted total
  v_total_score NUMERIC := 0;
  v_letter_grade TEXT;
  v_grade_color TEXT;
  v_percentile TEXT;
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
  -- VERIFICATION SCORE (40% weight)
  -- License + Insurance Proof
  -- ========================================
  v_verification_score := 0;

  -- License verification (70 points of the 100)
  SELECT * INTO v_license
  FROM contractor_licenses
  WHERE contractor_email = p_contractor_email
    AND verification_status = 'verified'
    AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
  ORDER BY verified_at DESC
  LIMIT 1;

  IF FOUND THEN
    v_verification_score := 70; -- Has verified license
  ELSE
    -- Check for pending license
    SELECT * INTO v_license
    FROM contractor_licenses
    WHERE contractor_email = p_contractor_email
      AND verification_status = 'pending'
    LIMIT 1;

    IF FOUND THEN
      v_verification_score := 20; -- Pending verification
    ELSE
      v_verification_score := 0; -- No license
    END IF;
  END IF;

  -- Insurance proof (30 points of the 100)
  IF v_profile.insurance_verified = true THEN
    v_verification_score := v_verification_score + 30;
  END IF;

  -- ========================================
  -- REPUTATION SCORE (35% weight)
  -- Star Rating + Job Completion Rate
  -- ========================================
  v_reputation_score := 0;

  -- Get average rating (50 points of 100)
  SELECT
    COUNT(*),
    AVG((quality_rating + communication_rating + timeliness_rating + professionalism_rating + value_rating) / 5.0)
  INTO v_rating_count, v_rating_avg
  FROM contractor_ratings
  WHERE contractor_email = p_contractor_email;

  IF v_rating_count > 0 AND v_rating_avg IS NOT NULL THEN
    -- Convert 1-5 rating to 0-50 score
    v_reputation_score := (v_rating_avg - 1) * 12.5; -- 1=0, 5=50

    -- Bonus for having multiple reviews (up to 10 bonus points)
    v_reputation_score := v_reputation_score + LEAST(v_rating_count * 2, 10);
  ELSE
    -- No reviews yet - start at 25 (neutral)
    v_reputation_score := 25;
  END IF;

  -- Job completion rate (40 points of 100)
  SELECT
    COUNT(CASE WHEN status = 'completed' THEN 1 END),
    COUNT(*)
  INTO v_completed_jobs, v_total_jobs
  FROM bids b
  WHERE b.contractor_email = p_contractor_email
    AND b.accepted_at IS NOT NULL;

  IF v_total_jobs > 0 THEN
    v_reputation_score := v_reputation_score + ((v_completed_jobs::NUMERIC / v_total_jobs::NUMERIC) * 40);
  END IF;

  -- Cap at 100
  v_reputation_score := LEAST(v_reputation_score, 100);

  -- ========================================
  -- VELOCITY SCORE (15% weight)
  -- Average Response Time to Messages
  -- ========================================
  v_velocity_score := 50; -- Start at neutral

  -- Calculate average response time in hours
  SELECT AVG(EXTRACT(EPOCH FROM (response_time - message_time))/3600)
  INTO v_avg_response_hours
  FROM (
    SELECT
      m1.created_at as message_time,
      MIN(m2.created_at) as response_time
    FROM messages m1
    LEFT JOIN messages m2 ON m2.conversation_id = m1.conversation_id
      AND m2.sender_email = p_contractor_email
      AND m2.created_at > m1.created_at
    WHERE m1.conversation_id IN (
      SELECT id FROM conversations
      WHERE contractor_email = p_contractor_email
    )
    AND m1.sender_email != p_contractor_email
    GROUP BY m1.id, m1.created_at
  ) response_times
  WHERE response_time IS NOT NULL;

  IF v_avg_response_hours IS NOT NULL THEN
    -- Score based on response time:
    -- < 1 hour = 100 points
    -- 1-2 hours = 90 points
    -- 2-4 hours = 75 points
    -- 4-8 hours = 60 points
    -- 8-24 hours = 40 points
    -- > 24 hours = 20 points
    IF v_avg_response_hours < 1 THEN
      v_velocity_score := 100;
    ELSIF v_avg_response_hours < 2 THEN
      v_velocity_score := 90;
    ELSIF v_avg_response_hours < 4 THEN
      v_velocity_score := 75;
    ELSIF v_avg_response_hours < 8 THEN
      v_velocity_score := 60;
    ELSIF v_avg_response_hours < 24 THEN
      v_velocity_score := 40;
    ELSE
      v_velocity_score := 20;
    END IF;
  END IF;

  -- ========================================
  -- PROFILE SCORE (10% weight)
  -- Photos + Bio
  -- ========================================
  v_profile_score := 0;

  -- Bio/Description (40 points)
  IF v_profile.bio IS NOT NULL AND LENGTH(v_profile.bio) > 50 THEN
    v_profile_score := v_profile_score + 40;
  ELSIF v_profile.bio IS NOT NULL THEN
    v_profile_score := v_profile_score + 20;
  END IF;

  -- Profile photo (30 points)
  IF v_profile.profile_photo_url IS NOT NULL THEN
    v_profile_score := v_profile_score + 30;
  END IF;

  -- Portfolio photos (30 points)
  IF v_profile.portfolio_photos IS NOT NULL AND jsonb_array_length(v_profile.portfolio_photos) > 0 THEN
    v_profile_score := v_profile_score + 30;
  END IF;

  -- Cap at 100
  v_profile_score := LEAST(v_profile_score, 100);

  -- ========================================
  -- CALCULATE WEIGHTED TOTAL
  -- ========================================
  v_total_score :=
    (v_verification_score * 0.40) +  -- 40% verification
    (v_reputation_score * 0.35) +     -- 35% reputation
    (v_velocity_score * 0.15) +       -- 15% velocity
    (v_profile_score * 0.10);         -- 10% profile

  -- Determine letter grade
  IF v_total_score >= 93 THEN
    v_letter_grade := 'A+';
    v_grade_color := '#10b981';
    v_percentile := 'Top 5%';
  ELSIF v_total_score >= 90 THEN
    v_letter_grade := 'A';
    v_grade_color := '#10b981';
    v_percentile := 'Top 10%';
  ELSIF v_total_score >= 87 THEN
    v_letter_grade := 'A-';
    v_grade_color := '#10b981';
    v_percentile := 'Top 15%';
  ELSIF v_total_score >= 83 THEN
    v_letter_grade := 'B+';
    v_grade_color := '#3b82f6';
    v_percentile := 'Top 25%';
  ELSIF v_total_score >= 80 THEN
    v_letter_grade := 'B';
    v_grade_color := '#3b82f6';
    v_percentile := 'Top 35%';
  ELSIF v_total_score >= 77 THEN
    v_letter_grade := 'B-';
    v_grade_color := '#3b82f6';
    v_percentile := 'Top 45%';
  ELSIF v_total_score >= 73 THEN
    v_letter_grade := 'C+';
    v_grade_color := '#f59e0b';
    v_percentile := 'Average';
  ELSIF v_total_score >= 70 THEN
    v_letter_grade := 'C';
    v_grade_color := '#f59e0b';
    v_percentile := 'Average';
  ELSIF v_total_score >= 67 THEN
    v_letter_grade := 'C-';
    v_grade_color := '#f59e0b';
    v_percentile := 'Below Average';
  ELSIF v_total_score >= 60 THEN
    v_letter_grade := 'D';
    v_grade_color := '#f97316';
    v_percentile := 'Needs Improvement';
  ELSE
    v_letter_grade := 'F';
    v_grade_color := '#ef4444';
    v_percentile := 'Critical';
  END IF;

  -- Return detailed grade breakdown
  RETURN jsonb_build_object(
    'grade', v_letter_grade,
    'score', ROUND(v_total_score, 1),
    'color', v_grade_color,
    'percentile', v_percentile,
    'breakdown', jsonb_build_object(
      'verification_score', ROUND(v_verification_score, 1),
      'reputation_score', ROUND(v_reputation_score, 1),
      'velocity_score', ROUND(v_velocity_score, 1),
      'profile_score', ROUND(v_profile_score, 1)
    ),
    'details', jsonb_build_object(
      'has_verified_license', (v_license.verification_status = 'verified'),
      'insurance_verified', COALESCE(v_profile.insurance_verified, false),
      'review_count', COALESCE(v_rating_count, 0),
      'average_rating', ROUND(COALESCE(v_rating_avg, 0), 2),
      'completed_jobs', COALESCE(v_completed_jobs, 0),
      'total_jobs', COALESCE(v_total_jobs, 0),
      'avg_response_hours', ROUND(COALESCE(v_avg_response_hours, 0), 1),
      'has_bio', (v_profile.bio IS NOT NULL),
      'has_profile_photo', (v_profile.profile_photo_url IS NOT NULL),
      'portfolio_count', COALESCE(jsonb_array_length(v_profile.portfolio_photos), 0)
    )
  );
END;
$$ LANGUAGE plpgsql;
