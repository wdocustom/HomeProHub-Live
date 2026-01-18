# Contractor Tools Page - Error Analysis & Fix Guide

## Errors You're Seeing (From Screenshot)

### 1. ❌ 404 Error: Missing Endpoint
```
GET /api/jobs/contractor/info@wdocustom.com → 404 (Not Found)
```

**Issue:** Endpoint didn't exist
**Status:** ✅ **FIXED** - Added in commit 08afdd4
**What it does:** Fetches all awarded jobs for a contractor

---

### 2. ❌ 500 Errors: OpenAI API Key Missing

```
POST /api/agents/generate-daily-summary → 500 (Internal Server Error)
POST /api/agents/log-contractor-update → 500 (Internal Server Error)
GET /api/agents/project-state/:id → 500 (Internal Server Error)
GET /api/agents/project-logs/:id → 500 (Internal Server Error)
```

**Root Cause:** `OPENAI_API_KEY` not set in Render environment

**Symptoms:**
- "Failed to generate summary: Failed to generate summary"
- "Error logging update: Error: Failed to log update"
- "Failed to load activity log"

**Status:** ⚠️ **NEEDS CONFIGURATION** (see below)

---

## Quick Fix Checklist

### ✅ Step 1: Set OpenAI API Key in Render

1. Go to your Render dashboard: https://dashboard.render.com
2. Select your `HomeProHub-Live` service
3. Click **"Environment"** in the left sidebar
4. Add environment variable:
   - **Key:** `OPENAI_API_KEY`
   - **Value:** `sk-proj-...` (your OpenAI API key from https://platform.openai.com/api-keys)
5. Click **"Save Changes"**
6. Render will auto-deploy with the new variable

**Why this is needed:**
- AI daily summaries use GPT-4o to summarize project activity
- Contractor update logging uses OpenAI for natural language processing
- Without this key, these features return 500 errors

---

### ✅ Step 2: Verify Other Required Environment Variables

Make sure these are set in Render:

**Required for Auto-GC System:**
```bash
OPENAI_API_KEY="sk-proj-..."           # For AI features
TAVILY_API_KEY="tvly-..."              # For external contractor search (optional)
GOOGLE_GEOCODING_API_KEY="AIza..."    # For GPS geocoding (optional)

# You already have these:
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="+1..."
```

**Check in Render:**
1. Dashboard → Your Service → Environment
2. Verify all keys are present
3. Click "Save Changes" if you add any

---

### ✅ Step 3: Test the Fixes

After setting `OPENAI_API_KEY`:

1. **Refresh contractor-tools.html**
2. **Try "Generate AI Summary"** button
   - Should work now (200 response instead of 500)
3. **Try "Log Update"** button
   - Should work now
4. **Check browser console** (F12)
   - Should see green checkmarks for API calls
   - No more red 500 errors

---

## What Each Error Means

### Error: "GET /api/jobs/contractor/:email → 404"
**What it's trying to do:** Load list of jobs awarded to this contractor
**Fix:** ✅ Added endpoint in latest commit
**When it will work:** After next deploy (automatic when you push)

---

### Error: "POST /api/agents/generate-daily-summary → 500"
**What it's trying to do:** Use AI to summarize project activity
**Why it fails:** Missing `OPENAI_API_KEY` in environment
**Fix:** Set the API key in Render environment variables
**When it will work:** Immediately after setting key + redeploy

---

### Error: "POST /api/agents/log-contractor-update → 500"
**What it's trying to do:** Log contractor update text to database
**Why it might fail:**
1. Missing `OPENAI_API_KEY` (uses AI for parsing)
2. Database function `db.createProjectLog` might not exist yet
3. Project doesn't exist in database

**Fix:**
1. Set `OPENAI_API_KEY`
2. Verify database migrations are run
3. Create test project first

---

### Error: "GET /api/agents/project-logs/:id → 500"
**What it's trying to do:** Fetch all activity logs for a project
**Why it might fail:** Project ID doesn't exist or database function missing
**Fix:** Create a test project with some activity first

---

### Error: "GET /api/agents/project-state/:id → 500"
**What it's trying to do:** Get current state of Auto-GC project
**Why it might fail:** Project hasn't been initialized with Auto-GC system yet
**Fix:** Project needs to be created through Auto-GC flow first

---

## Testing Workflow (After Fixes)

### 1. Create Test Project
```bash
# In browser, go to homeowner dashboard
# Create new project:
- Title: "Test Kitchen Remodel"
- Address: "123 Main St, Omaha, NE 68105"
- Set site_latitude: 41.2565
- Set site_longitude: -95.9345
```

### 2. Create Test Contractor Bid
```bash
# As contractor, submit bid on the project
# As homeowner, accept the bid
```

### 3. Test Contractor Tools Page
```bash
# Go to contractor-tools.html
# Should now see:
- ✅ Project loads (no 404)
- ✅ "Generate AI Summary" works (no 500)
- ✅ "Log Update" works (no 500)
- ✅ Activity log loads (no 500)
```

---

## Database Requirements

Make sure these tables exist (should already be there):

```sql
-- Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'job_postings',
    'bids',
    'project_logs',
    'project_state',
    'ghost_contractors'
  );
```

**Missing tables?** Run migrations:
```bash
psql $DATABASE_URL -f database/migrations/add_diplomat_sentinel_features.sql
psql $DATABASE_URL -f database/migrations/add_ghost_contractors.sql
```

---

## Environment Variable Priority

**CRITICAL (Must Have):**
1. `SUPABASE_URL` ✅ (you have this)
2. `SUPABASE_SERVICE_KEY` ✅ (you have this)
3. `OPENAI_API_KEY` ❌ **MISSING - Set this in Render**

**Important (For Full Features):**
4. `TWILIO_ACCOUNT_SID` ✅ (you have this)
5. `TWILIO_AUTH_TOKEN` ✅ (you have this)
6. `TWILIO_PHONE_NUMBER` ✅ (you have this)

**Optional (Enhancements):**
7. `TAVILY_API_KEY` - For external contractor search
8. `GOOGLE_GEOCODING_API_KEY` - For auto-geocoding projects

---

## Current Status Summary

| Error | Status | Action Required |
|-------|--------|----------------|
| 404 - Missing jobs endpoint | ✅ **FIXED** | Deploy latest commit |
| 500 - Daily summary | ⚠️ **NEEDS CONFIG** | Set `OPENAI_API_KEY` in Render |
| 500 - Log update | ⚠️ **NEEDS CONFIG** | Set `OPENAI_API_KEY` in Render |
| 500 - Project logs | ⚠️ **NEEDS DATA** | Create test project first |
| 500 - Project state | ⚠️ **NEEDS DATA** | Create test project first |

---

## Next Steps

1. **Immediate:** Set `OPENAI_API_KEY` in Render environment
2. **Verify:** Wait for auto-deploy to complete (~2-3 minutes)
3. **Test:** Refresh contractor-tools.html page
4. **Create:** Test project + bid to populate data
5. **Confirm:** All errors should be resolved

---

## Get Your OpenAI API Key

1. Go to: https://platform.openai.com/api-keys
2. Log in (or sign up)
3. Click **"Create new secret key"**
4. Copy the key (starts with `sk-proj-...`)
5. Paste into Render environment variables
6. **Important:** Free tier includes $5 credit
7. **Cost:** ~$0.002 per summary (very cheap)

---

## Still Getting Errors?

**Check Render logs:**
```bash
# In Render dashboard:
1. Select your service
2. Click "Logs" tab
3. Look for error messages
4. Share screenshot if errors persist
```

**Common issues:**
- API key typo (make sure no extra spaces)
- Database migration not run
- Project data doesn't exist yet
- Supabase connection issue

---

## Summary

**The main issue:** Missing `OPENAI_API_KEY` in your Render environment variables.

**The fix:**
1. Add the key in Render dashboard
2. Wait for auto-deploy
3. Refresh page

**Result:** All 500 errors should disappear, and AI features will work.

Let me know if you have the OpenAI API key ready, and I can walk you through setting it up!
