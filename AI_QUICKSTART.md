# AI Beta Program - Quick Start Guide
**Ready to Test in < 10 Minutes**

---

## 🚀 Immediate Next Steps

### Step 1: Run Database Migration (2 minutes)

Go to your Supabase dashboard and run this SQL:

```sql
-- Add AI feature flags to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS ai_beta_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_enrolled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_automation_mode TEXT CHECK (ai_automation_mode IN ('manual', 'assisted', 'automatic')) DEFAULT 'assisted';

-- Add project-level AI tracking
ALTER TABLE job_postings
ADD COLUMN IF NOT EXISTS ai_initialized BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_initialized_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_initialization_mode TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_ai_beta ON user_profiles(ai_beta_enabled) WHERE ai_beta_enabled = true;
CREATE INDEX IF NOT EXISTS idx_job_postings_ai_initialized ON job_postings(ai_initialized) WHERE ai_initialized = true;
```

**✅ Verify:** Check that the columns were added:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'user_profiles' AND column_name LIKE 'ai_%';
```

---

### Step 2: Test User Enrollment Flow (3 minutes)

**Option A: Self-Service (Recommended)**
1. Go to your Command Center: `/command-center.html`
2. You should see a blue "Unlock AI Command Center" banner
3. Click "Join AI Beta Program"
4. Wait for success message
5. Page will reload with AI features enabled

**Option B: Manual Enrollment (for testing)**
Run this SQL to enable AI for your account:
```sql
UPDATE user_profiles
SET
  ai_beta_enabled = true,
  ai_enrolled_at = NOW(),
  ai_automation_mode = 'assisted'
WHERE email = 'your@email.com';
```

---

### Step 3: Initialize AI on a Project (2 minutes)

1. **Go to Command Center** and select an existing project
2. If project has no AI state, you'll see a blue "AI Command Center Not Yet Initialized" alert
3. Click **"Initialize AI Command Center"** button
4. Wait ~5 seconds for initialization
5. **Success!** Project now has AI milestones created

**What happens:**
- Orchestrator Agent creates project milestones from template
- Project state is initialized with current phase
- Activity log shows AI initialization event
- Metro tracker displays project progress

---

### Step 4: Test AI Features (3 minutes)

#### **Test 1: Activity Log**
- AI activities from Orchestrator should appear in Activity Log
- Log a manual contractor update
- Verify homeowner gets notification + email

#### **Test 2: Contractor Import with AI**
- Import a new project via contractor import
- AI should auto-initialize (because you're enrolled)
- Check project has milestones created automatically

#### **Test 3: Delete Manual Logs**
- Log a contractor update
- Click trash icon next to your update
- Confirm deletion
- Verify it's removed from activity log

---

## 🎮 User Experience Flow

### **For NON-Enrolled Contractors:**
```
Command Center
    ↓
See "Unlock AI Command Center" banner
    ↓
Click "Join AI Beta Program"
    ↓
[API: POST /api/ai/enroll]
    ↓
Success → Reload page
    ↓
Banner hidden, AI features available
    ↓
Select project → See "Initialize AI" button
    ↓
Click button → AI creates milestones
    ↓
Project is now AI-managed
```

### **For Enrolled Contractors:**
```
Command Center
    ↓
No banner (already enrolled)
    ↓
Import new project → AI auto-initializes
    ↓
OR
    ↓
Select existing project → Click "Initialize AI"
    ↓
Project gets AI milestones
    ↓
Activity Log shows AI agent actions
```

---

## 📊 Verification Checklist

- [ ] Database migration ran successfully
- [ ] User can see enrollment banner when not enrolled
- [ ] Enrollment flow works (button → API → success)
- [ ] Banner disappears after enrollment
- [ ] Project initialization button appears for non-AI projects
- [ ] AI initialization creates milestones
- [ ] Activity log shows AI activities
- [ ] Manual updates can be deleted
- [ ] Homeowner receives notification when contractor logs update
- [ ] New project imports auto-initialize AI (for enrolled users)

---

## 🐛 Troubleshooting

### **"AI features are not enabled for your account"**
**Cause:** User tried to initialize AI without being enrolled
**Fix:** Enroll via banner or manually enable in database

### **Enrollment banner won't disappear**
**Cause:** API call failed or page didn't reload
**Fix:** Check browser console, refresh page manually

### **AI initialization fails with 403**
**Cause:** User not enrolled OR project belongs to different contractor
**Fix:** Verify enrollment status, check project ownership

### **No milestones created after initialization**
**Cause:** Project has no template OR OrchestratorAgent failed
**Fix:** Check server logs, verify project template exists

### **Homeowner not getting notifications**
**Cause:** Email service not configured OR homeowner email missing
**Fix:** Check server logs for notification errors

---

## 🔍 Monitoring & Analytics

### **Check AI Adoption Rate**
```sql
SELECT
  COUNT(*) FILTER (WHERE ai_beta_enabled = true) as enrolled_users,
  COUNT(*) as total_contractors,
  ROUND(100.0 * COUNT(*) FILTER (WHERE ai_beta_enabled = true) / COUNT(*), 2) as adoption_rate
FROM user_profiles
WHERE role = 'contractor';
```

### **Check AI Project Usage**
```sql
SELECT
  COUNT(*) FILTER (WHERE ai_initialized = true) as ai_projects,
  COUNT(*) as total_projects,
  COUNT(*) FILTER (WHERE ai_initialization_mode = 'auto') as auto_init,
  COUNT(*) FILTER (WHERE ai_initialization_mode = 'manual') as manual_init
FROM job_postings
WHERE status IN ('in_progress', 'completed');
```

### **Track Agent Activity**
```sql
SELECT
  agent_type,
  COUNT(*) as action_count,
  DATE(created_at) as date
FROM ai_agent_activity
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY agent_type, DATE(created_at)
ORDER BY date DESC, action_count DESC;
```

---

## 🎯 Testing Scenarios

### **Scenario 1: New Contractor Discovery**
1. Create fresh contractor account
2. Navigate to Command Center
3. **Expect:** See enrollment banner prominently
4. Click "Join AI Beta Program"
5. **Expect:** Success message, page reload
6. Import a project
7. **Expect:** AI auto-initializes

### **Scenario 2: Existing Project Upgrade**
1. Login as enrolled contractor
2. Select old project (pre-AI)
3. **Expect:** See "Initialize AI" alert
4. Click initialize button
5. **Expect:** Milestones created, progress tracker appears
6. Refresh page
7. **Expect:** AI features persist

### **Scenario 3: Manual Control**
1. Enrolled contractor logs update
2. **Expect:** Homeowner gets notification + email
3. Contractor deletes update
4. **Expect:** Update removed, confirmation toast
5. Contractor initializes AI on project
6. **Expect:** Activity log shows AI initialization event

---

## 📞 Next Steps for Production

1. **Identify 5-10 test contractors** you trust
2. **Enable AI for them manually** (or let them self-enroll)
3. **Monitor for 1 week:**
   - Check error logs
   - Track usage metrics
   - Collect informal feedback
4. **Iterate** based on learnings
5. **Expand** to 50 users (10% rollout)
6. **General availability** after positive feedback

---

## 💡 Pro Tips

### **Rapid Testing**
Create multiple test contractor accounts and test different scenarios:
- Fresh account (never seen AI)
- Enrolled account (active user)
- Power user (multiple AI projects)

### **Feature Flags**
You can manually toggle AI for specific users without them enrolling:
```sql
-- Enable AI for specific user
UPDATE user_profiles SET ai_beta_enabled = true WHERE email = 'test@example.com';

-- Disable AI for specific user
UPDATE user_profiles SET ai_beta_enabled = false WHERE email = 'test@example.com';
```

### **Reset Project AI**
If you want to test initialization again:
```sql
-- Reset project AI status
UPDATE job_postings SET
  ai_initialized = false,
  ai_initialized_at = NULL,
  ai_initialization_mode = NULL
WHERE id = 'project-uuid-here';

-- Also delete project state to fully reset
DELETE FROM project_states WHERE project_id = 'project-uuid-here';
```

---

## 🎓 What You Built

You now have:

✅ **User-level AI control** - Contractors opt-in explicitly
✅ **Project-level AI tracking** - Know which projects use AI
✅ **Graceful rollout** - No disruption to existing users
✅ **Data collection** - Track adoption and usage
✅ **Safe testing** - Can enable/disable for specific users
✅ **Manual override** - Admin can control who has access

**This is production-ready for phased rollout!** 🚀
