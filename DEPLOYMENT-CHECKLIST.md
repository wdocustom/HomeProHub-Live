# Deployment Checklist - HomeProHub Updates

## ✅ Completed Changes (Already Pushed to GitHub)

All the following changes have been committed to branch `claude/code-review-refactor-adPWF`:

### 1. Email Service Migration to Brevo ✓
- Switched from SendGrid to Brevo in `services/notification-worker.js`
- Updated `package.json` with `@getbrevo/brevo` dependency
- Updated `.env.example` with Brevo configuration

### 2. Navigation Fixes ✓
- Fixed AI Assistant link in `public/components/navigation.js` (now points to `ask.html`)
- This resolves the issue where homeowner navigation was redirecting to index.html

### 3. Decline Bid Feature ✓
- Added `POST /api/bid/decline` endpoint in `server.js`
- Wired up decline button functionality in `public/homeowner-dashboard.html`
- Includes contractor notification when bid is declined

### 4. Documentation ✓
- Created `INSTALL-DEPENDENCIES.md` - Guide for installing npm packages
- Created comprehensive setup guides

---

## 🚀 Next Steps for Deployment on Render

Since you've already added all environment variables to Render dashboard, follow these steps:

### Step 1: Deploy to Render

1. **Go to your Render dashboard** at https://render.com
2. **Find your HomeProHub web service**
3. **Trigger a new deployment:**
   - Either wait for auto-deploy (if enabled for this branch)
   - OR manually deploy by clicking "Manual Deploy" → Select `claude/code-review-refactor-adPWF` branch

### Step 2: Verify Environment Variables on Render

Make sure these are set in your Render environment variables:

**Brevo (Email):**
```
BREVO_API_KEY=your-brevo-api-key-here
BREVO_FROM_EMAIL=notifications@homeprohub.today
BREVO_FROM_NAME=HomeProHub
```

**Twilio (SMS):**
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-auth-token-here
TWILIO_PHONE_NUMBER=+1234567890
```

**Stripe (Payments):**
```
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key-here
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key-here
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret-here
STRIPE_PRODUCT_ID=prod_homeprohub_subscriptions
```

**Supabase:**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here
```

You mentioned you've already added these - great! ✓

### Step 3: Install New Dependencies on Render

When Render deploys, it will automatically run `npm install` and install these new packages:
- `@getbrevo/brevo` (replaces SendGrid)
- `twilio` (for SMS)
- `stripe` (for payments)

**You don't need to do anything** - Render handles this automatically during deployment.

### Step 4: Set Up Notification Worker on Render

The notification worker (`services/notification-worker.js`) needs to run as a **separate background service**.

**Option A: Add as Background Worker on Render**

1. In your Render dashboard, click **"New +"** → **"Background Worker"**
2. Connect to your GitHub repo
3. Set the **Start Command** to:
   ```
   npm run worker
   ```
4. Use the **same environment variables** as your web service
5. Deploy

**Option B: Use PM2 in Your Existing Service** (simpler)

If you want to run both the web server and worker in one service:

1. In your Render **Start Command**, change it to:
   ```
   npm run pm2:start
   ```

This will use the PM2 configuration to run both server.js and the notification worker.

### Step 5: Database Migration (REQUIRED)

**You need to run the database migration in Supabase:**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the file `database/notifications-system.sql` from your project
4. Copy the entire SQL content
5. Paste it into the Supabase SQL Editor
6. Click **"Run"**

This creates the `notification_log` table and necessary functions for notifications.

---

## 🖥️ Optional: Testing Locally on Windows

**If you have the project on your Windows computer** and want to test before deploying:

### Find Your Project Folder

1. Open **File Explorer**
2. Navigate to where you cloned the GitHub repository
3. Look for the folder containing `package.json`, `server.js`, etc.
4. The path will look something like:
   - `C:\Users\camac\Documents\HomeProHub-Live`
   - OR `C:\Users\camac\Desktop\HomeProHub-Live`
   - OR wherever you put it

### Install Dependencies Locally

1. Open **Command Prompt** or **PowerShell**
2. Navigate to your project folder:
   ```
   cd C:\Users\camac\path\to\HomeProHub-Live
   ```
   (Replace with your actual path)

3. Install dependencies:
   ```
   npm install
   ```

This will download and install Brevo, Twilio, and Stripe packages.

### Create Local .env File (Optional)

If you want to test locally, create a `.env` file:

1. In your project folder, copy `.env.example` to `.env`
2. Open `.env` in a text editor (Notepad, VS Code, etc.)
3. Fill in your actual API keys
4. **NEVER commit this file to GitHub** (it's already in `.gitignore`)

### Run Locally

```
npm start
```

---

## 🎯 What's Working Now

After deployment, these features will be live:

1. **Brevo Email Notifications** - Emails sent via Brevo API
2. **SMS Notifications** - SMS sent via Twilio (if configured)
3. **Fixed Navigation** - AI Assistant link works correctly
4. **Decline Bids** - Homeowners can decline contractor bids
5. **Stripe Integration** - Ready for payment processing

---

## ⚠️ Important Notes

### About .env Files

- **Local .env** - Only on your computer (for testing)
- **Render Environment Variables** - Set in Render dashboard (for production)
- **.env.example** - Template on GitHub (safe to commit)
- **.gitignore** - Prevents .env from being committed

**You've already set up Render environment variables, so you're good!**

### Dependencies on Render

- Render automatically runs `npm install` when deploying
- You don't need to install dependencies manually on Render
- The new packages (Brevo, Twilio, Stripe) will be installed automatically

### Testing the Changes

After deploying to Render:

1. **Test Email Notifications:**
   - Have a contractor submit a bid
   - Check if homeowner receives Brevo email

2. **Test SMS (if configured):**
   - Same as above, but check for SMS delivery

3. **Test Navigation:**
   - Log in as homeowner
   - Click "AI Assistant" link
   - Should go to `ask.html`, not `index.html`

4. **Test Decline Bid:**
   - Log in as homeowner
   - View a job with bids
   - Click "Decline" on a bid
   - Contractor should receive notification

---

## 📋 Quick Deployment Summary

**If you're only using Render (not testing locally):**

1. ✅ Changes already pushed to GitHub
2. ✅ Environment variables already in Render dashboard
3. ⬜ Deploy on Render (auto or manual)
4. ⬜ Set up notification worker (background service or PM2)
5. ⬜ Run database migration in Supabase

**That's it!** Render will handle installing dependencies automatically.

---

## 🆘 Need Help?

If you run into issues:

1. **Check Render logs** for deployment errors
2. **Check Supabase logs** for database errors
3. **Verify environment variables** are set correctly
4. **Make sure database migration ran successfully**

---

## Next Features to Build

After this deployment is stable:

1. **Stripe subscription management UI**
2. **Pay-per-bid functionality**
3. **Enhanced contractor profile features**
4. **Advanced notification preferences**
