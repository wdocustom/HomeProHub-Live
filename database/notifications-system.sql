-- ========================================
-- SMS & Email Notifications System
-- ========================================
-- Implements contractor notifications for new jobs in their service area

-- ========================================
-- 1. Add Service Radius & Notification Preferences to user_profiles
-- ========================================
DO $$
BEGIN
  -- Add service_radius_miles for contractors
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'service_radius_miles'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN service_radius_miles INTEGER DEFAULT 25;
  END IF;

  -- Add notification preferences
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'notifications_sms_enabled'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN notifications_sms_enabled BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'notifications_email_enabled'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN notifications_email_enabled BOOLEAN DEFAULT true;
  END IF;

  -- Add phone verification status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'phone_verified'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN phone_verified BOOLEAN DEFAULT false;
  END IF;

  -- Add phone verification code (for SMS verification)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'phone_verification_code'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN phone_verification_code TEXT;
  END IF;

  -- Add verification code expiry
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'phone_verification_expires'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN phone_verification_expires TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_profiles_service_radius ON user_profiles(service_radius_miles);
CREATE INDEX IF NOT EXISTS idx_user_profiles_notifications ON user_profiles(notifications_sms_enabled, notifications_email_enabled);

-- ========================================
-- 2. Notification Log Table
-- ========================================
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recipient
  recipient_email TEXT NOT NULL,
  recipient_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  recipient_phone TEXT,

  -- Notification details
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'new_job_sms', 'new_job_email', 'bid_accepted_sms', 'bid_accepted_email',
    'bid_rejected_sms', 'bid_rejected_email', 'new_message_sms', 'new_message_email',
    'job_completed_sms', 'job_completed_email', 'rating_received_sms', 'rating_received_email'
  )),

  subject TEXT,
  message TEXT NOT NULL,

  -- Related entities
  job_id UUID, -- References job_postings(id)
  bid_id UUID, -- References contractor_bids(id)

  -- Delivery tracking
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('sms', 'email', 'both')),

  -- SMS specific
  sms_sid TEXT, -- Twilio SMS ID
  sms_status TEXT, -- queued, sent, delivered, failed, undelivered
  sms_sent_at TIMESTAMP WITH TIME ZONE,
  sms_delivered_at TIMESTAMP WITH TIME ZONE,
  sms_error TEXT,

  -- Email specific
  email_message_id TEXT,
  email_status TEXT, -- queued, sent, delivered, failed, bounced, opened
  email_sent_at TIMESTAMP WITH TIME ZONE,
  email_delivered_at TIMESTAMP WITH TIME ZONE,
  email_opened_at TIMESTAMP WITH TIME ZONE,
  email_error TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_recipient ON notification_log(recipient_email);
CREATE INDEX IF NOT EXISTS idx_notification_log_type ON notification_log(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_log_job ON notification_log(job_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_created ON notification_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_sms_status ON notification_log(sms_status);
CREATE INDEX IF NOT EXISTS idx_notification_log_email_status ON notification_log(email_status);

-- ========================================
-- 3. Function to Find Contractors in Service Area
-- ========================================
CREATE OR REPLACE FUNCTION find_contractors_in_service_area(
  p_job_zip_code TEXT,
  p_trade TEXT DEFAULT NULL
) RETURNS TABLE (
  contractor_email TEXT,
  contractor_id UUID,
  contractor_name TEXT,
  contractor_phone TEXT,
  service_radius_miles INTEGER,
  distance_miles NUMERIC,
  notifications_sms_enabled BOOLEAN,
  notifications_email_enabled BOOLEAN,
  phone_verified BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.email,
    up.id,
    COALESCE(up.company_name, up.business_name, up.full_name) as contractor_name,
    up.phone,
    up.service_radius_miles,
    -- Mock distance calculation (replace with real ZIP distance calculation)
    CASE
      WHEN up.zip_code = p_job_zip_code THEN 0::numeric
      ELSE (RANDOM() * up.service_radius_miles)::numeric
    END as distance_miles,
    up.notifications_sms_enabled,
    up.notifications_email_enabled,
    up.phone_verified
  FROM user_profiles up
  WHERE
    up.role = 'contractor'
    AND up.profile_complete = true
    AND (
      -- Same ZIP or within service radius (simplified)
      up.zip_code = p_job_zip_code
      OR up.service_radius_miles >= 25 -- Adjust based on real distance calc
    )
    AND (p_trade IS NULL OR up.trade = p_trade)
    AND (up.notifications_sms_enabled = true OR up.notifications_email_enabled = true);
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 4. Function to Queue Job Notification
-- ========================================
CREATE OR REPLACE FUNCTION queue_job_notification(
  p_job_id UUID,
  p_job_title TEXT,
  p_job_zip_code TEXT,
  p_job_category TEXT,
  p_job_budget_low INTEGER DEFAULT NULL,
  p_job_budget_high INTEGER DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_contractor RECORD;
  v_notification_count INTEGER := 0;
  v_message TEXT;
  v_email_message TEXT;
BEGIN
  -- Build notification messages
  v_message := 'New job posted near you! ';
  v_message := v_message || p_job_title;

  IF p_job_budget_low IS NOT NULL AND p_job_budget_high IS NOT NULL THEN
    v_message := v_message || ' (Budget: $' || p_job_budget_low || '-$' || p_job_budget_high || ')';
  END IF;

  v_message := v_message || ' View and bid: homeprohub.today/contractor-dashboard.html';

  -- Email message (more detailed)
  v_email_message := '<h2>New Job Opportunity</h2>';
  v_email_message := v_email_message || '<p><strong>' || p_job_title || '</strong></p>';
  v_email_message := v_email_message || '<p>Location: ' || p_job_zip_code || '</p>';

  IF p_job_budget_low IS NOT NULL AND p_job_budget_high IS NOT NULL THEN
    v_email_message := v_email_message || '<p>Budget: $' || p_job_budget_low || ' - $' || p_job_budget_high || '</p>';
  END IF;

  v_email_message := v_email_message || '<p><a href="https://homeprohub.today/contractor-dashboard.html">View Job & Submit Bid</a></p>';

  -- Find contractors in service area
  FOR v_contractor IN
    SELECT * FROM find_contractors_in_service_area(p_job_zip_code, p_job_category)
  LOOP
    -- Determine delivery method
    DECLARE
      v_delivery_method TEXT;
    BEGIN
      IF v_contractor.notifications_sms_enabled AND v_contractor.notifications_email_enabled THEN
        v_delivery_method := 'both';
      ELSIF v_contractor.notifications_sms_enabled THEN
        v_delivery_method := 'sms';
      ELSIF v_contractor.notifications_email_enabled THEN
        v_delivery_method := 'email';
      ELSE
        CONTINUE; -- Skip if no notifications enabled
      END IF;

      -- Insert notification log
      INSERT INTO notification_log (
        recipient_email,
        recipient_id,
        recipient_phone,
        notification_type,
        subject,
        message,
        job_id,
        delivery_method,
        sms_status,
        email_status
      ) VALUES (
        v_contractor.contractor_email,
        v_contractor.contractor_id,
        v_contractor.contractor_phone,
        CASE
          WHEN v_delivery_method = 'both' THEN 'new_job_sms'
          WHEN v_delivery_method = 'sms' THEN 'new_job_sms'
          ELSE 'new_job_email'
        END,
        'New Job: ' || p_job_title,
        CASE
          WHEN v_delivery_method IN ('sms', 'both') THEN v_message
          ELSE v_email_message
        END,
        p_job_id,
        v_delivery_method,
        CASE WHEN v_delivery_method IN ('sms', 'both') THEN 'queued' ELSE NULL END,
        CASE WHEN v_delivery_method IN ('email', 'both') THEN 'queued' ELSE NULL END
      );

      -- If sending both, create second log entry for email
      IF v_delivery_method = 'both' THEN
        INSERT INTO notification_log (
          recipient_email,
          recipient_id,
          recipient_phone,
          notification_type,
          subject,
          message,
          job_id,
          delivery_method,
          email_status
        ) VALUES (
          v_contractor.contractor_email,
          v_contractor.contractor_id,
          v_contractor.contractor_phone,
          'new_job_email',
          'New Job: ' || p_job_title,
          v_email_message,
          p_job_id,
          'email',
          'queued'
        );
      END IF;

      v_notification_count := v_notification_count + 1;
    END;
  END LOOP;

  RETURN v_notification_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 5. Trigger to Auto-Notify on Job Creation
-- ========================================
CREATE OR REPLACE FUNCTION trigger_job_notifications()
RETURNS TRIGGER AS $$
BEGIN
  -- Queue notifications for new job postings
  IF TG_OP = 'INSERT' AND NEW.status = 'open' THEN
    PERFORM queue_job_notification(
      NEW.id,
      NEW.title,
      NEW.zip_code,
      NEW.category,
      NEW.budget_low,
      NEW.budget_high
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS job_posting_notification_trigger ON job_postings;
CREATE TRIGGER job_posting_notification_trigger
  AFTER INSERT ON job_postings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_job_notifications();

-- ========================================
-- 6. Triggers
-- ========================================
DROP TRIGGER IF EXISTS update_notification_log_updated_at ON notification_log;
CREATE TRIGGER update_notification_log_updated_at
  BEFORE UPDATE ON notification_log
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
