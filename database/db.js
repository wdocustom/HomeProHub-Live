/**
 * HomeProHub Database Module
 * Handles all database operations using Supabase
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Warning: Supabase credentials not configured. Database operations will fail.');
}

const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '');

// ========================================
// User Profile Operations
// ========================================

/**
 * Create or update user profile
 */
async function upsertUserProfile(profileData) {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(profileData, { onConflict: 'email' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get user profile by email
 */
async function getUserProfile(email) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('email', email)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data;
}

/**
 * Update user profile
 */
async function updateUserProfile(email, updates) {
  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('email', email)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ========================================
// Job Posting Operations
// ========================================

/**
 * Create a new job posting
 */
async function createJobPosting(jobData) {
  const { data, error } = await supabase
    .from('job_postings')
    .insert(jobData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all open jobs (optionally filter by zip code or status)
 */
async function getJobs(filters = {}) {
  let query = supabase
    .from('job_postings')
    .select(`
      *,
      homeowner:user_profiles!job_postings_homeowner_email_fkey(first_name, last_name, phone)
    `)
    .order('posted_at', { ascending: false });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.zipCode) {
    query = query.eq('zip_code', filters.zipCode);
  }
  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Get job by ID with related data
 */
async function getJobById(jobId) {
  const { data, error } = await supabase
    .from('job_postings')
    .select(`
      *,
      homeowner:user_profiles!job_postings_homeowner_email_fkey(first_name, last_name, phone),
      bids:contractor_bids(*)
    `)
    .eq('id', jobId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get jobs posted by a specific homeowner
 */
async function getJobsByHomeowner(email) {
  const { data, error } = await supabase
    .from('job_postings')
    .select(`
      *,
      bids:contractor_bids(
        *,
        contractor:user_profiles!contractor_bids_contractor_email_fkey(business_name, phone)
      )
    `)
    .eq('homeowner_email', email)
    .order('posted_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Update job status
 */
async function updateJobStatus(jobId, status, completedAt = null) {
  const updates = { status };
  if (completedAt) updates.completed_at = completedAt;

  const { data, error } = await supabase
    .from('job_postings')
    .update(updates)
    .eq('id', jobId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Increment job view count
 */
async function incrementJobViews(jobId) {
  const { error } = await supabase.rpc('increment_view_count', { job_id: jobId });
  if (error) console.error('Error incrementing view count:', error);
}

// ========================================
// Contractor Bid Operations
// ========================================

/**
 * Submit a contractor bid
 */
async function submitBid(bidData) {
  const { data, error } = await supabase
    .from('contractor_bids')
    .insert(bidData)
    .select()
    .single();

  if (error) throw error;

  // Update job bid_count
  await supabase.rpc('increment_bid_count', { job_id: bidData.job_id });

  return data;
}

/**
 * Get all bids for a job
 */
async function getBidsByJob(jobId) {
  const { data, error } = await supabase
    .from('contractor_bids')
    .select(`
      *,
      contractor:user_profiles!contractor_bids_contractor_email_fkey(
        business_name,
        first_name,
        last_name,
        phone,
        license_number,
        years_in_business
      )
    `)
    .eq('job_id', jobId)
    .order('submitted_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Get all bids submitted by a contractor
 */
async function getBidsByContractor(email) {
  const { data, error } = await supabase
    .from('contractor_bids')
    .select(`
      *,
      job:job_postings(
        *,
        homeowner:user_profiles!job_postings_homeowner_email_fkey(first_name, last_name, phone)
      )
    `)
    .eq('contractor_email', email)
    .order('submitted_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Update bid status
 */
async function updateBidStatus(bidId, status) {
  const { data, error } = await supabase
    .from('contractor_bids')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', bidId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Accept a bid (and reject others for the same job)
 */
async function acceptBid(bidId, jobId) {
  // Start a transaction-like operation
  // 1. Accept the selected bid
  const { data: acceptedBid, error: acceptError } = await supabase
    .from('contractor_bids')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', bidId)
    .select()
    .single();

  if (acceptError) throw acceptError;

  // 2. Reject other pending bids for the same job
  await supabase
    .from('contractor_bids')
    .update({ status: 'rejected', responded_at: new Date().toISOString() })
    .eq('job_id', jobId)
    .neq('id', bidId)
    .eq('status', 'pending');

  // 3. Update job status to in_progress and set winning_bid_id
  await supabase
    .from('job_postings')
    .update({ status: 'in_progress', winning_bid_id: bidId })
    .eq('id', jobId);

  return acceptedBid;
}

// ========================================
// Homeowner Rating Operations
// ========================================

/**
 * Submit a homeowner rating
 */
async function submitHomeownerRating(ratingData) {
  const { data, error } = await supabase
    .from('homeowner_ratings')
    .insert(ratingData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get homeowner rating summary (aggregated)
 */
async function getHomeownerRating(contact) {
  const { data, error } = await supabase
    .from('homeowner_rating_summary')
    .select('*')
    .eq('homeowner_contact', contact)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Get all ratings for a homeowner
 */
async function getHomeownerRatings(contact) {
  const { data, error } = await supabase
    .from('homeowner_ratings')
    .select(`
      *,
      contractor:user_profiles!homeowner_ratings_contractor_email_fkey(business_name, first_name, last_name)
    `)
    .eq('homeowner_contact', contact)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Get top rated homeowners (for directory)
 */
async function getTopRatedHomeowners(limit = 50) {
  const { data, error } = await supabase
    .from('homeowner_rating_summary')
    .select('*')
    .order('overall_rating', { ascending: false })
    .order('total_ratings', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

// ========================================
// Messaging Operations
// ========================================

/**
 * Send a message
 */
async function sendMessage(messageData) {
  const { data, error } = await supabase
    .from('messages')
    .insert(messageData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get messages for a thread
 */
async function getMessagesByThread(threadId) {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:user_profiles!messages_sender_email_fkey(first_name, last_name, business_name)
    `)
    .eq('thread_id', threadId)
    .order('sent_at', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Get all conversations for a user
 */
async function getUserConversations(email) {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      thread_id,
      job_id,
      job:job_postings(title),
      sender_email,
      recipient_email,
      message_text,
      sent_at,
      read
    `)
    .or(`sender_email.eq.${email},recipient_email.eq.${email}`)
    .order('sent_at', { ascending: false });

  if (error) throw error;

  // Group by thread_id and get the latest message for each
  const threads = {};
  data.forEach(msg => {
    if (!threads[msg.thread_id]) {
      threads[msg.thread_id] = msg;
    }
  });

  return Object.values(threads);
}

/**
 * Mark messages as read
 */
async function markMessagesAsRead(threadId, recipientEmail) {
  const { error } = await supabase
    .from('messages')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('thread_id', threadId)
    .eq('recipient_email', recipientEmail)
    .eq('read', false);

  if (error) throw error;
}

/**
 * Get unread message count
 */
async function getUnreadCount(email) {
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_email', email)
    .eq('read', false);

  if (error) throw error;
  return count;
}

// ========================================
// Notification Operations
// ========================================

/**
 * Create a notification
 */
async function createNotification(notificationData) {
  const { data, error } = await supabase
    .from('notifications')
    .insert(notificationData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get notifications for a user
 */
async function getNotifications(email, limit = 50) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_email', email)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

/**
 * Get unread notification count
 */
async function getUnreadNotificationCount(email) {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_email', email)
    .eq('read', false);

  if (error) throw error;
  return count;
}

/**
 * Mark notification as read
 */
async function markNotificationAsRead(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId);

  if (error) throw error;
}

/**
 * Mark notification email as sent
 */
async function markNotificationEmailSent(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .update({ email_sent: true, email_sent_at: new Date().toISOString() })
    .eq('id', notificationId);

  if (error) throw error;
}

// ========================================
// Activity Log Operations
// ========================================

/**
 * Log user activity
 */
async function logActivity(activityData) {
  const { error } = await supabase
    .from('activity_log')
    .insert(activityData);

  if (error) console.error('Error logging activity:', error);
}

// ========================================
// Export all functions
// ========================================

module.exports = {
  supabase,

  // User profiles
  upsertUserProfile,
  getUserProfile,
  updateUserProfile,

  // Job postings
  createJobPosting,
  getJobs,
  getJobById,
  getJobsByHomeowner,
  updateJobStatus,
  incrementJobViews,

  // Bids
  submitBid,
  getBidsByJob,
  getBidsByContractor,
  updateBidStatus,
  acceptBid,

  // Ratings
  submitHomeownerRating,
  getHomeownerRating,
  getHomeownerRatings,
  getTopRatedHomeowners,

  // Messaging
  sendMessage,
  getMessagesByThread,
  getUserConversations,
  markMessagesAsRead,
  getUnreadCount,

  // Notifications
  createNotification,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markNotificationEmailSent,

  // Activity
  logActivity
};
