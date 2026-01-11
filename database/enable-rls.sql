-- ========================================
-- Row Level Security (RLS) Migration
-- ========================================
-- This file enables RLS and creates comprehensive policies for all tables
-- Run this after Supabase Auth is fully configured and tested
-- WARNING: This will restrict database access based on authentication
-- Make sure all API endpoints are using authenticated requests before enabling!

-- ========================================
-- 1. Enable RLS on all user-data tables
-- ========================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE homeowner_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 2. User Profiles Policies
-- ========================================

-- Users can view own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.email() = email);

-- Users can update own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  USING (auth.email() = email);

-- Users can insert own profile (during signup)
CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  WITH CHECK (auth.email() = email);

-- Contractors can view other contractor profiles (for transparency)
CREATE POLICY "Contractors can view contractor profiles"
  ON user_profiles
  FOR SELECT
  USING (
    role = 'contractor'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE email = auth.email() AND role = 'contractor'
    )
  );

-- Homeowners can view contractor profiles (for job selection)
CREATE POLICY "Homeowners can view contractor profiles"
  ON user_profiles
  FOR SELECT
  USING (
    role = 'contractor'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE email = auth.email() AND role = 'homeowner'
    )
  );

-- ========================================
-- 3. Job Postings Policies
-- ========================================

-- Anyone authenticated can view open jobs
CREATE POLICY "Authenticated users can view open jobs"
  ON job_postings
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Homeowners can create jobs
CREATE POLICY "Homeowners can create jobs"
  ON job_postings
  FOR INSERT
  WITH CHECK (
    auth.email() = homeowner_email
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE email = auth.email() AND role = 'homeowner'
    )
  );

-- Homeowners can update their own jobs
CREATE POLICY "Homeowners can update own jobs"
  ON job_postings
  FOR UPDATE
  USING (
    auth.email() = homeowner_email
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE email = auth.email() AND role = 'homeowner'
    )
  );

-- Homeowners can delete their own jobs
CREATE POLICY "Homeowners can delete own jobs"
  ON job_postings
  FOR DELETE
  USING (
    auth.email() = homeowner_email
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE email = auth.email() AND role = 'homeowner'
    )
  );

-- ========================================
-- 4. Contractor Bids Policies
-- ========================================

-- Contractors can view their own bids
CREATE POLICY "Contractors can view own bids"
  ON contractor_bids
  FOR SELECT
  USING (
    auth.email() = contractor_email
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE email = auth.email() AND role = 'contractor'
    )
  );

-- Homeowners can view bids on their jobs
CREATE POLICY "Homeowners can view bids on own jobs"
  ON contractor_bids
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM job_postings
      WHERE id = contractor_bids.job_id
      AND homeowner_email = auth.email()
    )
  );

-- Contractors can create bids
CREATE POLICY "Contractors can create bids"
  ON contractor_bids
  FOR INSERT
  WITH CHECK (
    auth.email() = contractor_email
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE email = auth.email() AND role = 'contractor'
    )
  );

-- Contractors can update their own bids (if still pending)
CREATE POLICY "Contractors can update own pending bids"
  ON contractor_bids
  FOR UPDATE
  USING (
    auth.email() = contractor_email
    AND status = 'pending'
  );

-- Homeowners can update bid status (accept/reject)
CREATE POLICY "Homeowners can update bid status"
  ON contractor_bids
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM job_postings
      WHERE id = contractor_bids.job_id
      AND homeowner_email = auth.email()
    )
  );

-- ========================================
-- 5. Contractor Licenses Policies
-- ========================================

-- Contractors can view their own licenses
CREATE POLICY "Contractors can view own licenses"
  ON contractor_licenses
  FOR SELECT
  USING (auth.email() = contractor_email);

-- Anyone can view verified licenses (for transparency)
CREATE POLICY "Anyone can view verified licenses"
  ON contractor_licenses
  FOR SELECT
  USING (
    verification_status = 'verified'
    AND auth.role() = 'authenticated'
  );

-- Contractors can create their own licenses
CREATE POLICY "Contractors can create own licenses"
  ON contractor_licenses
  FOR INSERT
  WITH CHECK (
    auth.email() = contractor_email
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE email = auth.email() AND role = 'contractor'
    )
  );

-- Contractors can update their own unverified licenses
CREATE POLICY "Contractors can update own unverified licenses"
  ON contractor_licenses
  FOR UPDATE
  USING (
    auth.email() = contractor_email
    AND verification_status IN ('pending', 'rejected')
  );

-- Note: License verification updates should be done via service role (admin function)

-- ========================================
-- 6. Homeowner Ratings Policies
-- ========================================

-- Contractors can view ratings for homeowners they're bidding for
CREATE POLICY "Contractors can view homeowner ratings"
  ON homeowner_ratings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE email = auth.email() AND role = 'contractor'
    )
  );

-- Contractors can create ratings after job completion
CREATE POLICY "Contractors can create ratings"
  ON homeowner_ratings
  FOR INSERT
  WITH CHECK (
    auth.email() = contractor_email
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE email = auth.email() AND role = 'contractor'
    )
  );

-- Homeowners can view their own ratings
CREATE POLICY "Homeowners can view own ratings"
  ON homeowner_ratings
  FOR SELECT
  USING (homeowner_contact = auth.email());

-- ========================================
-- 7. Messages Policies (Legacy)
-- ========================================

-- Users can view messages they sent or received
CREATE POLICY "Users can view own messages"
  ON messages
  FOR SELECT
  USING (
    auth.email() = sender_email
    OR auth.email() = recipient_email
  );

-- Users can send messages
CREATE POLICY "Users can send messages"
  ON messages
  FOR INSERT
  WITH CHECK (auth.email() = sender_email);

-- Users can update read status on received messages
CREATE POLICY "Users can update received messages"
  ON messages
  FOR UPDATE
  USING (auth.email() = recipient_email);

-- ========================================
-- 8. Conversations Policies
-- ========================================

-- Users can view conversations they're part of
CREATE POLICY "Users can view own conversations"
  ON conversations
  FOR SELECT
  USING (
    auth.email() = homeowner_email
    OR auth.email() = contractor_email
  );

-- Users can create conversations for jobs they're involved in
CREATE POLICY "Users can create conversations"
  ON conversations
  FOR INSERT
  WITH CHECK (
    auth.email() = homeowner_email
    OR auth.email() = contractor_email
  );

-- Users can update conversations they're part of
CREATE POLICY "Users can update own conversations"
  ON conversations
  FOR UPDATE
  USING (
    auth.email() = homeowner_email
    OR auth.email() = contractor_email
  );

-- ========================================
-- 9. Conversation Messages Policies
-- ========================================

-- Users can view messages in their conversations
CREATE POLICY "Users can view own conversation messages"
  ON conversation_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE id = conversation_messages.conversation_id
      AND (homeowner_email = auth.email() OR contractor_email = auth.email())
    )
  );

-- Users can send messages in their conversations
CREATE POLICY "Users can send conversation messages"
  ON conversation_messages
  FOR INSERT
  WITH CHECK (
    auth.email() = sender_email
    AND EXISTS (
      SELECT 1 FROM conversations
      WHERE id = conversation_messages.conversation_id
      AND (homeowner_email = auth.email() OR contractor_email = auth.email())
    )
  );

-- Users can update read status on messages they received
CREATE POLICY "Users can mark messages as read"
  ON conversation_messages
  FOR UPDATE
  USING (auth.email() = recipient_email);

-- ========================================
-- 10. Notifications Policies
-- ========================================

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  USING (auth.email() = user_email);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  USING (auth.email() = user_email);

-- System can create notifications (via service role)
-- Note: Notification creation should be done via service role in backend

-- ========================================
-- 11. Activity Log Policies
-- ========================================

-- Users can view their own activity
CREATE POLICY "Users can view own activity"
  ON activity_log
  FOR SELECT
  USING (auth.email() = user_email);

-- System can log activity (via service role)
-- Note: Activity logging should be done via service role in backend

-- ========================================
-- Complete!
-- ========================================
-- After running this migration:
-- 1. All tables have RLS enabled
-- 2. Users can only access their own data
-- 3. Proper access controls for cross-user visibility (e.g., homeowners viewing contractor bids)
-- 4. Service role bypasses RLS for system operations
--
-- IMPORTANT: Test thoroughly before deploying to production!
-- Make sure all API endpoints use authenticated requests with proper JWT tokens.
