-- ========================================
-- HomeProHub Database Schema
-- ========================================
-- PostgreSQL/Supabase Schema
-- Run this in your Supabase SQL Editor or via migration

-- ========================================
-- 1. User Profiles Table
-- ========================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('homeowner', 'contractor')),

  -- Common fields
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  zip_code TEXT,

  -- Homeowner specific
  address TEXT,

  -- Contractor specific
  business_name TEXT,
  company_name TEXT,
  trade TEXT,
  license_number TEXT,
  years_in_business INTEGER,
  street TEXT,
  city TEXT,
  state TEXT,

  -- Social media (contractors)
  instagram_url TEXT,
  facebook_url TEXT,
  tiktok_url TEXT,
  youtube_url TEXT,
  reddit_url TEXT,

  -- Flags
  profile_complete BOOLEAN DEFAULT false,
  email_verified BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_zip_code ON user_profiles(zip_code);

-- ========================================
-- 2. Job Postings Table
-- ========================================
CREATE TABLE IF NOT EXISTS job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Job details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  address TEXT NOT NULL,
  zip_code TEXT NOT NULL,

  -- Budget
  budget_low INTEGER,
  budget_high INTEGER,

  -- Urgency and status
  urgency TEXT CHECK (urgency IN ('flexible', 'soon', 'urgent')) DEFAULT 'flexible',
  status TEXT CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')) DEFAULT 'open',

  -- AI analysis
  original_question TEXT,
  ai_analysis TEXT,

  -- Homeowner info
  homeowner_email TEXT NOT NULL,
  homeowner_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Metadata
  view_count INTEGER DEFAULT 0,
  bid_count INTEGER DEFAULT 0,

  -- Timestamps
  posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Winning bid
  winning_bid_id UUID
);

-- Indexes for job listings
CREATE INDEX IF NOT EXISTS idx_job_postings_status ON job_postings(status);
CREATE INDEX IF NOT EXISTS idx_job_postings_category ON job_postings(category);
CREATE INDEX IF NOT EXISTS idx_job_postings_zip_code ON job_postings(zip_code);
CREATE INDEX IF NOT EXISTS idx_job_postings_homeowner_email ON job_postings(homeowner_email);
CREATE INDEX IF NOT EXISTS idx_job_postings_posted_at ON job_postings(posted_at DESC);

-- ========================================
-- 3. Contractor Bids Table
-- ========================================
CREATE TABLE IF NOT EXISTS contractor_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Job reference
  job_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,

  -- Contractor info
  contractor_email TEXT NOT NULL,
  contractor_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  contractor_business_name TEXT,

  -- Bid details
  bid_amount_low INTEGER NOT NULL,
  bid_amount_high INTEGER NOT NULL,
  estimated_duration TEXT,
  start_availability TEXT,

  -- Message to homeowner
  message TEXT,

  -- Status
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')) DEFAULT 'pending',

  -- Timestamps
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for bids
CREATE INDEX IF NOT EXISTS idx_contractor_bids_job_id ON contractor_bids(job_id);
CREATE INDEX IF NOT EXISTS idx_contractor_bids_contractor_email ON contractor_bids(contractor_email);
CREATE INDEX IF NOT EXISTS idx_contractor_bids_status ON contractor_bids(status);
CREATE INDEX IF NOT EXISTS idx_contractor_bids_submitted_at ON contractor_bids(submitted_at DESC);

-- Unique constraint: one bid per contractor per job
CREATE UNIQUE INDEX IF NOT EXISTS idx_contractor_bids_unique ON contractor_bids(job_id, contractor_email);

-- ========================================
-- 4. Homeowner Ratings Table
-- ========================================
CREATE TABLE IF NOT EXISTS homeowner_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Homeowner identification (email or phone to track across addresses)
  homeowner_contact TEXT NOT NULL,
  homeowner_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

  -- Project details
  project_address TEXT NOT NULL,
  job_id UUID REFERENCES job_postings(id) ON DELETE SET NULL,

  -- Contractor who rated
  contractor_email TEXT NOT NULL,
  contractor_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Ratings (1-5 stars)
  communication_rating INTEGER NOT NULL CHECK (communication_rating BETWEEN 1 AND 5),
  decision_speed_rating INTEGER NOT NULL CHECK (decision_speed_rating BETWEEN 1 AND 5),
  payment_rating INTEGER NOT NULL CHECK (payment_rating BETWEEN 1 AND 5),

  -- Additional info
  project_complexity TEXT CHECK (project_complexity IN ('simple', 'moderate', 'complex')),
  comments TEXT,

  -- Flags
  verified BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for ratings
CREATE INDEX IF NOT EXISTS idx_homeowner_ratings_contact ON homeowner_ratings(homeowner_contact);
CREATE INDEX IF NOT EXISTS idx_homeowner_ratings_contractor_email ON homeowner_ratings(contractor_email);
CREATE INDEX IF NOT EXISTS idx_homeowner_ratings_job_id ON homeowner_ratings(job_id);

-- Unique constraint: one rating per contractor per job
CREATE UNIQUE INDEX IF NOT EXISTS idx_homeowner_ratings_unique ON homeowner_ratings(job_id, contractor_email) WHERE job_id IS NOT NULL;

-- ========================================
-- 5. Messages Table (In-App Messaging)
-- ========================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Thread/Conversation (usually tied to a job)
  job_id UUID REFERENCES job_postings(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL,

  -- Participants
  sender_email TEXT NOT NULL,
  sender_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  recipient_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

  -- Message content
  message_text TEXT NOT NULL,

  -- Attachments (stored as JSON array of URLs)
  attachments JSONB DEFAULT '[]'::jsonb,

  -- Message metadata
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Message type
  message_type TEXT CHECK (message_type IN ('text', 'system', 'notification')) DEFAULT 'text'
);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_job_id ON messages(job_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_email ON messages(sender_email);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_email ON messages(recipient_email);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(read) WHERE read = false;

-- ========================================
-- 5b. Conversations Table (New Conversation-Based Messaging)
-- ========================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Associated job
  job_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,

  -- Participants
  homeowner_email TEXT NOT NULL,
  contractor_email TEXT NOT NULL,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for conversations
CREATE INDEX IF NOT EXISTS idx_conversations_job_id ON conversations(job_id);
CREATE INDEX IF NOT EXISTS idx_conversations_homeowner_email ON conversations(homeowner_email);
CREATE INDEX IF NOT EXISTS idx_conversations_contractor_email ON conversations(contractor_email);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);

-- Unique constraint to prevent duplicate conversations for same job/participants
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_unique ON conversations(job_id, homeowner_email, contractor_email);

-- ========================================
-- 5c. Conversation Messages Table
-- ========================================
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Conversation reference
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

  -- Message participants
  sender_email TEXT NOT NULL,
  recipient_email TEXT NOT NULL,

  -- Message content
  message TEXT NOT NULL,

  -- Message metadata
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for conversation messages
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_sender_email ON conversation_messages(sender_email);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_recipient_email ON conversation_messages(recipient_email);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at ON conversation_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_read ON conversation_messages(read, recipient_email) WHERE read = false;

-- ========================================
-- 6. Notifications Table
-- ========================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recipient
  user_email TEXT NOT NULL,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Notification details
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'new_job', 'new_bid', 'bid_accepted', 'bid_rejected',
    'new_message', 'rating_received', 'job_completed'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Related entities
  job_id UUID REFERENCES job_postings(id) ON DELETE CASCADE,
  bid_id UUID REFERENCES contractor_bids(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,

  -- Link for action
  action_url TEXT,

  -- Status
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_email ON notifications(user_email);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);

-- ========================================
-- 7. Activity Log Table (for analytics)
-- ========================================
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User
  user_email TEXT,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

  -- Activity details
  activity_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- IP and user agent for security
  ip_address TEXT,
  user_agent TEXT,

  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for activity log
CREATE INDEX IF NOT EXISTS idx_activity_log_user_email ON activity_log(user_email);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);

-- ========================================
-- 8. Create View: Homeowner Aggregate Ratings
-- ========================================
CREATE OR REPLACE VIEW homeowner_rating_summary AS
SELECT
  homeowner_contact,
  homeowner_id,
  COUNT(*) as total_ratings,
  ROUND(AVG(communication_rating), 2) as avg_communication,
  ROUND(AVG(decision_speed_rating), 2) as avg_decision_speed,
  ROUND(AVG(payment_rating), 2) as avg_payment,
  ROUND(AVG((communication_rating + decision_speed_rating + payment_rating) / 3.0), 2) as overall_rating,
  MAX(created_at) as last_rated_at
FROM homeowner_ratings
GROUP BY homeowner_contact, homeowner_id;

-- ========================================
-- 9. Create View: Job Board with Bid Count
-- ========================================
CREATE OR REPLACE VIEW job_board_view AS
SELECT
  j.*,
  up.first_name || ' ' || up.last_name as homeowner_name,
  up.phone as homeowner_phone,
  COUNT(DISTINCT cb.id) as total_bids
FROM job_postings j
LEFT JOIN user_profiles up ON j.homeowner_email = up.email
LEFT JOIN contractor_bids cb ON j.id = cb.job_id
GROUP BY j.id, up.first_name, up.last_name, up.phone;

-- ========================================
-- 10. Triggers for updated_at timestamps
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_job_postings_updated_at ON job_postings;
CREATE TRIGGER update_job_postings_updated_at
  BEFORE UPDATE ON job_postings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contractor_bids_updated_at ON contractor_bids;
CREATE TRIGGER update_contractor_bids_updated_at
  BEFORE UPDATE ON contractor_bids
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 11. Row Level Security (RLS) Policies
-- ========================================
-- Enable RLS on all tables (uncomment when using Supabase auth)
-- ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE contractor_bids ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE homeowner_ratings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Example policy (users can only see their own profile)
-- CREATE POLICY "Users can view own profile" ON user_profiles
--   FOR SELECT USING (auth.email() = email);

-- CREATE POLICY "Users can update own profile" ON user_profiles
--   FOR UPDATE USING (auth.email() = email);

-- ========================================
-- Complete!
-- ========================================
-- This schema provides:
-- 1. User profiles for both homeowners and contractors
-- 2. Job postings with budget and urgency
-- 3. Contractor bidding system
-- 4. Homeowner rating system (track by email/phone)
-- 5. In-app messaging with attachments
-- 6. Notification system with email flags
-- 7. Activity logging for analytics
-- 8. Aggregate views for ratings and job boards
-- 9. Automatic timestamp updates
-- 10. Ready for Row Level Security policies
