# HomeProHub: Notifications & Payments Setup Guide

This guide walks you through setting up SMS/Email notifications and Stripe payment processing for HomeProHub.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Database Setup](#database-setup)
3. [Twilio SMS Configuration](#twilio-sms-configuration)
4. [SendGrid Email Configuration](#sendgrid-email-configuration)
5. [Stripe Payment Configuration](#stripe-payment-configuration)
6. [Installation](#installation)
7. [Running the Notification Worker](#running-the-notification-worker)
8. [Testing](#testing)
9. [Production Deployment](#production-deployment)

---

## Prerequisites

- Node.js 18+ installed
- Supabase project with database access
- Twilio account (for SMS)
- SendGrid account (for Email)
- Stripe account (for payments)

---

## Database Setup

### 1. Run the Notifications System Migration

The notification system requires additional database tables and functions.

**Option 1: Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open `database/notifications-system.sql`
4. Copy and paste the contents
5. Click **Run**

**Option 2: Command Line**
```bash
psql "your-supabase-connection-string" -f database/notifications-system.sql
```

**What this adds:**
- `service_radius_miles` column to `user_profiles`
- Notification preference columns (SMS/Email enabled, phone verified)
- `notification_log` table for tracking SMS and email deliveries
- Functions: `find_contractors_in_service_area()`, `queue_job_notification()`
- Trigger to auto-notify contractors when jobs are posted

See `database/README-NOTIFICATIONS.md` for detailed information.

### 2. Verify Migration

Run this query in Supabase SQL Editor:

```sql
-- Check notification_log table exists
SELECT * FROM notification_log LIMIT 1;

-- Check new columns in user_profiles
SELECT email, service_radius_miles, notifications_sms_enabled, phone_verified
FROM user_profiles
LIMIT 5;
```

---

## Twilio SMS Configuration

### 1. Create Twilio Account

1. Go to [twilio.com](https://www.twilio.com)
2. Sign up for a free trial (or paid account)
3. Get a phone number with SMS capability

### 2. Get Your Credentials

From Twilio Console:
- **Account SID**: Found on the dashboard (starts with "AC...")
- **Auth Token**: Click "Show" next to Auth Token on dashboard
- **Phone Number**: Your Twilio phone number (format: +1234567890)

### 3. Add to Environment Variables

Update your `.env` file:

```bash
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your-auth-token-here"
TWILIO_PHONE_NUMBER="+1234567890"
```

### 4. Test SMS (Optional)

```javascript
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

client.messages.create({
  body: 'Test from HomeProHub!',
  from: process.env.TWILIO_PHONE_NUMBER,
  to: '+1YOUR_PHONE_NUMBER'
}).then(message => console.log('✓ SMS sent:', message.sid));
```

---

## SendGrid Email Configuration

### 1. Create SendGrid Account

1. Go to [sendgrid.com](https://sendgrid.com)
2. Sign up (free tier: 100 emails/day)
3. Verify your sender email

### 2. Get API Key

1. Go to **Settings** → **API Keys**
2. Click **Create API Key**
3. Select **Full Access** (or custom with Mail Send permission)
4. Copy the API key (starts with "SG...")

### 3. Verify Sender Identity

**Option A: Single Sender Verification (Quick)**
1. Go to **Settings** → **Sender Authentication**
2. Click **Verify a Single Sender**
3. Enter your email (e.g., notifications@yourdomain.com)
4. Check email and click verification link

**Option B: Domain Authentication (Production)**
1. Go to **Settings** → **Sender Authentication**
2. Click **Authenticate Your Domain**
3. Add DNS records to your domain

### 4. Add to Environment Variables

```bash
SENDGRID_API_KEY="SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
SENDGRID_FROM_EMAIL="notifications@homeprohub.today"
```

---

## Stripe Payment Configuration

### 1. Create Stripe Account

1. Go to [stripe.com](https://stripe.com)
2. Sign up for an account
3. Complete business verification

### 2. Get API Keys

From Stripe Dashboard:
1. Click **Developers** → **API keys**
2. Copy:
   - **Publishable key** (starts with "pk_test..." or "pk_live...")
   - **Secret key** (starts with "sk_test..." or "sk_live...")

### 3. Create Product

1. Go to **Products** → **Add Product**
2. Name: "HomeProHub Subscriptions"
3. Save and copy the **Product ID** (starts with "prod_...")

### 4. Set Up Webhook

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: `https://your domain.com/api/stripe/webhook`
4. Select events to listen for:
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy the **Signing secret** (starts with "whsec_...")

### 5. Add to Environment Variables

```bash
STRIPE_SECRET_KEY="sk_test_your-secret-key-here"
STRIPE_PUBLISHABLE_KEY="pk_test_your-publishable-key-here"
STRIPE_WEBHOOK_SECRET="whsec_your-webhook-secret-here"
STRIPE_PRODUCT_ID="prod_your-product-id-here"
```

---

## Installation

### 1. Install Dependencies

```bash
npm install
```

This installs:
- `twilio` - SMS notifications
- `@sendgrid/mail` - Email notifications
- `stripe` - Payment processing

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
nano .env  # or your preferred editor
```

### 3. Update Supabase Service Key

Make sure you're using the **service role key** (not anon key) for the notification worker:

```bash
SUPABASE_SERVICE_KEY="your-service-role-key-here"
```

---

## Running the Notification Worker

The notification worker processes queued SMS and email notifications.

### Development (Single Process)

```bash
npm run worker
```

Output:
```
═══════════════════════════════════════════════════════
  HomeProHub Notification Worker
═══════════════════════════════════════════════════════

Configuration:
  Poll Interval: 30s
  SMS:           ✓ Enabled
  Email:         ✓ Enabled

Starting worker loop...
Press Ctrl+C to stop

🔄 Checking for queued notifications...
Found 2 queued notification(s)

📬 Processing notification abc123 (new_job_sms)
📱 Sending SMS to +1234567890...
✓ SMS sent: SMxxxxxxxxxx

📧 Sending email to contractor@example.com...
✓ Email sent: xxxxxxxxxx

✓ Worker cycle complete
```

### Production (PM2)

Add to `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'homeprohub',
      script: 'server.js',
      // ... existing config
    },
    {
      name: 'notification-worker',
      script: 'services/notification-worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

Start both:
```bash
pm2 start ecosystem.config.js
pm2 logs notification-worker  # view worker logs
```

---

## Testing

### Test SMS Notifications

1. Update a contractor profile with phone number
2. Enable SMS notifications
3. Create a test job posting

```javascript
// In Supabase SQL Editor or your app
SELECT queue_job_notification(
  'job-uuid-here'::uuid,
  'Test Plumbing Job',
  '68105',
  'Plumber',
  500,
  1000
);
```

4. Check `notification_log`:
```sql
SELECT * FROM notification_log
WHERE notification_type = 'new_job_sms'
ORDER BY created_at DESC
LIMIT 5;
```

5. Worker should pick it up and send SMS within 30 seconds

### Test Email Notifications

Similar to SMS, but check for `new_job_email` notifications.

### Test Stripe Payments

#### Test Subscription Creation

```javascript
const stripeService = require('./services/stripe-service');

// Create test customer
const customer = await stripeService.createCustomer(
  'test@example.com',
  'Test Contractor'
);

// Create subscription
const subscription = await stripeService.createSubscription(
  customer.id,
  'pro',  // or 'basic', 'premium'
  'pm_card_visa'  // Stripe test payment method
);

console.log('Subscription created:', subscription.id);
```

#### Test Pay-Per-Bid

```javascript
const paymentIntent = await stripeService.chargeForBid(
  customer.id,
  'job-uuid-here',
  'Kitchen Remodel'
);

console.log('Payment intent:', paymentIntent.id);
```

#### Stripe Test Cards

Use these in development:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Insufficient Funds**: `4000 0000 0000 9995`
- Any future expiry date, any 3-digit CVC

---

## Production Deployment

### 1. Switch to Live Keys

In `.env`:
```bash
# Change test keys to live keys
STRIPE_SECRET_KEY="sk_live_your-live-key-here"
STRIPE_PUBLISHABLE_KEY="pk_live_your-live-key-here"

# Update webhook secret for live webhook
STRIPE_WEBHOOK_SECRET="whsec_live-webhook-secret-here"
```

### 2. Update Frontend Stripe Key

In your frontend code (subscription UI), use live publishable key:
```javascript
const stripe = Stripe('pk_live_your-live-key-here');
```

### 3. Enable Production Webhook

1. In Stripe Dashboard, add production webhook endpoint
2. URL: `https://homeprohub.today/api/stripe/webhook`
3. Select same events as test
4. Update `STRIPE_WEBHOOK_SECRET` in `.env`

### 4. Test in Production

1. Create real subscription with real card
2. Verify webhook events are received
3. Check database for subscription record
4. Test cancellation and updates

### 5. Monitor

```bash
# Check notification worker logs
pm2 logs notification-worker

# Check main app logs
pm2 logs homeprohub

# Monitor Stripe dashboard for payments
# Monitor Twilio console for SMS delivery
# Monitor SendGrid dashboard for email delivery
```

---

## Subscription Plans

| Plan | Price/Month | Bids | Features |
|------|-------------|------|----------|
| **Basic** | $29 | 10 | Job board, messaging, basic support |
| **Pro** | $79 | Unlimited | + Priority support, analytics |
| **Premium** | $149 | Unlimited | + Priority placement, featured badge |
| **Pay-Per-Bid** | $7/bid | As needed | No subscription required |

---

## Troubleshooting

### SMS Not Sending

1. **Check Twilio credentials**: Verify Account SID and Auth Token
2. **Phone number format**: Must include country code (+1234567890)
3. **Trial account**: Can only send to verified numbers
4. **Check logs**: `pm2 logs notification-worker`
5. **Check Twilio console**: View delivery status

### Email Not Sending

1. **Verify API key**: Check SendGrid dashboard
2. **Sender verification**: Email must be verified in SendGrid
3. **Check spam**: Emails might be in spam folder
4. **Check SendGrid activity**: View delivery attempts in dashboard
5. **Rate limits**: Free tier is 100 emails/day

### Stripe Payments Failing

1. **Test mode**: Make sure using test keys in development
2. **Webhook signature**: Verify webhook secret matches
3. **Check Stripe logs**: View webhook events in dashboard
4. **Payment method**: Use valid test card numbers
5. **Customer exists**: Verify customer was created

### Worker Not Processing

1. **Check if running**: `pm2 list`
2. **Check database connection**: Verify Supabase credentials
3. **Check notifications table**: `SELECT * FROM notification_log WHERE sms_status = 'queued';`
4. **Restart worker**: `pm2 restart notification-worker`

---

## Support

- **Twilio Docs**: https://www.twilio.com/docs/sms
- **SendGrid Docs**: https://docs.sendgrid.com
- **Stripe Docs**: https://stripe.com/docs
- **Supabase Docs**: https://supabase.com/docs

---

## Next Steps

1. ✅ Complete database migration
2. ✅ Configure Twilio, SendGrid, and Stripe
3. ✅ Install dependencies
4. ✅ Run notification worker
5. 🔲 Add Stripe endpoints to server.js
6. 🔲 Build subscription management UI
7. 🔲 Test end-to-end flow
8. 🔲 Deploy to production
