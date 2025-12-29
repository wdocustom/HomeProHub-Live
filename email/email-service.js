/**
 * HomeProHub Email Service
 * Handles all email notifications and sequences using Brevo (formerly Sendinblue)
 */

const fs = require('fs');
const path = require('path');

// node-fetch for API calls
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

// Email configuration from environment variables
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || 'noreply@homeprohub.today';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'HomeProHub';
const EMAIL_SERVICE_CONFIGURED = process.env.EMAIL_SERVICE_CONFIGURED === 'true';

/**
 * Send email using Brevo API
 */
async function sendEmail({ to, subject, html, text }) {
  // Development mode - log instead of sending
  if (!EMAIL_SERVICE_CONFIGURED || !BREVO_API_KEY) {
    console.log('📧 [Email Service - Development Mode] Would send email:');
    console.log(`   To: ${to}`);
    console.log(`   From: ${EMAIL_FROM_NAME} <${EMAIL_FROM_ADDRESS}>`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Preview: ${text?.substring(0, 100)}...`);
    return { success: true, mode: 'development' };
  }

  // Production mode - send via Brevo API
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify({
        sender: {
          email: EMAIL_FROM_ADDRESS,
          name: EMAIL_FROM_NAME
        },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html,
        textContent: text
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Brevo API error:', errorData);
      throw new Error(`Brevo API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Email sent successfully to ${to}: ${subject}`);
    return { success: true, mode: 'production', messageId: data.messageId };

  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    throw error;
  }
}

/**
 * Load email template
 */
function loadTemplate(templateName) {
  const templatePath = path.join(__dirname, 'templates', `${templateName}.html`);
  try {
    return fs.readFileSync(templatePath, 'utf8');
  } catch (error) {
    console.error(`Failed to load email template: ${templateName}`, error);
    return null;
  }
}

/**
 * Replace placeholders in template
 */
function renderTemplate(template, data) {
  let rendered = template;
  Object.keys(data).forEach(key => {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    rendered = rendered.replace(placeholder, data[key] || '');
  });
  return rendered;
}

/**
 * Send job posting confirmation email
 */
async function sendJobPostingConfirmation({ homeownerEmail, homeownerName, job }) {
  const template = loadTemplate('job-posting-confirmation');
  if (!template) return { success: false, error: 'Template not found' };

  const html = renderTemplate(template, {
    homeownerName: homeownerName || 'Valued Homeowner',
    jobTitle: job.title,
    jobDescription: job.description.substring(0, 200) + '...',
    budgetRange: job.budget_low && job.budget_high
      ? `$${job.budget_low.toLocaleString()} - $${job.budget_high.toLocaleString()}`
      : 'Not specified',
    zipCode: job.zip_code,
    urgency: job.urgency,
    dashboardLink: 'https://www.homeprohub.today/homeowner-dashboard.html',
    jobId: job.id
  });

  return sendEmail({
    to: homeownerEmail,
    subject: '✅ Your Project is Posted - Vetted Contractors Reviewing Now',
    html: html,
    text: `Your project "${job.title}" has been posted successfully. Qualified contractors are reviewing it now.`
  });
}

/**
 * Send follow-up email (Owner's Representative sequence)
 */
async function sendOwnerRepEmail({ homeownerEmail, homeownerName, sequenceStep, job }) {
  const templates = {
    'day1': 'owner-rep-day1',
    'day3': 'owner-rep-day3',
    'day7': 'owner-rep-day7',
    'project-start': 'owner-rep-project-start',
    'mid-project': 'owner-rep-mid-project'
  };

  const templateName = templates[sequenceStep];
  if (!templateName) return { success: false, error: 'Unknown sequence step' };

  const template = loadTemplate(templateName);
  if (!template) return { success: false, error: 'Template not found' };

  const subjects = {
    'day1': '🏡 What to Look for in Your Contractor Bids',
    'day3': '📋 Contractor Selection Guide - Make the Right Choice',
    'day7': '🔍 Still Reviewing Bids? Here\'s What to Watch For',
    'project-start': '🚀 Your Project is Starting - Critical First Steps',
    'mid-project': '🏗️ Project Update Check-in - We\'re Here to Help'
  };

  const html = renderTemplate(template, {
    homeownerName: homeownerName || 'Valued Homeowner',
    jobTitle: job?.title || 'your project',
    checkinLink: 'https://www.homeprohub.today/project-check-in.html',
    messagesLink: 'https://www.homeprohub.today/messages.html',
    dashboardLink: 'https://www.homeprohub.today/homeowner-dashboard.html'
  });

  return sendEmail({
    to: homeownerEmail,
    subject: subjects[sequenceStep],
    html: html,
    text: `HomeProHub update for ${homeownerName}`
  });
}

/**
 * Send bid notification to homeowner
 */
async function sendBidNotification({ homeownerEmail, homeownerName, contractor, job, bid }) {
  const template = loadTemplate('bid-notification');
  if (!template) return { success: false, error: 'Template not found' };

  const html = renderTemplate(template, {
    homeownerName: homeownerName || 'Valued Homeowner',
    contractorName: contractor.business_name || contractor.company_name,
    jobTitle: job.title,
    bidAmount: `$${bid.bid_amount_low.toLocaleString()} - $${bid.bid_amount_high.toLocaleString()}`,
    estimatedDuration: bid.estimated_duration || 'Not specified',
    dashboardLink: 'https://www.homeprohub.today/homeowner-dashboard.html',
    messagesLink: 'https://www.homeprohub.today/messages.html'
  });

  return sendEmail({
    to: homeownerEmail,
    subject: `📬 New Bid Received for "${job.title}"`,
    html: html,
    text: `${contractor.business_name} has submitted a bid on your project.`
  });
}

module.exports = {
  sendEmail,
  sendJobPostingConfirmation,
  sendOwnerRepEmail,
  sendBidNotification,
  loadTemplate,
  renderTemplate
};
