/**
 * HomeProHub Notification Worker
 * Processes queued SMS and email notifications
 *
 * This worker:
 * 1. Polls notification_log table for queued notifications
 * 2. Sends SMS via Twilio
 * 3. Sends emails via SendGrid
 * 4. Updates delivery status and timestamps
 *
 * Run with: node services/notification-worker.js
 */

const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');
const sgMail = require('@sendgrid/mail');

// Environment configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'notifications@homeprohub.today';
const POLL_INTERVAL = parseInt(process.env.NOTIFICATION_POLL_INTERVAL) || 30000; // 30 seconds default

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

// Initialize services
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

let twilioClient = null;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  console.log('✓ Twilio initialized');
} else {
  console.warn('⚠️  Twilio not configured - SMS notifications disabled');
}

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log('✓ SendGrid initialized');
} else {
  console.warn('⚠️  SendGrid not configured - Email notifications disabled');
}

/**
 * Fetch queued notifications from database
 */
async function fetchQueuedNotifications() {
  try {
    const { data, error } = await supabase
      .from('notification_log')
      .select('*')
      .or('sms_status.eq.queued,email_status.eq.queued')
      .order('created_at', { ascending: true })
      .limit(50); // Process up to 50 at a time

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Error fetching notifications:', error.message);
    return [];
  }
}

/**
 * Send SMS via Twilio
 */
async function sendSMS(notification) {
  if (!twilioClient) {
    console.warn(`⚠️  SMS disabled, skipping notification ${notification.id}`);
    return { success: false, error: 'Twilio not configured' };
  }

  if (!notification.recipient_phone) {
    return { success: false, error: 'No phone number provided' };
  }

  try {
    console.log(`📱 Sending SMS to ${notification.recipient_phone}...`);

    const message = await twilioClient.messages.create({
      body: notification.message,
      from: TWILIO_PHONE_NUMBER,
      to: notification.recipient_phone
    });

    console.log(`✓ SMS sent: ${message.sid}`);

    // Update notification log
    await supabase
      .from('notification_log')
      .update({
        sms_sid: message.sid,
        sms_status: 'sent',
        sms_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', notification.id);

    return { success: true, sid: message.sid };
  } catch (error) {
    console.error(`❌ SMS error for ${notification.id}:`, error.message);

    // Update with error
    await supabase
      .from('notification_log')
      .update({
        sms_status: 'failed',
        sms_error: error.message,
        updated_at: new Date().toISOString()
      })
      .eq('id', notification.id);

    return { success: false, error: error.message };
  }
}

/**
 * Send email via SendGrid
 */
async function sendEmail(notification) {
  if (!SENDGRID_API_KEY) {
    console.warn(`⚠️  Email disabled, skipping notification ${notification.id}`);
    return { success: false, error: 'SendGrid not configured' };
  }

  if (!notification.recipient_email) {
    return { success: false, error: 'No email address provided' };
  }

  try {
    console.log(`📧 Sending email to ${notification.recipient_email}...`);

    const msg = {
      to: notification.recipient_email,
      from: {
        email: SENDGRID_FROM_EMAIL,
        name: 'HomeProHub Notifications'
      },
      subject: notification.subject || 'HomeProHub Notification',
      text: notification.message,
      html: formatEmailHTML(notification)
    };

    const response = await sgMail.send(msg);
    const messageId = response[0].headers['x-message-id'] || 'unknown';

    console.log(`✓ Email sent: ${messageId}`);

    // Update notification log
    await supabase
      .from('notification_log')
      .update({
        email_message_id: messageId,
        email_status: 'sent',
        email_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', notification.id);

    return { success: true, messageId };
  } catch (error) {
    console.error(`❌ Email error for ${notification.id}:`, error.message);

    // Update with error
    await supabase
      .from('notification_log')
      .update({
        email_status: 'failed',
        email_error: error.message,
        updated_at: new Date().toISOString()
      })
      .eq('id', notification.id);

    return { success: false, error: error.message };
  }
}

/**
 * Format email HTML from notification
 */
function formatEmailHTML(notification) {
  // If message contains HTML, use it
  if (notification.message.includes('<')) {
    return notification.message;
  }

  // Otherwise, create simple formatted HTML
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
    .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 24px;">🏠 HomeProHub</h1>
  </div>
  <div class="content">
    <h2 style="margin-top: 0; color: #111827;">${notification.subject || 'Notification'}</h2>
    <p style="white-space: pre-wrap;">${notification.message}</p>
    ${notification.job_id ? `<a href="https://homeprohub.today/contractor-dashboard.html" class="button">View Job Details</a>` : ''}
  </div>
  <div class="footer">
    <p>This is an automated notification from HomeProHub.<br>
    To manage your notification preferences, visit your <a href="https://homeprohub.today/contractor-profile.html">profile settings</a>.</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Process a single notification
 */
async function processNotification(notification) {
  console.log(`\n📬 Processing notification ${notification.id} (${notification.notification_type})`);

  let smsResult = { success: true };
  let emailResult = { success: true };

  // Send SMS if queued
  if (notification.sms_status === 'queued') {
    smsResult = await sendSMS(notification);
  }

  // Send email if queued
  if (notification.email_status === 'queued') {
    emailResult = await sendEmail(notification);
  }

  // Log results
  if (smsResult.success && emailResult.success) {
    console.log(`✓ Notification ${notification.id} processed successfully`);
  } else {
    console.log(`⚠️  Notification ${notification.id} partially failed`);
  }

  return { smsResult, emailResult };
}

/**
 * Main worker loop
 */
async function runWorker() {
  console.log('\n🔄 Checking for queued notifications...');

  const notifications = await fetchQueuedNotifications();

  if (notifications.length === 0) {
    console.log('No queued notifications');
    return;
  }

  console.log(`Found ${notifications.length} queued notification(s)`);

  for (const notification of notifications) {
    await processNotification(notification);
    // Small delay between sends to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n✓ Worker cycle complete');
}

/**
 * Start worker
 */
function startWorker() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  HomeProHub Notification Worker');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('Configuration:');
  console.log(`  Poll Interval: ${POLL_INTERVAL / 1000}s`);
  console.log(`  SMS:           ${twilioClient ? '✓ Enabled' : '✗ Disabled'}`);
  console.log(`  Email:         ${SENDGRID_API_KEY ? '✓ Enabled' : '✗ Disabled'}`);
  console.log('');
  console.log('Starting worker loop...');
  console.log('Press Ctrl+C to stop');
  console.log('');

  // Run immediately
  runWorker().catch(err => console.error('Worker error:', err));

  // Then run on interval
  const interval = setInterval(() => {
    runWorker().catch(err => console.error('Worker error:', err));
  }, POLL_INTERVAL);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\nShutting down gracefully...');
    clearInterval(interval);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n\nShutting down gracefully...');
    clearInterval(interval);
    process.exit(0);
  });
}

// Start if run directly
if (require.main === module) {
  startWorker();
}

module.exports = {
  runWorker,
  processNotification,
  sendSMS,
  sendEmail
};
