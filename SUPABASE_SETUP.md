# Supabase Database Setup Guide for HomeProHub

## Step 1: Access Your Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sign in to your account
3. Either:
   - Select your existing HomeProHub project, OR
   - Click "New Project" to create a fresh one

**Recommendation:** Create a new project called "HomeProHub-Live" for this deployment

---

## Step 2: Get Your Database Credentials

1. In your Supabase project, click **Settings** (gear icon in left sidebar)
2. Navigate to **API** section
3. Copy these three values (you'll need them for Step 5):

```
Project URL: https://[your-project-ref].supabase.co
anon/public key: eyJhbG... (long string)
service_role key: eyJhbG... (long string - keep this SECRET!)
```

**⚠️ IMPORTANT:** The `service_role` key bypasses all security - never expose it to the frontend!

---

## Step 3: Run Database Schema

### Option A: Using SQL Editor (Recommended)

1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click **New Query** button
3. Open the file `database/schema.sql` from your project
4. Copy **ALL** the contents (it's about 450 lines)
5. Paste into the SQL Editor
6. Click **Run** button (or press Ctrl+Enter / Cmd+Enter)
7. Wait for completion - you should see "Success. No rows returned"

### Option B: Using Command Line (Advanced)

If you prefer command line:

```bash
# Get your database connection string from Supabase:
# Settings > Database > Connection String > URI

# Replace [YOUR-PASSWORD] with your database password
# Replace [YOUR-PROJECT-REF] with your project reference

psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" < database/schema.sql
```

---

## Step 4: Verify Tables Were Created

1. In Supabase, click **Table Editor** in the left sidebar
2. You should see these 7 tables:
   - ✅ user_profiles
   - ✅ job_postings
   - ✅ contractor_bids
   - ✅ homeowner_ratings
   - ✅ messages
   - ✅ notifications
   - ✅ activity_log

3. Click on any table to see the columns
4. All tables should be empty (0 rows) - this is correct!

**If you don't see these tables:** Go back to Step 3 and check for any error messages in the SQL Editor

---

## Step 5: Configure Your .env File

1. In your project root, create a `.env` file:

```bash
cp .env.example .env
```

2. Edit `.env` and fill in your Supabase credentials:

```bash
# Supabase Configuration (REQUIRED)
SUPABASE_URL="https://[your-project-ref].supabase.co"
SUPABASE_ANON_KEY="eyJhbG..."  # From Step 2
SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."  # From Step 2 - KEEP SECRET!

# Anthropic API (you should already have this)
ANTHROPIC_API_KEY="sk-ant-..."

# Email Configuration (optional for now)
EMAIL_FROM="noreply@homeprohub.today"
SENDGRID_API_KEY=""  # Leave empty for now
```

3. Save the file

**⚠️ NEVER commit .env to git!** (It's already in .gitignore)

---

## Step 6: Test Locally

1. Restart your local server:

```bash
npm run dev
```

2. Test the connection by checking server logs:
   - You should see: `🚀 HomeProHub Server`
   - No database connection errors

3. Test the API by opening: `http://localhost:3000/api/jobs`
   - You should see: `{"jobs":[]}`
   - This means the database is connected! (empty array is correct - no jobs yet)

---

## Step 7: Configure Render.com Environment Variables

Since your deploy is failing, you need to add the environment variables to Render:

1. Go to [https://dashboard.render.com](https://dashboard.render.com)
2. Select your HomeProHub-Live service
3. Click **Environment** in the left sidebar
4. Add these environment variables:

```
SUPABASE_URL = https://[your-project-ref].supabase.co
SUPABASE_ANON_KEY = eyJhbG... (paste your anon key)
SUPABASE_SERVICE_ROLE_KEY = eyJhbG... (paste your service role key)
```

5. Keep your existing variables (ANTHROPIC_API_KEY, etc.)
6. Click **Save Changes**

---

## Step 8: Manual Deploy to Render

Since auto-deploy is failing, do a manual deploy:

1. In Render dashboard, go to your HomeProHub-Live service
2. Click **Manual Deploy** button (top right)
3. Select **Deploy latest commit**
4. Wait for the deploy to complete (2-5 minutes)
5. Check the logs for any errors

**Common Deploy Issues:**
- ❌ "Module not found: @supabase/supabase-js" → Make sure package.json was committed
- ❌ "SUPABASE_URL is undefined" → Make sure you added env vars in Step 7
- ❌ "Build failed" → Check the build logs for specific errors

---

## Step 9: Test the Live Application

1. Go to your live site: `https://homeprohub.today/ask.html`
2. Sign in as a homeowner
3. Type a test question: "bathroom shower pan has a leak"
4. Click **Ask HomeProHub AI** - it should work now!
5. Try submitting a job posting
6. Check if the job appears in: `https://homeprohub.today/homeowner-dashboard.html`

---

## Troubleshooting

### Issue: "Ask HomeProHub AI" button still not working

**Solution:**
1. Hard refresh the page: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. Clear browser cache
3. Check browser console (F12) for any JavaScript errors
4. Make sure the latest code deployed (check commit hash on Render)

### Issue: "Failed to load jobs" on dashboard

**Solution:**
1. Check that database schema was run successfully
2. Verify environment variables are set in Render
3. Check Render logs for database connection errors
4. Test the API endpoint: `https://homeprohub.today/api/jobs`

### Issue: Deploy keeps failing

**Solution:**
1. Check Render build logs for specific error
2. Verify all dependencies in package.json
3. Make sure .env variables are set in Render dashboard
4. Try pushing to a different branch and deploying that

### Issue: Database connection errors

**Solution:**
1. Verify Supabase project is not paused (free tier pauses after 1 week of inactivity)
2. Check that SUPABASE_URL doesn't have trailing slash
3. Verify service role key is correct (not the anon key)
4. Check Supabase project settings > Database > ensure it's active

---

## Testing Checklist

Once everything is set up, test this flow:

### As Homeowner:
- [ ] Sign up as homeowner
- [ ] Use AI assistant to diagnose issue
- [ ] Submit job posting
- [ ] View job on homeowner dashboard
- [ ] See job appear with status "open"

### As Contractor:
- [ ] Sign up as contractor
- [ ] View job on contractor dashboard
- [ ] Submit a bid on the job
- [ ] See bid appear in "My Bids" tab with status "pending"

### As Homeowner (continued):
- [ ] Refresh homeowner dashboard
- [ ] See the bid appear on your job
- [ ] Accept the bid
- [ ] Job status changes to "in_progress"

### Check Database:
1. Go to Supabase Table Editor
2. Check `job_postings` table - should have 1 row
3. Check `contractor_bids` table - should have 1 row with status "accepted"
4. Check `notifications` table - should have notifications for job/bid events

---

## Quick Reference Commands

```bash
# Start local development server
npm run dev

# Test database connection
curl http://localhost:3000/api/jobs

# Check if tables exist (in Supabase SQL Editor)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

# Count rows in each table (after testing)
SELECT
  (SELECT COUNT(*) FROM job_postings) as jobs,
  (SELECT COUNT(*) FROM contractor_bids) as bids,
  (SELECT COUNT(*) FROM user_profiles) as users;
```

---

## Next Steps After Setup

Once database is working:

1. ✅ Test job posting flow end-to-end
2. ✅ Test bidding system
3. ⏳ Set up email notifications (SendGrid)
4. ⏳ Build real-time messaging interface
5. ⏳ Add file uploads for job photos

---

## Need Help?

**Common Resources:**
- [Supabase Docs](https://supabase.com/docs)
- [Supabase SQL Editor](https://supabase.com/docs/guides/database/overview)
- [Render Deploy Docs](https://render.com/docs/deploy-node-express-app)

**Files to Check:**
- `database/schema.sql` - The schema being run
- `database/db.js` - Database operations
- `server.js` - API endpoints
- `.env.example` - Template for environment variables

---

**⚡ Pro Tip:** After setup, bookmark your Supabase Table Editor. You'll use it frequently to inspect data during testing!
