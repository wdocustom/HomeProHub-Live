-- ========================================
-- Migration: Diplomat & Sentinel Features
-- Date: 2026-01-15
-- Purpose: Add Text-to-Log (Phase 4) and Forensic Security (Phase 5) capabilities
-- ========================================
-- Phase 4: The Diplomat - SMS Text-to-Log
-- Phase 5: The Sentinel - Anti-Deepfake Verification
-- ========================================

-- ========================================
-- 1. Update project_logs table
-- Add SMS source type and verification tracking
-- ========================================

-- Drop existing source constraint to add 'sms'
ALTER TABLE project_logs DROP CONSTRAINT IF EXISTS project_logs_source_check;

-- Add new source constraint including 'sms'
ALTER TABLE project_logs ADD CONSTRAINT project_logs_source_check
CHECK (source IN (
  'contractor_update', 'homeowner_update', 'system_event',
  'ai_agent', 'schedule_change', 'inspection', 'delivery', 'sms'
));

-- Add SMS-specific fields
ALTER TABLE project_logs
ADD COLUMN IF NOT EXISTS sms_from_phone TEXT,
ADD COLUMN IF NOT EXISTS sms_parsed_intent TEXT CHECK (sms_parsed_intent IN (
  'update', 'blocker', 'question', 'milestone_claim', 'other'
)),
ADD COLUMN IF NOT EXISTS sms_raw_body TEXT,
ADD COLUMN IF NOT EXISTS requires_verification BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verification_link_token TEXT;

-- Create indexes for SMS lookups
CREATE INDEX IF NOT EXISTS idx_project_logs_sms_phone ON project_logs(sms_from_phone);
CREATE INDEX IF NOT EXISTS idx_project_logs_verification ON project_logs(requires_verification) WHERE requires_verification = true;
CREATE INDEX IF NOT EXISTS idx_project_logs_token ON project_logs(verification_link_token) WHERE verification_link_token IS NOT NULL;

-- ========================================
-- 2. Create project_evidence table
-- Stores forensic verification data (GPS, photos, anti-deepfake checks)
-- ========================================
CREATE TABLE IF NOT EXISTS project_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Project and milestone references
  project_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES project_milestones(id) ON DELETE SET NULL,
  project_log_id UUID REFERENCES project_logs(id) ON DELETE SET NULL,

  -- Contractor identification
  contractor_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  contractor_phone TEXT,
  contractor_email TEXT,

  -- Evidence type
  evidence_type TEXT NOT NULL CHECK (evidence_type IN (
    'milestone_completion', 'progress_update', 'blocker_documentation', 'quality_check'
  )),

  -- Photo/Image data
  photo_url TEXT NOT NULL,
  photo_metadata JSONB DEFAULT '{}'::jsonb,
  -- Example: {"camera_model": "iPhone 14", "resolution": "4032x3024", "file_size": 2456789}

  -- GPS/Location data
  gps_latitude DECIMAL(10, 8),
  gps_longitude DECIMAL(11, 8),
  gps_accuracy_meters DECIMAL(10, 2),
  gps_timestamp TIMESTAMP WITH TIME ZONE,
  location_verified BOOLEAN DEFAULT false,
  location_distance_from_site_meters DECIMAL(10, 2),

  -- Forensic analysis (Anti-Deepfake checks)
  forensic_analysis_status TEXT DEFAULT 'pending' CHECK (forensic_analysis_status IN (
    'pending', 'analyzing', 'passed', 'failed', 'error'
  )),
  forensic_checks JSONB DEFAULT '{}'::jsonb,
  -- Example: {
  --   "is_live_capture": true,
  --   "ai_generated_probability": 0.02,
  --   "screen_capture_detected": false,
  --   "moire_pattern_detected": false,
  --   "lighting_analysis": "natural",
  --   "exif_data_present": true
  -- }

  -- Quality check (Sentinel Agent GPT-4o Vision)
  quality_check_status TEXT DEFAULT 'pending' CHECK (quality_check_status IN (
    'pending', 'analyzing', 'approved', 'rejected', 'needs_clarification'
  )),
  quality_check_result JSONB DEFAULT '{}'::jsonb,
  -- Example: {
  --   "meets_requirements": true,
  --   "milestone_requirements": ["nail_plates_visible", "wiring_properly_secured"],
  --   "observations": ["All outlets properly grounded", "Wire runs follow code"],
  --   "issues": [],
  --   "recommendation": "approved"
  -- }

  -- Overall verification result
  verification_result TEXT DEFAULT 'pending' CHECK (verification_result IN (
    'pending', 'approved', 'rejected', 'needs_resubmission'
  )),
  rejection_reason TEXT,

  -- Agent processing
  processed_by_agent TEXT, -- 'sentinel', 'diplomat', etc.
  agent_processing_time_ms INTEGER,

  -- Metadata
  user_agent TEXT, -- Browser/device info
  ip_address TEXT, -- For additional security tracking

  -- Timestamps
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for project_evidence
CREATE INDEX IF NOT EXISTS idx_project_evidence_project ON project_evidence(project_id);
CREATE INDEX IF NOT EXISTS idx_project_evidence_milestone ON project_evidence(milestone_id);
CREATE INDEX IF NOT EXISTS idx_project_evidence_contractor ON project_evidence(contractor_id);
CREATE INDEX IF NOT EXISTS idx_project_evidence_phone ON project_evidence(contractor_phone);
CREATE INDEX IF NOT EXISTS idx_project_evidence_verification_status ON project_evidence(verification_result);
CREATE INDEX IF NOT EXISTS idx_project_evidence_forensic_status ON project_evidence(forensic_analysis_status);
CREATE INDEX IF NOT EXISTS idx_project_evidence_quality_status ON project_evidence(quality_check_status);
CREATE INDEX IF NOT EXISTS idx_project_evidence_submitted_at ON project_evidence(submitted_at DESC);

-- ========================================
-- 3. Update user_profiles table
-- Add phone verification for SMS routing
-- ========================================
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_verification_code TEXT,
ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sms_notifications_enabled BOOLEAN DEFAULT true;

-- Create index for phone lookups (for SMS routing)
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON user_profiles(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone_verified ON user_profiles(phone_verified, phone) WHERE phone_verified = true;

-- ========================================
-- 4. Create contractor_project_assignments table
-- Maps contractors to specific projects for SMS routing
-- ========================================
CREATE TABLE IF NOT EXISTS contractor_project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  project_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Assignment details
  trade_type TEXT,
  role TEXT, -- 'lead', 'sub', 'specialist', etc.

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN (
    'pending', 'active', 'completed', 'removed'
  )),

  -- SMS preferences
  sms_updates_enabled BOOLEAN DEFAULT true,

  -- Timestamps
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  removed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contractor_assignments_project ON contractor_project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_contractor_assignments_contractor ON contractor_project_assignments(contractor_id);
CREATE INDEX IF NOT EXISTS idx_contractor_assignments_status ON contractor_project_assignments(status);

-- Unique constraint: one active assignment per contractor per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_contractor_assignments_unique
ON contractor_project_assignments(project_id, contractor_id) WHERE status = 'active';

-- ========================================
-- 5. Create sms_routing_log table
-- Logs all incoming SMS messages for debugging and routing
-- ========================================
CREATE TABLE IF NOT EXISTS sms_routing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Twilio webhook data
  message_sid TEXT UNIQUE NOT NULL, -- Twilio Message SID
  from_phone TEXT NOT NULL,
  to_phone TEXT NOT NULL,
  message_body TEXT NOT NULL,

  -- Routing results
  contractor_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  project_id UUID REFERENCES job_postings(id) ON DELETE SET NULL,
  routing_status TEXT DEFAULT 'pending' CHECK (routing_status IN (
    'pending', 'routed', 'unrecognized_sender', 'no_active_project', 'error'
  )),
  routing_error TEXT,

  -- Processing results
  project_log_id UUID REFERENCES project_logs(id) ON DELETE SET NULL,
  parsed_intent TEXT,
  response_sent BOOLEAN DEFAULT false,
  response_message TEXT,
  response_sid TEXT, -- Twilio response Message SID

  -- Metadata
  twilio_metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for sms_routing_log
CREATE INDEX IF NOT EXISTS idx_sms_routing_log_from_phone ON sms_routing_log(from_phone);
CREATE INDEX IF NOT EXISTS idx_sms_routing_log_message_sid ON sms_routing_log(message_sid);
CREATE INDEX IF NOT EXISTS idx_sms_routing_log_contractor ON sms_routing_log(contractor_id);
CREATE INDEX IF NOT EXISTS idx_sms_routing_log_project ON sms_routing_log(project_id);
CREATE INDEX IF NOT EXISTS idx_sms_routing_log_status ON sms_routing_log(routing_status);
CREATE INDEX IF NOT EXISTS idx_sms_routing_log_received_at ON sms_routing_log(received_at DESC);

-- ========================================
-- 6. Create verification_tokens table
-- Tracks verification links sent to contractors
-- ========================================
CREATE TABLE IF NOT EXISTS verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Token details
  token TEXT UNIQUE NOT NULL, -- Short secure token (8-12 chars)

  -- References
  project_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES project_milestones(id) ON DELETE SET NULL,
  contractor_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  project_log_id UUID REFERENCES project_logs(id) ON DELETE SET NULL,

  -- Token metadata
  token_type TEXT DEFAULT 'milestone_verification' CHECK (token_type IN (
    'milestone_verification', 'progress_update', 'blocker_documentation'
  )),

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'used', 'expired', 'cancelled'
  )),

  -- Usage tracking
  used_at TIMESTAMP WITH TIME ZONE,
  evidence_id UUID REFERENCES project_evidence(id) ON DELETE SET NULL,

  -- Expiration (tokens expire after 24 hours)
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for verification_tokens
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_project ON verification_tokens(project_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_contractor ON verification_tokens(contractor_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_status ON verification_tokens(status);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires_at ON verification_tokens(expires_at);

-- ========================================
-- 7. Update project_milestones table
-- Add verification tracking
-- ========================================
ALTER TABLE project_milestones
ADD COLUMN IF NOT EXISTS verification_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_status TEXT CHECK (verification_status IN (
  'not_required', 'pending', 'submitted', 'approved', 'rejected', 'resubmission_required'
)) DEFAULT 'not_required',
ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verification_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS evidence_ids JSONB DEFAULT '[]'::jsonb;
-- Example: ["uuid-1", "uuid-2"] - References to project_evidence records

-- Create index for verification tracking
CREATE INDEX IF NOT EXISTS idx_project_milestones_verification ON project_milestones(verification_status) WHERE verification_required = true;

-- ========================================
-- 8. Create Helper Views
-- ========================================

-- View: Pending verifications (milestones awaiting photo proof)
CREATE OR REPLACE VIEW pending_verifications_view AS
SELECT
  pm.project_id,
  j.title as project_title,
  pm.id as milestone_id,
  pm.milestone_name,
  pm.verification_status,
  pm.verification_submitted_at,
  pl.sms_from_phone as contractor_phone,
  up.email as contractor_email,
  up.first_name || ' ' || up.last_name as contractor_name,
  vt.token as verification_token,
  vt.expires_at as token_expires_at,
  vt.status as token_status
FROM project_milestones pm
JOIN job_postings j ON pm.project_id = j.id
LEFT JOIN project_logs pl ON pl.project_id = pm.project_id
  AND pl.requires_verification = true
  AND pl.metadata->>'milestone_id' = pm.milestone_id
LEFT JOIN user_profiles up ON up.phone = pl.sms_from_phone
LEFT JOIN verification_tokens vt ON vt.milestone_id = pm.id AND vt.status = 'pending'
WHERE pm.verification_required = true
  AND pm.verification_status IN ('pending', 'submitted', 'resubmission_required')
ORDER BY pm.verification_submitted_at DESC NULLS LAST;

-- View: Evidence verification queue (for Sentinel Agent)
CREATE OR REPLACE VIEW evidence_verification_queue AS
SELECT
  pe.id as evidence_id,
  pe.project_id,
  j.title as project_title,
  pm.milestone_name,
  pe.contractor_email,
  pe.contractor_phone,
  pe.photo_url,
  pe.gps_latitude,
  pe.gps_longitude,
  pe.location_distance_from_site_meters,
  pe.location_verified,
  pe.forensic_analysis_status,
  pe.quality_check_status,
  pe.verification_result,
  pe.submitted_at,
  j.address as project_address,
  j.zip_code as project_zip
FROM project_evidence pe
JOIN job_postings j ON pe.project_id = j.id
LEFT JOIN project_milestones pm ON pe.milestone_id = pm.id
WHERE pe.verification_result = 'pending'
  OR pe.forensic_analysis_status IN ('pending', 'analyzing')
  OR pe.quality_check_status IN ('pending', 'analyzing')
ORDER BY pe.submitted_at ASC;

-- View: SMS routing diagnostics
CREATE OR REPLACE VIEW sms_routing_diagnostics AS
SELECT
  srl.id,
  srl.from_phone,
  srl.message_body,
  srl.routing_status,
  srl.routing_error,
  up.email as contractor_email,
  up.first_name || ' ' || up.last_name as contractor_name,
  j.title as project_title,
  srl.parsed_intent,
  srl.response_sent,
  srl.received_at,
  srl.processed_at
FROM sms_routing_log srl
LEFT JOIN user_profiles up ON srl.contractor_id = up.id
LEFT JOIN job_postings j ON srl.project_id = j.id
ORDER BY srl.received_at DESC
LIMIT 100;

-- View: Contractor active projects (for SMS routing)
CREATE OR REPLACE VIEW contractor_active_projects AS
SELECT
  cpa.contractor_id,
  up.phone as contractor_phone,
  up.email as contractor_email,
  up.first_name || ' ' || up.last_name as contractor_name,
  cpa.project_id,
  j.title as project_title,
  j.address as project_address,
  cpa.trade_type,
  cpa.role,
  cpa.sms_updates_enabled,
  ps.current_phase,
  ps.current_milestone_id
FROM contractor_project_assignments cpa
JOIN user_profiles up ON cpa.contractor_id = up.id
JOIN job_postings j ON cpa.project_id = j.id
LEFT JOIN project_states ps ON j.id = ps.project_id
WHERE cpa.status = 'active'
  AND j.status IN ('in_progress', 'active')
  AND up.phone IS NOT NULL;

-- ========================================
-- 9. Update Triggers
-- ========================================

-- Auto-expire verification tokens
CREATE OR REPLACE FUNCTION expire_verification_tokens()
RETURNS void AS $$
BEGIN
  UPDATE verification_tokens
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 10. Seed default values
-- ========================================

-- Add verification requirement to critical milestones
UPDATE project_milestones
SET verification_required = true,
    verification_status = 'pending'
WHERE requires_inspection = true
  AND verification_status = 'not_required';

-- ========================================
-- Verification
-- ========================================
SELECT 'Diplomat & Sentinel features migration completed successfully!' as status;
SELECT 'Tables created: project_evidence, contractor_project_assignments, sms_routing_log, verification_tokens' as new_tables;
SELECT 'Tables updated: project_logs (SMS support), user_profiles (phone verification), project_milestones (verification tracking)' as updated_tables;
SELECT 'Views created: pending_verifications_view, evidence_verification_queue, sms_routing_diagnostics, contractor_active_projects' as new_views;
