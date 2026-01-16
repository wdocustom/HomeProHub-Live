-- ========================================
-- Migration: Trade Opportunities System for Auto-GC
-- Date: 2026-01-15
-- Purpose: Allow trade-specific contractors to view and respond to Auto-GC opportunities
-- ========================================
-- This enables trade contractors (plumbers, electricians, etc.) to:
-- 1. View jobs scouted by the Auto-GC Shark agent
-- 2. See relevant project information for their trade
-- 3. Accept or decline invitations to bid on specific trade work
-- ========================================

-- ========================================
-- 1. Auto-GC Trade Opportunities Table
-- Stores invitations sent by Shark agent to trade contractors
-- ========================================
CREATE TABLE IF NOT EXISTS autogc_trade_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Project reference
  project_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  milestone_id TEXT, -- Which milestone/phase this is for

  -- Contractor invitation
  contractor_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  contractor_email TEXT NOT NULL,

  -- Trade details
  trade_type TEXT NOT NULL CHECK (trade_type IN (
    'general_contractor', 'excavation', 'concrete', 'foundation', 'framing',
    'roofing', 'siding', 'windows_doors', 'plumbing', 'electrical', 'hvac',
    'insulation', 'drywall', 'painting', 'flooring', 'cabinets', 'countertops',
    'tile', 'landscaping', 'masonry', 'carpentry', 'architect', 'engineer'
  )),

  -- Opportunity details
  scope_of_work TEXT NOT NULL, -- Description of work for this trade
  estimated_duration_days INTEGER,
  priority_level INTEGER DEFAULT 5 CHECK (priority_level BETWEEN 1 AND 10), -- 1 = highest

  -- Project information (filtered for this trade)
  project_details JSONB DEFAULT '{}'::jsonb,
  -- Example: {
  --   "project_title": "Custom Home Build - 2500 sqft",
  --   "address": "123 Main St",
  --   "homeowner_name": "John Doe",
  --   "milestone_name": "Rough-In Plumbing",
  --   "estimated_start": "2026-02-01",
  --   "blueprint_urls": ["https://..."],
  --   "trade_specific_notes": "3 full bathrooms, kitchen, laundry"
  -- }

  -- Trade-specific requirements
  requirements JSONB DEFAULT '[]'::jsonb,
  -- Example: ["Licensed plumber required", "Must have insurance", "Experience with PEX piping"]

  -- Documents available to contractor
  available_documents JSONB DEFAULT '[]'::jsonb,
  -- Example: [
  --   {"type": "blueprint", "page": "Plumbing Plan", "url": "https://..."},
  --   {"type": "spec", "name": "Plumbing Specifications", "url": "https://..."}
  -- ]

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',        -- Sent to contractor, awaiting response
    'viewed',         -- Contractor viewed the opportunity
    'accepted',       -- Contractor accepted and wants to bid
    'bid_submitted',  -- Contractor submitted a formal bid
    'declined',       -- Contractor declined the opportunity
    'expired',        -- Opportunity expired (not responded in time)
    'awarded',        -- Work was awarded to this contractor
    'withdrawn'       -- Opportunity was withdrawn by Auto-GC
  )),

  -- Response from contractor
  contractor_response TEXT, -- Their message when accepting/declining
  contractor_bid_amount_low INTEGER,
  contractor_bid_amount_high INTEGER,
  contractor_estimated_duration TEXT,
  contractor_start_availability TEXT,

  -- Timestamps
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  viewed_at TIMESTAMP WITH TIME ZONE,
  responded_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE, -- Deadline to respond

  -- AI agent tracking
  created_by_agent TEXT DEFAULT 'shark', -- Which agent created this
  agent_metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for trade opportunities
CREATE INDEX IF NOT EXISTS idx_autogc_trade_opps_project ON autogc_trade_opportunities(project_id);
CREATE INDEX IF NOT EXISTS idx_autogc_trade_opps_contractor ON autogc_trade_opportunities(contractor_id);
CREATE INDEX IF NOT EXISTS idx_autogc_trade_opps_email ON autogc_trade_opportunities(contractor_email);
CREATE INDEX IF NOT EXISTS idx_autogc_trade_opps_trade ON autogc_trade_opportunities(trade_type);
CREATE INDEX IF NOT EXISTS idx_autogc_trade_opps_status ON autogc_trade_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_autogc_trade_opps_milestone ON autogc_trade_opportunities(project_id, milestone_id);
CREATE INDEX IF NOT EXISTS idx_autogc_trade_opps_priority ON autogc_trade_opportunities(priority_level);
CREATE INDEX IF NOT EXISTS idx_autogc_trade_opps_expires ON autogc_trade_opportunities(expires_at) WHERE status IN ('pending', 'viewed');

-- Unique constraint: one opportunity per contractor per project per milestone
CREATE UNIQUE INDEX IF NOT EXISTS idx_autogc_trade_opps_unique
ON autogc_trade_opportunities(project_id, contractor_id, milestone_id);

-- ========================================
-- 2. Update project_milestones to track trade opportunities
-- ========================================
ALTER TABLE project_milestones
ADD COLUMN IF NOT EXISTS trade_opportunities_sent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS trade_opportunities_accepted INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS trade_bids_received INTEGER DEFAULT 0;

-- ========================================
-- 3. Contractor Access Control Table
-- Defines who can access Auto-GC features
-- ========================================
CREATE TABLE IF NOT EXISTS autogc_access_control (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contractor identification
  contractor_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  contractor_email TEXT NOT NULL UNIQUE,

  -- Access level
  access_level TEXT NOT NULL DEFAULT 'trade_only' CHECK (access_level IN (
    'full_access',    -- Can create and manage Auto-GC projects (General Contractors)
    'trade_only',     -- Can only view/respond to trade opportunities (Plumbers, etc.)
    'no_access'       -- No access to Auto-GC features
  )),

  -- Trade qualification (for trade_only access)
  qualified_trade TEXT CHECK (qualified_trade IN (
    'general_contractor', 'excavation', 'concrete', 'foundation', 'framing',
    'roofing', 'siding', 'windows_doors', 'plumbing', 'electrical', 'hvac',
    'insulation', 'drywall', 'painting', 'flooring', 'cabinets', 'countertops',
    'tile', 'landscaping', 'masonry', 'carpentry', 'architect', 'engineer'
  )),

  -- Override flags (for special cases)
  can_create_projects BOOLEAN DEFAULT false,
  can_manage_projects BOOLEAN DEFAULT false,
  can_view_all_projects BOOLEAN DEFAULT false,

  -- Automatic determination based on user_profiles.trade
  auto_determined BOOLEAN DEFAULT true, -- If true, determined by trade; if false, manually set

  -- Admin notes
  notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for access control
CREATE INDEX IF NOT EXISTS idx_autogc_access_contractor ON autogc_access_control(contractor_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_autogc_access_email ON autogc_access_control(contractor_email);
CREATE INDEX IF NOT EXISTS idx_autogc_access_level ON autogc_access_control(access_level);

-- ========================================
-- 4. Helper Function: Get Contractor Access Level
-- ========================================
CREATE OR REPLACE FUNCTION get_contractor_autogc_access(contractor_email_param TEXT)
RETURNS TABLE (
  access_level TEXT,
  qualified_trade TEXT,
  can_create_projects BOOLEAN,
  can_manage_projects BOOLEAN,
  can_view_all_projects BOOLEAN
) AS $$
BEGIN
  -- Check if there's an explicit access control record
  RETURN QUERY
  SELECT
    ac.access_level,
    ac.qualified_trade,
    ac.can_create_projects,
    ac.can_manage_projects,
    ac.can_view_all_projects
  FROM autogc_access_control ac
  WHERE ac.contractor_email = contractor_email_param;

  -- If no explicit record exists, determine from user profile
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      CASE
        WHEN up.trade = 'General Contractor' THEN 'full_access'::TEXT
        WHEN up.trade IS NOT NULL AND up.trade != '' THEN 'trade_only'::TEXT
        ELSE 'no_access'::TEXT
      END as access_level,
      CASE
        WHEN up.trade = 'Plumber' THEN 'plumbing'::TEXT
        WHEN up.trade = 'Electrician' THEN 'electrical'::TEXT
        WHEN up.trade = 'Mechanical Contractor' THEN 'hvac'::TEXT
        WHEN up.trade = 'General Contractor' THEN 'general_contractor'::TEXT
        ELSE 'general_contractor'::TEXT
      END as qualified_trade,
      (up.trade = 'General Contractor')::BOOLEAN as can_create_projects,
      (up.trade = 'General Contractor')::BOOLEAN as can_manage_projects,
      false::BOOLEAN as can_view_all_projects
    FROM user_profiles up
    WHERE up.email = contractor_email_param
      AND up.role = 'contractor';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 5. Helper Function: Auto-populate Access Control
-- For all existing contractors
-- ========================================
CREATE OR REPLACE FUNCTION populate_autogc_access_control()
RETURNS INTEGER AS $$
DECLARE
  row_count INTEGER;
BEGIN
  INSERT INTO autogc_access_control (
    contractor_id,
    contractor_email,
    access_level,
    qualified_trade,
    can_create_projects,
    can_manage_projects,
    auto_determined
  )
  SELECT
    up.id as contractor_id,
    up.email as contractor_email,
    CASE
      WHEN up.trade = 'General Contractor' THEN 'full_access'
      WHEN up.trade IS NOT NULL AND up.trade != '' THEN 'trade_only'
      ELSE 'no_access'
    END as access_level,
    CASE
      WHEN up.trade = 'Plumber' THEN 'plumbing'
      WHEN up.trade = 'Electrician' THEN 'electrical'
      WHEN up.trade = 'Mechanical Contractor' THEN 'hvac'
      WHEN up.trade = 'General Contractor' THEN 'general_contractor'
      ELSE NULL
    END as qualified_trade,
    (up.trade = 'General Contractor') as can_create_projects,
    (up.trade = 'General Contractor') as can_manage_projects,
    true as auto_determined
  FROM user_profiles up
  WHERE up.role = 'contractor'
    AND up.email NOT IN (SELECT contractor_email FROM autogc_access_control)
  ON CONFLICT (contractor_email) DO NOTHING;

  GET DIAGNOSTICS row_count = ROW_COUNT;
  RETURN row_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 6. Trigger: Auto-create access control for new contractors
-- ========================================
CREATE OR REPLACE FUNCTION autogc_access_control_trigger_fn()
RETURNS TRIGGER AS $$
BEGIN
  -- Only for contractors
  IF NEW.role = 'contractor' THEN
    INSERT INTO autogc_access_control (
      contractor_id,
      contractor_email,
      access_level,
      qualified_trade,
      can_create_projects,
      can_manage_projects,
      auto_determined
    )
    VALUES (
      NEW.id,
      NEW.email,
      CASE
        WHEN NEW.trade = 'General Contractor' THEN 'full_access'
        WHEN NEW.trade IS NOT NULL AND NEW.trade != '' THEN 'trade_only'
        ELSE 'no_access'
      END,
      CASE
        WHEN NEW.trade = 'Plumber' THEN 'plumbing'
        WHEN NEW.trade = 'Electrician' THEN 'electrical'
        WHEN NEW.trade = 'Mechanical Contractor' THEN 'hvac'
        WHEN NEW.trade = 'General Contractor' THEN 'general_contractor'
        ELSE NULL
      END,
      (NEW.trade = 'General Contractor'),
      (NEW.trade = 'General Contractor'),
      true
    )
    ON CONFLICT (contractor_email)
    DO UPDATE SET
      access_level = CASE
        WHEN NEW.trade = 'General Contractor' THEN 'full_access'
        WHEN NEW.trade IS NOT NULL AND NEW.trade != '' THEN 'trade_only'
        ELSE 'no_access'
      END,
      qualified_trade = CASE
        WHEN NEW.trade = 'Plumber' THEN 'plumbing'
        WHEN NEW.trade = 'Electrician' THEN 'electrical'
        WHEN NEW.trade = 'Mechanical Contractor' THEN 'hvac'
        WHEN NEW.trade = 'General Contractor' THEN 'general_contractor'
        ELSE autogc_access_control.qualified_trade
      END,
      can_create_projects = (NEW.trade = 'General Contractor'),
      can_manage_projects = (NEW.trade = 'General Contractor'),
      updated_at = NOW()
    WHERE autogc_access_control.auto_determined = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS autogc_access_control_trigger ON user_profiles;
CREATE TRIGGER autogc_access_control_trigger
  AFTER INSERT OR UPDATE OF trade ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION autogc_access_control_trigger_fn();

-- ========================================
-- 7. Update Trigger for autogc_trade_opportunities
-- ========================================
DROP TRIGGER IF EXISTS update_autogc_trade_opps_updated_at ON autogc_trade_opportunities;
CREATE TRIGGER update_autogc_trade_opps_updated_at
  BEFORE UPDATE ON autogc_trade_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_autogc_access_control_updated_at ON autogc_access_control;
CREATE TRIGGER update_autogc_access_control_updated_at
  BEFORE UPDATE ON autogc_access_control
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 8. Helper Views
-- ========================================

-- View: Trade Opportunities for Contractors
CREATE OR REPLACE VIEW contractor_trade_opportunities_view AS
SELECT
  ato.id as opportunity_id,
  ato.status as opportunity_status,
  ato.trade_type,
  ato.scope_of_work,
  ato.priority_level,
  ato.sent_at,
  ato.expires_at,
  ato.viewed_at,
  ato.responded_at,

  -- Project info
  j.id as project_id,
  j.title as project_title,
  j.address as project_address,
  j.status as project_status,

  -- Template info
  pt.display_name as template_name,
  pt.template_type,

  -- Milestone info
  ato.milestone_id,
  (ato.project_details->>'milestone_name') as milestone_name,
  (ato.project_details->>'estimated_start') as estimated_start,

  -- Contractor info
  ato.contractor_id,
  ato.contractor_email,
  up.first_name || ' ' || up.last_name as contractor_name,
  up.business_name as contractor_business,

  -- Documents
  ato.available_documents,
  ato.requirements,

  -- Response info
  ato.contractor_response,
  ato.contractor_bid_amount_low,
  ato.contractor_bid_amount_high

FROM autogc_trade_opportunities ato
JOIN job_postings j ON ato.project_id = j.id
LEFT JOIN project_templates pt ON j.template_id = pt.id
JOIN user_profiles up ON ato.contractor_id = up.id
WHERE ato.status NOT IN ('expired', 'withdrawn');

-- View: Active Trade Opportunities by Trade Type
CREATE OR REPLACE VIEW active_opportunities_by_trade AS
SELECT
  trade_type,
  COUNT(*) as total_opportunities,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'viewed') as viewed,
  COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
  COUNT(*) FILTER (WHERE status = 'bid_submitted') as bids_submitted,
  COUNT(*) FILTER (WHERE status = 'awarded') as awarded
FROM autogc_trade_opportunities
WHERE status NOT IN ('expired', 'withdrawn', 'declined')
GROUP BY trade_type;

-- ========================================
-- 9. Populate Access Control for Existing Contractors
-- ========================================
SELECT populate_autogc_access_control() as contractors_processed;

-- ========================================
-- Verification
-- ========================================
SELECT 'Trade Opportunities System created successfully!' as status;
SELECT 'Tables created: autogc_trade_opportunities, autogc_access_control' as tables;
SELECT 'Functions created: get_contractor_autogc_access(), populate_autogc_access_control()' as functions;
SELECT 'Views created: contractor_trade_opportunities_view, active_opportunities_by_trade' as views;
