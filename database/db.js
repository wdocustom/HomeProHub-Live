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
    .select('*')
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
  // Get the job
  const { data: job, error: jobError } = await supabase
    .from('job_postings')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError) throw jobError;

  // Get bids for this job
  const { data: bids, error: bidsError } = await supabase
    .from('contractor_bids')
    .select('*')
    .eq('job_id', jobId);

  if (bidsError) throw bidsError;

  // Combine and return
  return { ...job, bids: bids || [] };
}

/**
 * Get jobs posted by a specific homeowner
 */
async function getJobsByHomeowner(email) {
  // Get jobs for this homeowner
  const { data: jobs, error: jobsError } = await supabase
    .from('job_postings')
    .select('*')
    .eq('homeowner_email', email)
    .order('posted_at', { ascending: false });

  if (jobsError) throw jobsError;

  // Get bids for each job
  const jobIds = jobs.map(job => job.id);
  if (jobIds.length > 0) {
    const { data: bids, error: bidsError } = await supabase
      .from('contractor_bids')
      .select('*')
      .in('job_id', jobIds);

    if (bidsError) throw bidsError;

    // Attach bids to their respective jobs
    const jobsWithBids = jobs.map(job => ({
      ...job,
      bids: bids.filter(bid => bid.job_id === job.id)
    }));

    return jobsWithBids;
  }

  return jobs.map(job => ({ ...job, bids: [] }));
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
    .select('*')
    .eq('job_id', jobId)
    .order('submitted_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Get all bids submitted by a contractor
 */
async function getBidsByContractor(email) {
  // Get bids for this contractor
  const { data: bids, error: bidsError } = await supabase
    .from('contractor_bids')
    .select('*')
    .eq('contractor_email', email)
    .order('submitted_at', { ascending: false});

  if (bidsError) throw bidsError;

  // Get job details for each bid
  const jobIds = bids.map(bid => bid.job_id);
  if (jobIds.length > 0) {
    const { data: jobs, error: jobsError } = await supabase
      .from('job_postings')
      .select('*')
      .in('id', jobIds);

    if (jobsError) throw jobsError;

    // Attach job details to each bid
    const bidsWithJobs = bids.map(bid => ({
      ...bid,
      job: jobs.find(job => job.id === bid.job_id)
    }));

    return bidsWithJobs;
  }

  return bids;
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
    .select('*')
    .eq('homeowner_contact', contact)
    .order('created_at', { ascending: false});

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
// Contractor License Operations
// ========================================

/**
 * Add or update contractor license
 */
async function addContractorLicense(licenseData) {
  const { data, error } = await supabase
    .from('contractor_licenses')
    .upsert(licenseData, {
      onConflict: 'contractor_email,trade_type,state'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all licenses for a contractor
 */
async function getContractorLicenses(contractorEmail) {
  const { data, error } = await supabase
    .from('contractor_licenses')
    .select('*')
    .eq('contractor_email', contractorEmail)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Get specific license for contractor by trade and state
 */
async function getContractorLicenseByTrade(contractorEmail, tradeType, state) {
  const { data, error } = await supabase
    .from('contractor_licenses')
    .select('*')
    .eq('contractor_email', contractorEmail)
    .eq('trade_type', tradeType)
    .eq('state', state)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Update license verification status (admin function)
 */
async function updateLicenseVerificationStatus(licenseId, status, verifiedBy, rejectionReason = null) {
  const updates = {
    verification_status: status,
    verified_by: verifiedBy,
    verified_at: new Date().toISOString()
  };

  if (rejectionReason) {
    updates.rejection_reason = rejectionReason;
  }

  const { data, error } = await supabase
    .from('contractor_licenses')
    .update(updates)
    .eq('id', licenseId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get verified licenses for a contractor in a specific state
 */
async function getVerifiedLicenses(contractorEmail, state) {
  const { data, error } = await supabase
    .from('contractor_licenses')
    .select('*')
    .eq('contractor_email', contractorEmail)
    .eq('state', state)
    .eq('verification_status', 'verified')
    .gte('expiration_date', new Date().toISOString().split('T')[0]); // Not expired

  if (error) throw error;
  return data;
}

/**
 * Check if contractor has required license for a job category and location
 */
async function checkContractorLicenseForJob(contractorEmail, category, state) {
  // Map job categories to trade types
  const categoryToTrade = {
    'general': 'general_contractor',
    'plumbing': 'plumbing',
    'electrical': 'electrical',
    'hvac': 'hvac',
    'roofing': 'roofing',
    'painting': 'painting',
    'landscaping': 'landscaping',
    'flooring': 'flooring',
    'carpentry': 'carpentry',
    'masonry': 'masonry',
    'concrete': 'concrete',
    'drywall': 'drywall',
    'insulation': 'insulation',
    'siding': 'siding'
  };

  const tradeType = categoryToTrade[category] || 'general_contractor';

  // Check if contractor has this license
  const license = await getContractorLicenseByTrade(contractorEmail, tradeType, state);

  if (!license) {
    return {
      hasLicense: false,
      status: 'unlicensed',
      tradeType: tradeType
    };
  }

  // Check if verified
  if (license.verification_status !== 'verified') {
    return {
      hasLicense: true,
      status: license.verification_status,
      license: license,
      tradeType: tradeType
    };
  }

  // Check if expired
  if (license.expiration_date && new Date(license.expiration_date) < new Date()) {
    return {
      hasLicense: true,
      status: 'expired',
      license: license,
      tradeType: tradeType
    };
  }

  return {
    hasLicense: true,
    status: 'verified',
    license: license,
    tradeType: tradeType
  };
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
    .select('*')
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
// Conversation-Based Messaging Operations
// ========================================

/**
 * Create or find an existing conversation
 */
async function createOrFindConversation(jobId, homeownerEmail, contractorEmail) {
  // Try to find existing conversation
  const { data: existing, error: findError } = await supabase
    .from('conversations')
    .select('*')
    .eq('job_id', jobId)
    .eq('homeowner_email', homeownerEmail)
    .eq('contractor_email', contractorEmail)
    .single();

  if (existing) return existing;

  // Create new conversation if not found
  const { data: newConv, error: createError } = await supabase
    .from('conversations')
    .insert({
      job_id: jobId,
      homeowner_email: homeownerEmail,
      contractor_email: contractorEmail,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (createError) throw createError;
  return newConv;
}

/**
 * Get all conversations for a user with details
 */
async function getConversationsForUser(userEmail) {
  // Get conversations where user is either homeowner or contractor
  const { data: conversations, error } = await supabase
    .from('conversations')
    .select(`
      id,
      job_id,
      homeowner_email,
      contractor_email,
      created_at,
      job_postings!inner(
        title,
        description,
        status
      )
    `)
    .or(`homeowner_email.eq.${userEmail},contractor_email.eq.${userEmail}`)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  // For each conversation, get the last message and unread count
  const conversationsWithDetails = await Promise.all(
    conversations.map(async (conv) => {
      // Get last message
      const { data: lastMessage } = await supabase
        .from('conversation_messages')
        .select('message, created_at, sender_email')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Get unread count
      const { count: unreadCount } = await supabase
        .from('conversation_messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .eq('recipient_email', userEmail)
        .eq('read', false);

      return {
        id: conv.id,
        job_id: conv.job_id,
        job_title: conv.job_postings?.title || 'Unknown Job',
        homeowner_email: conv.homeowner_email,
        contractor_email: conv.contractor_email,
        homeowner_name: conv.homeowner_email.split('@')[0], // Placeholder
        contractor_name: conv.contractor_email.split('@')[0], // Placeholder
        last_message: lastMessage?.message || null,
        last_message_time: lastMessage?.created_at || conv.created_at,
        unread_count: unreadCount || 0
      };
    })
  );

  return conversationsWithDetails;
}

/**
 * Get messages for a conversation
 */
async function getConversationMessages(conversationId) {
  const { data, error } = await supabase
    .from('conversation_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Send a message in a conversation
 */
async function sendConversationMessage(messageData) {
  const { data, error } = await supabase
    .from('conversation_messages')
    .insert({
      conversation_id: messageData.conversation_id,
      sender_email: messageData.sender_email,
      recipient_email: messageData.recipient_email,
      message: messageData.message,
      created_at: new Date().toISOString(),
      read: false
    })
    .select()
    .single();

  if (error) throw error;

  // Update conversation's updated_at timestamp
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', messageData.conversation_id);

  return data;
}

/**
 * Mark conversation messages as read
 */
async function markConversationAsRead(conversationId, userEmail) {
  const { error } = await supabase
    .from('conversation_messages')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('recipient_email', userEmail)
    .eq('read', false);

  if (error) throw error;
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

  // Contractor licenses
  addContractorLicense,
  getContractorLicenses,
  getContractorLicenseByTrade,
  updateLicenseVerificationStatus,
  getVerifiedLicenses,
  checkContractorLicenseForJob,

  // Messaging (legacy thread-based)
  sendMessage,
  getMessagesByThread,
  getUserConversations,
  markMessagesAsRead,
  getUnreadCount,

  // Conversation-based messaging
  createOrFindConversation,
  getConversationsForUser,
  getConversationMessages,
  sendConversationMessage,
  markConversationAsRead,

  // Notifications
  createNotification,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markNotificationEmailSent,

  // Activity
  logActivity
};
