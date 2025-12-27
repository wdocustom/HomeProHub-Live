-- ========================================
-- HomeProHub Subscription System Schema
-- ========================================
-- Supports tiered subscriptions for Homeowners and Contractors
-- Includes Stripe integration and pay-per-lead tracking

-- ========================================
-- 1. Subscription Tiers Table
-- ========================================
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('homeowner', 'contractor')),
  price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_yearly DECIMAL(10,2) DEFAULT NULL, -- Optional annual pricing

  -- Feature limits
  bids_per_month INTEGER DEFAULT NULL, -- NULL = unlimited, 0 = none
  job_posts_per_month INTEGER DEFAULT NULL,
  ai_calls_per_month INTEGER DEFAULT NULL,
  video_calls_per_month INTEGER DEFAULT NULL,
  sms_credits_per_month INTEGER DEFAULT NULL,

  -- Feature flags
  featured_badge BOOLEAN DEFAULT false,
  priority_placement BOOLEAN DEFAULT false,
  priority_messaging BOOLEAN DEFAULT false,
  estimate_tool_access BOOLEAN DEFAULT false,
  owners_rep_access BOOLEAN DEFAULT false,
  pm_tools_access BOOLEAN DEFAULT false,

  -- Display info
  display_name TEXT NOT NULL,
  description TEXT,
  roi_text TEXT, -- e.g., "Avg Pro wins 3 jobs/mo"
  features JSONB, -- Array of feature bullets for pricing page

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscription_tiers_role ON subscription_tiers(role);
CREATE INDEX IF NOT EXISTS idx_subscription_tiers_active ON subscription_tiers(is_active);

-- Seed default tiers
INSERT INTO subscription_tiers (tier_name, role, price_monthly, display_name, description, roi_text, features, bids_per_month, job_posts_per_month, ai_calls_per_month, video_calls_per_month, sms_credits_per_month, featured_badge, priority_placement, estimate_tool_access, owners_rep_access, pm_tools_access) VALUES
-- Homeowner Tiers
('homeowner_starter', 'homeowner', 0.00, 'Starter', 'Perfect for DIY homeowners', NULL,
  '["Basic AI diagnosis", "Convert diagnosis to Job Post", "Contractor Directory access", "Unlimited job posting"]'::jsonb,
  NULL, NULL, 10, 0, 0, false, false, false, false, false),

('homeowner_pro', 'homeowner', 50.00, 'Pro', 'For active homeowners managing projects', NULL,
  '["Everything in Starter", "Text an Expert (SMS)", "2 phone consultations/month", "1 video call (60 mins/month)"]'::jsonb,
  NULL, NULL, 50, 2, 100, false, false, false, false, false),

('homeowner_elite', 'homeowner', 99.00, 'Elite', 'Full concierge service with AI Owners Rep', 'Optional human Owners Rep available',
  '["Everything in Pro", "Full AI Owners Rep features", "Unlimited consultations", "Priority contractor matching", "Optional human Owners Rep (add-on)"]'::jsonb,
  NULL, NULL, NULL, NULL, NULL, false, false, false, true, true),

-- Contractor Tiers
('contractor_starter', 'contractor', 0.00, 'Starter', 'Try HomeProHub risk-free', NULL,
  '["View all job postings", "2 bids per month", "Standard directory listing", "Basic profile"]'::jsonb,
  2, NULL, 5, 0, 0, false, false, false, false, false),

('contractor_pro', 'contractor', 49.00, 'Pro', 'For active contractors', 'Avg Pro wins 3 jobs/mo',
  '["Everything in Starter", "Unlimited bids", "Featured badge", "AI Estimate tool access", "Response time badge", "Priority support"]'::jsonb,
  NULL, NULL, NULL, 0, 0, true, false, true, false, false),

('contractor_premium', 'contractor', 149.00, 'Premium', 'Maximum visibility and tools', 'Avg Premium wins 8 jobs/mo',
  '["Everything in Pro", "Top of search results", "Priority messaging", "Owners advocate referrals", "PM tools & templates", "Lead analytics", "Dedicated account manager"]'::jsonb,
  NULL, NULL, NULL, 0, 0, true, true, true, false, true)

ON CONFLICT (tier_name) DO NOTHING;

-- ========================================
-- 2. User Subscriptions Table
-- ========================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,

  -- Subscription details
  tier_id UUID REFERENCES subscription_tiers(id),
  tier_name TEXT NOT NULL, -- Denormalized for easy access

  -- Billing
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_payment_method_id TEXT,
  billing_interval TEXT CHECK (billing_interval IN ('monthly', 'yearly', 'pay_per_lead')),

  -- Status
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'paused')) DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,

  -- Pay-per-lead specific
  is_pay_per_lead BOOLEAN DEFAULT false,
  lead_price DECIMAL(10,2) DEFAULT 20.00, -- Price per lead viewed
  leads_purchased_count INTEGER DEFAULT 0,
  leads_remaining INTEGER DEFAULT 0,

  -- Trial
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  canceled_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_email ON user_subscriptions(user_email);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id);

-- ========================================
-- 3. Subscription Usage Tracking
-- ========================================
CREATE TABLE IF NOT EXISTS subscription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,

  -- Monthly usage counters (reset each billing period)
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,

  bids_used INTEGER DEFAULT 0,
  job_posts_used INTEGER DEFAULT 0,
  ai_calls_used INTEGER DEFAULT 0,
  video_calls_used INTEGER DEFAULT 0,
  sms_credits_used INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one record per subscription per period
  UNIQUE(subscription_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_subscription_usage_subscription ON subscription_usage(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_period ON subscription_usage(period_start, period_end);

-- ========================================
-- 4. Lead Charges (Pay-Per-Lead Tracking)
-- ========================================
CREATE TABLE IF NOT EXISTS lead_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_email TEXT NOT NULL,
  contractor_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Bid details
  bid_id UUID NOT NULL, -- References contractor_bids(id)
  job_id UUID NOT NULL, -- References job_postings(id)
  homeowner_email TEXT NOT NULL,

  -- Charge details
  charge_amount DECIMAL(10,2) NOT NULL, -- Amount charged for this lead
  charged BOOLEAN DEFAULT false, -- Whether homeowner viewed the bid (triggers charge)
  charged_at TIMESTAMP WITH TIME ZONE,

  -- Stripe payment
  stripe_charge_id TEXT,
  stripe_invoice_id TEXT,
  payment_status TEXT CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')) DEFAULT 'pending',

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_charges_contractor ON lead_charges(contractor_email);
CREATE INDEX IF NOT EXISTS idx_lead_charges_bid ON lead_charges(bid_id);
CREATE INDEX IF NOT EXISTS idx_lead_charges_charged ON lead_charges(charged);
CREATE INDEX IF NOT EXISTS idx_lead_charges_status ON lead_charges(payment_status);

-- ========================================
-- 5. Subscription Events Log
-- ========================================
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,

  -- Event details
  event_type TEXT NOT NULL, -- 'created', 'upgraded', 'downgraded', 'canceled', 'renewed', 'payment_failed', etc.
  event_data JSONB, -- Additional event details

  -- Stripe webhook data
  stripe_event_id TEXT,
  stripe_event_type TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_subscription ON subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created ON subscription_events(created_at DESC);

-- ========================================
-- 6. Update user_profiles with subscription info
-- ========================================
-- Add columns to user_profiles if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN subscription_tier TEXT DEFAULT 'starter';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN subscription_status TEXT DEFAULT 'active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN stripe_customer_id TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_tier ON user_profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer ON user_profiles(stripe_customer_id);

-- ========================================
-- 7. Helper Functions
-- ========================================

-- Function to check if user has feature access
CREATE OR REPLACE FUNCTION has_feature_access(
  p_user_email TEXT,
  p_feature_name TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_tier subscription_tiers%ROWTYPE;
  v_subscription user_subscriptions%ROWTYPE;
BEGIN
  -- Get active subscription
  SELECT * INTO v_subscription
  FROM user_subscriptions
  WHERE user_email = p_user_email
    AND status = 'active'
    AND (current_period_end IS NULL OR current_period_end > NOW())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Get tier details
  SELECT * INTO v_tier
  FROM subscription_tiers
  WHERE id = v_subscription.tier_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check feature flags
  RETURN CASE p_feature_name
    WHEN 'featured_badge' THEN v_tier.featured_badge
    WHEN 'priority_placement' THEN v_tier.priority_placement
    WHEN 'priority_messaging' THEN v_tier.priority_messaging
    WHEN 'estimate_tool_access' THEN v_tier.estimate_tool_access
    WHEN 'owners_rep_access' THEN v_tier.owners_rep_access
    WHEN 'pm_tools_access' THEN v_tier.pm_tools_access
    ELSE false
  END;
END;
$$ LANGUAGE plpgsql;

-- Function to check usage limits
CREATE OR REPLACE FUNCTION check_usage_limit(
  p_user_email TEXT,
  p_usage_type TEXT -- 'bids', 'job_posts', 'ai_calls', 'video_calls', 'sms_credits'
) RETURNS JSONB AS $$
DECLARE
  v_subscription user_subscriptions%ROWTYPE;
  v_tier subscription_tiers%ROWTYPE;
  v_usage subscription_usage%ROWTYPE;
  v_limit INTEGER;
  v_used INTEGER;
  v_remaining INTEGER;
  v_unlimited BOOLEAN;
BEGIN
  -- Get active subscription
  SELECT * INTO v_subscription
  FROM user_subscriptions
  WHERE user_email = p_user_email
    AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'No active subscription',
      'limit', 0,
      'used', 0,
      'remaining', 0
    );
  END IF;

  -- Get tier
  SELECT * INTO v_tier
  FROM subscription_tiers
  WHERE id = v_subscription.tier_id;

  -- Get or create current usage record
  SELECT * INTO v_usage
  FROM subscription_usage
  WHERE subscription_id = v_subscription.id
    AND period_start = v_subscription.current_period_start;

  IF NOT FOUND THEN
    INSERT INTO subscription_usage (
      subscription_id, user_email, period_start, period_end
    ) VALUES (
      v_subscription.id,
      p_user_email,
      v_subscription.current_period_start,
      v_subscription.current_period_end
    ) RETURNING * INTO v_usage;
  END IF;

  -- Get limit and used count based on type
  v_limit := CASE p_usage_type
    WHEN 'bids' THEN v_tier.bids_per_month
    WHEN 'job_posts' THEN v_tier.job_posts_per_month
    WHEN 'ai_calls' THEN v_tier.ai_calls_per_month
    WHEN 'video_calls' THEN v_tier.video_calls_per_month
    WHEN 'sms_credits' THEN v_tier.sms_credits_per_month
    ELSE 0
  END;

  v_used := CASE p_usage_type
    WHEN 'bids' THEN v_usage.bids_used
    WHEN 'job_posts' THEN v_usage.job_posts_used
    WHEN 'ai_calls' THEN v_usage.ai_calls_used
    WHEN 'video_calls' THEN v_usage.video_calls_used
    WHEN 'sms_credits' THEN v_usage.sms_credits_used
    ELSE 0
  END;

  v_unlimited := v_limit IS NULL;
  v_remaining := CASE
    WHEN v_unlimited THEN -1 -- -1 indicates unlimited
    ELSE GREATEST(0, v_limit - v_used)
  END;

  RETURN jsonb_build_object(
    'allowed', v_unlimited OR v_used < v_limit,
    'unlimited', v_unlimited,
    'limit', COALESCE(v_limit, -1),
    'used', v_used,
    'remaining', v_remaining,
    'tier_name', v_tier.display_name
  );
END;
$$ LANGUAGE plpgsql;

-- Function to increment usage
CREATE OR REPLACE FUNCTION increment_usage(
  p_user_email TEXT,
  p_usage_type TEXT,
  p_amount INTEGER DEFAULT 1
) RETURNS BOOLEAN AS $$
DECLARE
  v_subscription user_subscriptions%ROWTYPE;
  v_updated BOOLEAN;
BEGIN
  -- Get active subscription
  SELECT * INTO v_subscription
  FROM user_subscriptions
  WHERE user_email = p_user_email
    AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Update usage
  CASE p_usage_type
    WHEN 'bids' THEN
      UPDATE subscription_usage
      SET bids_used = bids_used + p_amount, updated_at = NOW()
      WHERE subscription_id = v_subscription.id
        AND period_start = v_subscription.current_period_start;
    WHEN 'job_posts' THEN
      UPDATE subscription_usage
      SET job_posts_used = job_posts_used + p_amount, updated_at = NOW()
      WHERE subscription_id = v_subscription.id
        AND period_start = v_subscription.current_period_start;
    WHEN 'ai_calls' THEN
      UPDATE subscription_usage
      SET ai_calls_used = ai_calls_used + p_amount, updated_at = NOW()
      WHERE subscription_id = v_subscription.id
        AND period_start = v_subscription.current_period_start;
    WHEN 'video_calls' THEN
      UPDATE subscription_usage
      SET video_calls_used = video_calls_used + p_amount, updated_at = NOW()
      WHERE subscription_id = v_subscription.id
        AND period_start = v_subscription.current_period_start;
    WHEN 'sms_credits' THEN
      UPDATE subscription_usage
      SET sms_credits_used = sms_credits_used + p_amount, updated_at = NOW()
      WHERE subscription_id = v_subscription.id
        AND period_start = v_subscription.current_period_start;
  END CASE;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 8. Triggers
-- ========================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_subscription_updated_at();

DROP TRIGGER IF EXISTS update_subscription_usage_updated_at ON subscription_usage;
CREATE TRIGGER update_subscription_usage_updated_at
  BEFORE UPDATE ON subscription_usage
  FOR EACH ROW EXECUTE FUNCTION update_subscription_updated_at();

DROP TRIGGER IF EXISTS update_subscription_tiers_updated_at ON subscription_tiers;
CREATE TRIGGER update_subscription_tiers_updated_at
  BEFORE UPDATE ON subscription_tiers
  FOR EACH ROW EXECUTE FUNCTION update_subscription_updated_at();
