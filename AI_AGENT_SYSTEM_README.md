# HomeProHub AI Agent System ("Auto-GC")

## 🚀 What Was Built

We've successfully implemented the **Phase 1 MVP** of the HomeProHub "Auto-GC" AI Agent System - a revolutionary feature that transforms contractors into AI-powered general contractors.

### ✅ Completed Features

#### 1. Database Schema
- **project_states** - Tracks project phase, blockers, and AI agent logs
- **project_logs** - Stores all project activity (contractor updates, system events, AI actions)
- **ai_agent_activity** - Logs all AI agent decisions and actions
- Reused existing **notifications** and **project_team** tables

**Location:** `database/migrations/add_ai_agent_system_tables.sql`

#### 2. Backend AI Agent Endpoints
All endpoints in `server.js`:

- **POST /api/agents/generate-daily-summary**
  - Fetches project logs from last 24 hours
  - Sends to OpenAI GPT-4o for summarization
  - Creates notification for homeowner
  - Logs AI agent activity

- **POST /api/agents/log-contractor-update**
  - Allows contractors to log project updates
  - Updates project state last activity
  - Stores in project_logs table

- **GET /api/agents/project-logs/:project_id**
  - Retrieves all project logs
  - Optional `?hours=24` parameter

- **GET /api/agents/project-state/:project_id**
  - Gets current project state (phase, blockers, last activity)

#### 3. AI Command Center UI
Transformed **Contractor Tools** page into **Contractor Command Center**:

**New Features:**
- 🤖 AI Command Center tab (default view)
- 📋 Active project selector
- 📊 Project status dashboard (phase, last activity, log count)
- ✏️ Quick update logger
- 🤖 AI summary generator button
- 📜 Real-time activity log viewer
- 🎯 Future agent cards (Orchestrator, Hawk, Whip, Diplomat)

**Location:** `public/contractor-tools.html`

#### 4. Database Functions
Added to `database/db.js`:

- `createProjectLog()` - Create activity log entry
- `getProjectLogs()` - Get logs with time filter
- `getAllProjectLogs()` - Get all logs
- `upsertProjectState()` - Create/update project state
- `getProjectState()` - Retrieve project state
- `updateProjectPhase()` - Update project phase
- `logAIAgentActivity()` - Log AI agent actions
- `getActiveProjects()` - Fetch active projects

---

## 📦 Installation & Setup

### Step 1: Run Database Migration

You need to create the new database tables in Supabase:

```bash
# Option A: Using Supabase CLI (if installed)
supabase db push

# Option B: Manual (Copy & Paste in Supabase SQL Editor)
# 1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/sql
# 2. Open: database/migrations/add_ai_agent_system_tables.sql
# 3. Copy the entire file contents
# 4. Paste into Supabase SQL Editor
# 5. Click "Run"
```

**Verification:**
After running the migration, you should see these new tables:
- `project_states`
- `project_logs`
- `ai_agent_activity`

And this view:
- `active_projects_with_state`

### Step 2: Verify Environment Variables

Ensure your `.env` file has:

```env
# Required for AI Agent System
OPENAI_API_KEY=sk-...

# Required for database
SUPABASE_URL=https://...supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Optional (for future agents)
ANTHROPIC_API_KEY=...
```

### Step 3: Restart Your Server

```bash
npm start
# or
node server.js
```

---

## 🧪 Testing the Phase 1 Agent

### Test Flow:

1. **Login as Contractor**
   - Navigate to: `http://localhost:3000/contractor-tools.html`
   - The **AI Command Center** tab should be active by default

2. **Create or Select a Project**
   - If you have active projects, they'll appear in the dropdown
   - If not, create a test project first:
     - Go to Job Board as a homeowner
     - Post a job
     - Accept a bid as the contractor

3. **Log a Project Update**
   - Select the project from dropdown
   - Type an update like: "Finished drywall in all rooms. Starting paint prep tomorrow."
   - Click "Log Update"
   - ✅ Should see success message
   - 📜 Activity log should update

4. **Generate AI Summary**
   - After logging 1-2 updates, click "Generate AI Summary"
   - 🤖 The AI will:
     - Fetch all logs from last 24 hours
     - Send to GPT-4o for summarization
     - Create a notification for the homeowner
     - Display the summary on screen

5. **Verify Homeowner Receives Notification**
   - Login as the homeowner
   - Check notifications (bell icon)
   - Should see "📋 Daily Project Update" notification
   - Should contain AI-generated friendly summary

---

## 🎯 API Testing with cURL

### Log a Contractor Update
```bash
curl -X POST http://localhost:3000/api/agents/log-contractor-update \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "YOUR_PROJECT_UUID",
    "update_text": "Completed electrical rough-in. Inspector approved all work.",
    "contractor_email": "contractor@example.com",
    "contractor_name": "John Builder"
  }'
```

### Generate AI Summary
```bash
curl -X POST http://localhost:3000/api/agents/generate-daily-summary \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "YOUR_PROJECT_UUID"
  }'
```

### Get Project Logs
```bash
curl http://localhost:3000/api/agents/project-logs/YOUR_PROJECT_UUID?hours=24
```

### Get Project State
```bash
curl http://localhost:3000/api/agents/project-state/YOUR_PROJECT_UUID
```

---

## 🏗️ Architecture Overview

### The AI Agent "Swarm"

The system is designed as a multi-agent architecture:

1. **The Summarizer** (✅ ACTIVE - Phase 1)
   - Generates friendly homeowner updates
   - Powered by GPT-4o
   - Triggers on-demand via button click

2. **The Orchestrator** (🚧 Coming Soon - Phase 2)
   - Manages project state machine
   - Tracks dependencies between phases
   - Coordinates other agents

3. **The Hawk** (🚧 Coming Soon - Phase 3)
   - Procurement specialist
   - Finds subcontractors using Lead Scout data
   - Sends automated RFQs

4. **The Whip** (🚧 Coming Soon - Phase 4)
   - Schedule coordinator
   - Detects delays (via delivery tracking)
   - Auto-reschedules dependent trades

5. **The Diplomat** (🚧 Coming Soon - Phase 5)
   - Communication handler
   - Sends SMS/Voice via Twilio/Vapi.ai
   - Manages contractor/homeowner interactions

### Data Flow (Phase 1)

```
Contractor logs update
    ↓
POST /api/agents/log-contractor-update
    ↓
Saved to project_logs table
    ↓
[Contractor clicks "Generate AI Summary"]
    ↓
POST /api/agents/generate-daily-summary
    ↓
Fetch logs from last 24 hours
    ↓
Send to OpenAI GPT-4o
    ↓
AI generates friendly summary
    ↓
Save to notifications table (for homeowner)
    ↓
Log AI activity to ai_agent_activity table
    ↓
Return summary to contractor (preview)
```

---

## 🐛 Troubleshooting

### Issue: Migration fails
**Solution:** Check Supabase SQL Editor for error messages. Common issues:
- Table already exists (drop tables first if re-running)
- Missing permissions (use service role key)

### Issue: "No active projects" in dropdown
**Solution:**
1. Ensure you have projects with status `in_progress` or `active`
2. Check that contractor is properly assigned to projects
3. Verify `profile.email` matches `job_postings.homeowner_email` or contractor assignment

### Issue: AI Summary returns "No activity in last 24 hours"
**Solution:**
- Log at least one update first using "Log Update" button
- Check that `project_logs` table has entries for your project

### Issue: OpenAI API error
**Solution:**
- Verify `OPENAI_API_KEY` is set in `.env`
- Check API key has sufficient credits
- Ensure you're using a valid model name (`gpt-4o`)

---

## 📊 Database Schema Reference

### project_states
```sql
- id (uuid, PK)
- project_id (uuid, FK to job_postings)
- current_phase (enum: planning, demo, rough_in, etc.)
- blockers (jsonb array)
- agent_logs (jsonb array)
- estimated_completion_date (date)
- actual_start_date (date)
- last_activity_date (timestamp)
```

### project_logs
```sql
- id (uuid, PK)
- project_id (uuid, FK to job_postings)
- entry_text (text)
- source (enum: contractor_update, homeowner_update, ai_agent, etc.)
- created_by_email (text)
- created_by_name (text)
- metadata (jsonb)
- photos (jsonb array)
- created_at (timestamp)
```

### ai_agent_activity
```sql
- id (uuid, PK)
- project_id (uuid, FK to job_postings)
- agent_type (enum: orchestrator, visionary, hawk, whip, diplomat, summarizer)
- action_type (text)
- action_description (text)
- action_result (text)
- input_data (jsonb)
- output_data (jsonb)
- status (enum: pending, in_progress, completed, failed)
- error_message (text)
- created_at (timestamp)
- completed_at (timestamp)
```

---

## 🔮 Future Enhancements (Roadmap)

### Phase 2: The Orchestrator
- Automatic phase detection (from contractor updates)
- Dependency tracking (can't do drywall until electrical is done)
- Blocker detection via NLP

### Phase 3: The Hawk (Procurement)
- Query Lead Scout database for local subs
- Auto-generate RFQs based on project scope
- Compare bids and present recommendations

### Phase 4: The Whip (Scheduling)
- Integration with delivery tracking APIs (UPS, FedEx)
- Automatic reschedule when delays detected
- Calendar management and conflict resolution

### Phase 5: The Diplomat (Communication)
- Twilio SMS integration
- Vapi.ai voice call integration
- Automated check-ins and status requests

### Phase 6: The Visionary (Quality Control)
- Photo analysis with GPT-4o Vision
- NEC code compliance checking
- Progress verification vs. schedule

---

## 📝 Files Modified/Created

### New Files
- `database/migrations/add_ai_agent_system_tables.sql` - Database schema
- `AI_AGENT_SYSTEM_README.md` - This file

### Modified Files
- `server.js` - Added AI agent endpoints (lines 7358-7609)
- `database/db.js` - Added AI agent database functions
- `public/contractor-tools.html` - Transformed into Command Center

---

## 🎓 Developer Notes

### AI Prompt Engineering
The summarizer agent uses this system prompt:

```
You are a helpful Construction Project Manager.
Summarize these raw project activity logs into a friendly, 3-bullet-point text message for the homeowner.
Tone: Professional but reassuring. Focus on progress made and next steps.
Keep it concise (under 200 words total).
```

This can be customized in `server.js` around line 7399.

### Adding New Agent Types
1. Add enum value to `ai_agent_activity.agent_type` in migration
2. Create new endpoint in `server.js`
3. Add UI card in `contractor-tools.html` (under AI Agent Activity section)
4. Implement agent logic (follow summarizer pattern)

### Security Considerations
- All endpoints should eventually use `requireAuth` middleware
- Validate `project_id` ownership before allowing updates
- Sanitize user input before sending to AI
- Rate limit AI endpoints to prevent API abuse

---

## ✅ Success Criteria

You've successfully deployed Phase 1 if:

- ✅ Migration runs without errors
- ✅ Command Center tab loads and displays
- ✅ Can select a project from dropdown
- ✅ Can log an update and see it in activity log
- ✅ Can click "Generate AI Summary" and receive response
- ✅ Homeowner receives notification with AI-generated summary
- ✅ `ai_agent_activity` table shows logged agent actions

---

## 📞 Support

If you encounter issues:
1. Check console logs (browser DevTools + terminal)
2. Verify database migration succeeded
3. Ensure all environment variables are set
4. Check that OpenAI API key is valid

---

**Built with ❤️ by Claude Code**
*Transforming HomeProHub into an AI-powered construction management platform*
