/**
 * HomeProHub Database Module
 * Handles all database operations using Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const dns = require('dns').promises;
const { parse } = require('url');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Warning: Supabase credentials not configured. Database operations will fail.');
}

const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '');

// PostgreSQL connection pool
let pool;

/**
 * Resilient DNS Resolver with Retry Logic
 * Resolves hostname to IPv4 address to prevent ENETUNREACH (IPv6 blocked)
 * Wraps resolution in retry loop to handle transient ENOTFOUND errors
 */
async function resolveDbHost(hostname, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[DB] Attempting to resolve IPv4 for ${hostname} (Try ${i+1}/${retries})...`);
      const addresses = await dns.resolve4(hostname); // Force IPv4
      if (addresses && addresses.length > 0) {
        console.log(`[DB] Resolved to: ${addresses[0]}`);
        return addresses[0];
      }
    } catch (err) {
      console.warn(`[DB] DNS Resolution failed: ${err.message}. Retrying...`);
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, 1000)); // Wait 1s before retry
      }
    }
  }
  throw new Error(`Failed to resolve IPv4 for ${hostname} after ${retries} attempts`);
}

/**
 * Get or initialize PostgreSQL pool
 */
async function getPool() {
  if (pool) return pool;

  try {
    // 1. Parse the connection string
    const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

    if (!connectionString) {
      console.warn('⚠️  DATABASE_URL not configured. Raw SQL queries (db.query) will not work.');
      return null;
    }

    console.log('[DB] Initializing PostgreSQL connection pool...');

    // 2. Parse the DATABASE_URL to extract components
    const config = parse(connectionString);

    // 3. Resolve IP manually to prevent ENETUNREACH (IPv6 blocked)
    const ip = await resolveDbHost(config.hostname);

    const auth = config.auth ? config.auth.split(':') : [];

    // 4. Create Pool with explicit IPv4 connection
    pool = new Pool({
      user: auth[0],
      password: auth[1],
      host: ip, // <--- DIRECT IP CONNECTION (IPv4)
      port: config.port || 5432,
      database: config.pathname.split('/')[1],
      ssl: { rejectUnauthorized: false }, // Required for Supabase
      connectionTimeoutMillis: 10000,     // 10 second timeout
      idleTimeoutMillis: 30000,
      max: 20
    });

    // Error handler to prevent crashing on idle connection loss
    pool.on('error', (err) => {
      console.error('[DB Pool Error]', err);
      // Don't exit, just log it. The pool will reconnect.
    });

    console.log('✓ PostgreSQL connection pool initialized');

  } catch (err) {
    console.error('[DB Config Error] Failed to initialize DB pool:', err);
    throw err;
  }

  return pool;
}

/**
 * Execute raw SQL query (for compatibility with code expecting PostgreSQL client)
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<{rows: Array, rowCount: number}>} Query result
 */
async function query(text, params) {
  const p = await getPool();

  if (!p) {
    throw new Error('PostgreSQL connection pool not initialized. Set DATABASE_URL in environment variables.');
  }

  return p.query(text, params);
}

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

/**
 * Update contractor license information in user profile
 */
async function updateContractorLicense(licenseData) {
  const { email, ...updates } = licenseData;

  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('email', email)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get contractor by verification ID
 */
async function getContractorByVerificationId(verificationId) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('verification_id', verificationId)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data;
}

/**
 * Get contractor's trade type from licenses
 * Returns the first verified license trade type, or first pending license if no verified ones
 * Falls back to user_profiles.trade if no licenses found
 */
async function getContractorTradeType(email) {
  const { data, error } = await supabase
    .from('contractor_licenses')
    .select('trade_type, verification_status')
    .eq('contractor_email', email)
    .order('verification_status', { ascending: true }) // verified comes before pending alphabetically
    .order('created_at', { ascending: false });

  if (error && error.code !== 'PGRST116') throw error;

  if (!data || data.length === 0) {
    // No licenses found - fallback to user_profiles.trade
    const profile = await getUserProfile(email);
    return profile?.trade || 'general_contractor'; // Default to general_contractor if no trade specified
  }

  // Prefer verified licenses, fall back to first license
  const verifiedLicense = data.find(l => l.verification_status === 'verified');
  const license = verifiedLicense || data[0];

  return license.trade_type;
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
      attachments: messageData.attachments || [],
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
// Review Operations
// ========================================

/**
 * Create a review for a completed project
 */
async function createReview(reviewData) {
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      project_id: reviewData.projectId,
      reviewer_email: reviewData.homeownerEmail,
      reviewee_email: reviewData.contractorEmail,
      rating: reviewData.rating,
      positive_tags: reviewData.positiveTags || [],
      negative_tags: reviewData.negativeTags || [],
      review_text: reviewData.reviewText || '',
      photos: reviewData.photos || [],
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get reviews for a contractor
 */
async function getReviewsByContractor(contractorEmail) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('reviewee_email', contractorEmail)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Get reviews by a homeowner
 */
async function getReviewsByHomeowner(homeownerEmail) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('reviewer_email', homeownerEmail)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
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
// AI Agent System Operations
// ========================================

/**
 * Create a project log entry
 */
async function createProjectLog(logData) {
  const { data, error } = await supabase
    .from('project_logs')
    .insert({
      project_id: logData.project_id,
      entry_text: logData.entry_text,
      source: logData.source,
      created_by_email: logData.created_by_email || null,
      created_by_name: logData.created_by_name || null,
      metadata: logData.metadata || {},
      photos: logData.photos || [],
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get project logs for a specific project (optionally filter by time range)
 */
async function getProjectLogs(projectId, hoursBack = 24) {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - hoursBack);

  const { data, error } = await supabase
    .from('project_logs')
    .select('*')
    .eq('project_id', projectId)
    .gte('created_at', cutoffTime.toISOString())
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get all project logs for a project (no time filter)
 */
async function getAllProjectLogs(projectId) {
  const { data, error } = await supabase
    .from('project_logs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Create or update project state
 */
async function upsertProjectState(stateData) {
  const { data, error } = await supabase
    .from('project_states')
    .upsert({
      project_id: stateData.project_id,
      current_phase: stateData.current_phase || 'planning',
      blockers: stateData.blockers || [],
      agent_logs: stateData.agent_logs || [],
      estimated_completion_date: stateData.estimated_completion_date || null,
      actual_start_date: stateData.actual_start_date || null,
      last_activity_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'project_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get project state by project ID
 */
async function getProjectState(projectId) {
  const { data, error } = await supabase
    .from('project_states')
    .select('*')
    .eq('project_id', projectId)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data;
}

/**
 * Update project state phase
 */
async function updateProjectPhase(projectId, phase, blockers = []) {
  const { data, error } = await supabase
    .from('project_states')
    .update({
      current_phase: phase,
      blockers: blockers,
      last_activity_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('project_id', projectId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Log AI agent activity
 */
async function logAIAgentActivity(activityData) {
  const { data, error } = await supabase
    .from('ai_agent_activity')
    .insert({
      project_id: activityData.project_id,
      agent_type: activityData.agent_type,
      action_type: activityData.action_type,
      action_description: activityData.action_description,
      action_result: activityData.action_result || null,
      input_data: activityData.input_data || {},
      output_data: activityData.output_data || {},
      status: activityData.status || 'completed',
      error_message: activityData.error_message || null,
      created_at: new Date().toISOString(),
      completed_at: activityData.status === 'completed' ? new Date().toISOString() : null
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get active projects (for agent loop processing)
 */
async function getActiveProjects() {
  const { data, error } = await supabase
    .from('job_postings')
    .select(`
      *,
      project_states (*)
    `)
    .in('status', ['in_progress', 'active'])
    .order('updated_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get agent configuration for a project
 */
async function getAgentConfig(projectId) {
  const { data, error } = await supabase
    .from('agent_configs')
    .select('*')
    .eq('project_id', projectId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Update agent configuration
 */
async function updateAgentConfig(projectId, configData) {
  const { data, error } = await supabase
    .from('agent_configs')
    .upsert({
      project_id: projectId,
      ...configData,
      updated_at: new Date().toISOString()
    }, { onConflict: 'project_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Check if agent is within rate limits
 */
async function checkAgentRateLimit(agentName) {
  const { data, error } = await supabase.rpc('check_agent_rate_limit', {
    p_agent_name: agentName
  });

  if (error) throw error;
  return data === true;
}

/**
 * Get agent activity history
 */
async function getAgentActivity(agentName, limit = 50) {
  const { data, error } = await supabase
    .from('agent_activity_log')
    .select('*')
    .eq('agent_name', agentName)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// ========================================
// Project Operations
// ========================================

/**
 * Create a new project
 */
async function createProject(projectData) {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      ...projectData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get project by ID
 */
async function getProjectById(projectId) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Update project
 */
async function updateProject(projectId, updates) {
  const { data, error } = await supabase
    .from('projects')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get projects by homeowner
 */
async function getProjectsByHomeowner(homeownerEmail) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('homeowner_email', homeownerEmail)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get projects by contractor
 */
async function getProjectsByContractor(contractorEmail) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('contractor_email', contractorEmail)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ========================================
// Helper Functions
// ========================================

/**
 * Call a Supabase RPC function
 */
async function rpc(functionName, params = {}) {
  const { data, error } = await supabase.rpc(functionName, params);
  if (error) throw error;
  return data;
}

// ========================================
// Module Exports
// ========================================

module.exports = {
  // Core database functions
  query,
  getPool,
  rpc,
  supabase,

  // User profile operations
  upsertUserProfile,
  getUserProfile,
  updateUserProfile,
  updateContractorLicense,
  getContractorByVerificationId,
  getContractorTradeType,

  // Job posting operations
  createJobPosting,
  getJobs,
  getJobById,
  getJobsByHomeowner,
  updateJobStatus,
  incrementJobViews,

  // Contractor bid operations
  submitBid,
  getBidsByJob,
  getBidsByContractor,
  updateBidStatus,
  acceptBid,

  // Homeowner rating operations
  submitHomeownerRating,
  getHomeownerRating,
  getHomeownerRatings,
  getTopRatedHomeowners,

  // Contractor license operations
  addContractorLicense,
  getContractorLicenses,
  getContractorLicenseByTrade,
  updateLicenseVerificationStatus,
  getVerifiedLicenses,
  checkContractorLicenseForJob,

  // Messaging operations
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

  // Notification operations
  createNotification,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markNotificationEmailSent,

  // Review operations
  createReview,
  getReviewsByContractor,
  getReviewsByHomeowner,

  // Activity log
  logActivity,

  // AI Agent system operations
  createProjectLog,
  getProjectLogs,
  getAllProjectLogs,
  upsertProjectState,
  getProjectState,
  updateProjectPhase,
  logAIAgentActivity,
  getActiveProjects,
  getAgentConfig,
  updateAgentConfig,
  checkAgentRateLimit,
  getAgentActivity,

  // Project operations
  createProject,
  getProjectById,
  updateProject,
  getProjectsByHomeowner,
  getProjectsByContractor
};
