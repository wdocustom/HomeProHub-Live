# Auto-GC System Testing Guide
## Comprehensive Guide to Testing the AI Agent System

**Created:** 2026-01-15
**Version:** 1.0
**Status:** Ready for Testing

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Prerequisites](#prerequisites)
3. [Initial Setup](#initial-setup)
4. [Testing Scenarios](#testing-scenarios)
5. [Integration Testing](#integration-testing)
6. [Troubleshooting](#troubleshooting)

---

## System Overview

The Auto-GC (Automated General Contractor) system is a template-driven AI agent swarm that manages residential construction projects from inception to completion. The system consists of:

### Core Components
- **9 AI Agents**: Orchestrator, Visionary, Shark, Whip, Sentinel, Hawk, Diplomat, Summarizer, Inspector
- **Template Engine**: Pre-defined project templates with phases, milestones, and trade requirements
- **AI Command Center**: Contractor-facing dashboard for project monitoring
- **Job Board Integration**: Seamless flow from awarded bids to active projects

### Database Tables
- `project_templates` - Master template definitions
- `template_milestones` - Milestone sequences and dependencies
- `project_states` - Current project state and phase
- `project_milestones` - Actual milestone tracking
- `project_logs` - Activity timeline
- `ai_agent_activity` - Agent decision logs

---

## Prerequisites

### 1. Configure Environment Variables

Before testing, ensure your `.env` file has the following configured:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-actual-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# AI API Keys
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
```

**⚠️ CRITICAL:** Replace the placeholder `https://your-project.supabase.co` with your actual Supabase project URL.

### 2. Seed Project Templates

Run the template seeding script to populate the database:

```bash
node seed-templates-direct.js
```

Expected output:
```
🌱 Starting template seeding...
Found 0 existing templates in database

✅ Inserted "New Custom Home (2500 sqft)"
✅ Inserted "Kitchen Remodel (High-End)"
✅ Inserted "Full Bathroom Remodel"

✅ Seeding complete! Total templates in database: 3
```

### 3. Verify Database Schema

Check that all required tables exist:

```sql
-- Run in Supabase SQL Editor
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'project_templates',
  'template_milestones',
  'project_states',
  'project_milestones',
  'project_logs',
  'ai_agent_activity',
  'job_postings',
  'contractor_bids'
)
ORDER BY table_name;
```

Expected: All 8 tables should be present.

---

## Initial Setup

### Step 1: Create Test Accounts

Create two test accounts:

1. **Homeowner Account**
   - Email: `test-homeowner@example.com`
   - Password: `TestPass123!`
   - Role: `homeowner`

2. **Contractor Account**
   - Email: `test-contractor@example.com`
   - Password: `TestPass123!`
   - Role: `contractor`

### Step 2: Configure Contractor Profile

Log in as the contractor and complete the profile:

1. Navigate to `/contractor-profile.html`
2. Fill in:
   - Company Name: "Test Construction Co"
   - Trade Type: "general_contractor"
   - ZIP Code: "90210"
   - Years in Business: "5"
   - Phone: "(555) 123-4567"
3. Click "Save Profile"

---

## Testing Scenarios

### Scenario 1: Job Board to AI Command Center Flow

**Objective:** Verify that jobs awarded on the job board appear in the AI Command Center.

#### Steps:

1. **Post a Job (as Homeowner)**
   - Log in as `test-homeowner@example.com`
   - Navigate to `/post-project.html`
   - Fill in:
     - Title: "Kitchen Remodel Test"
     - Description: "Complete kitchen renovation with new cabinets and countertops"
     - Budget: $15,000 - $25,000
     - ZIP Code: "90210"
     - Urgency: "soon"
   - Click "Post Project"
   - ✅ Verify: Job appears in `/homeowner-dashboard.html`

2. **Submit a Bid (as Contractor)**
   - Log out and log in as `test-contractor@example.com`
   - Navigate to `/job-board.html`
   - Find "Kitchen Remodel Test" job
   - Click "View Project & Bid"
   - Fill in:
     - Bid Low: $16,000
     - Bid High: $22,000
     - Duration: "6 weeks"
     - Availability: "Next week"
     - Message: "Professional kitchen remodeling with 5+ years experience"
   - Click "Submit Bid"
   - ✅ Verify: Success message appears
   - ✅ Verify: Bid shows in "Active Bids" tab

3. **Accept the Bid (as Homeowner)**
   - Log out and log in as `test-homeowner@example.com`
   - Navigate to `/homeowner-dashboard.html`
   - Find "Kitchen Remodel Test" project
   - Click "View Bids"
   - Find the contractor's bid
   - Click "Accept Bid"
   - ✅ Verify: Confirmation message
   - ✅ Verify: Job status changes to "In Progress"

4. **Verify in AI Command Center (as Contractor)**
   - Log out and log in as `test-contractor@example.com`
   - Navigate to `/contractor-tools.html`
   - Click "AI Command Center" tab
   - ✅ Verify: "Kitchen Remodel Test" appears in project dropdown with 🏆 icon
   - Select the project from dropdown
   - ✅ Verify: Project status card appears
   - ✅ Verify: Phase shows "planning" or current phase
   - ✅ Verify: Update section is visible

---

### Scenario 2: Template-Based Project Initialization

**Objective:** Test the Orchestrator agent's ability to initialize a project from a template.

#### Steps:

1. **Launch Template Project (as Contractor)**
   - Log in as `test-contractor@example.com`
   - Navigate to `/contractor-tools.html`
   - Click "Project Estimator" tab
   - In "Project Type" section:
     - Select: "Kitchen Remodel (High-End)"
   - ✅ Verify: Template details appear (duration: 42 days, complexity: moderate)
   - Fill in:
     - Description: "High-end kitchen renovation for test"
     - ZIP Code: "90210"
     - Material Level: "High-End"
   - Click "🚀 Launch Project with AI Planning"
   - ✅ Verify: "Creating Project Plan..." loading state
   - ✅ Verify: Success message appears
   - Click "View in Command Center"

2. **Verify Project in Command Center**
   - ✅ Verify: New project appears in dropdown with 📋 icon
   - Select the project
   - ✅ Verify: Project state is initialized
   - ✅ Verify: Phase is set from template
   - ✅ Verify: Activity log shows "Project initialized"

3. **Check Database State**
   ```sql
   -- Verify project_states was created
   SELECT project_id, current_phase, created_at
   FROM project_states
   ORDER BY created_at DESC
   LIMIT 1;

   -- Verify milestones were created from template
   SELECT COUNT(*) as milestone_count
   FROM project_milestones
   WHERE project_id = '[your_project_id]';
   ```
   - ✅ Verify: project_states record exists
   - ✅ Verify: Multiple milestones created (should match template phase count)

---

### Scenario 3: Contractor Update Logging & AI Summarizer

**Objective:** Test the logging system and Summarizer agent.

#### Steps:

1. **Log a Contractor Update**
   - In AI Command Center, select an active project
   - In "Log Project Update" section, enter:
     ```
     Completed demolition of existing cabinets.
     Rough plumbing inspection passed.
     Ordering new cabinet units - ETA 2 weeks.
     ```
   - Click "Log Update"
   - ✅ Verify: Success message
   - ✅ Verify: Update appears in Activity Log
   - ✅ Verify: Timestamp is correct

2. **Generate AI Summary**
   - Click "Generate AI Summary" button
   - ✅ Verify: Loading state ("Generating summary...")
   - ✅ Verify: Success message appears
   - ✅ Verify: New entry in Activity Log with "AI Summary" label

3. **Verify Database Logs**
   ```sql
   -- Check project_logs
   SELECT * FROM project_logs
   WHERE project_id = '[your_project_id]'
   ORDER BY created_at DESC
   LIMIT 5;

   -- Check ai_agent_activity
   SELECT agent_type, action_type, status
   FROM ai_agent_activity
   WHERE project_id = '[your_project_id]'
   ORDER BY created_at DESC
   LIMIT 5;
   ```
   - ✅ Verify: Log entries exist for both contractor update and AI summary
   - ✅ Verify: agent_type = 'summarizer' for AI summary

---

### Scenario 4: Hawk Agent - Contractor Search

**Objective:** Test the Hawk agent's ability to find subcontractors.

#### Steps:

1. **Activate Hawk Agent**
   - In AI Command Center, select a project
   - ✅ Verify: Hawk Agent card shows "Standby" status
   - ✅ Verify: "Auto-Scout Subcontractors" button is visible

2. **Run Auto-Scout**
   - Click "Auto-Scout Subcontractors"
   - ✅ Verify: Status changes to "Scanning..."
   - ✅ Verify: Button shows scanning animation
   - Wait 2.5 seconds
   - ✅ Verify: Results appear with 3 contractors
   - ✅ Verify: Each contractor shows:
     - Name
     - Rating
     - Distance
     - Specialty
     - Verified badge

3. **Test CTA Buttons**
   - ✅ Verify: "Invite All to Bid" button appears
   - ✅ Verify: "Verify on Map" button appears
   - Click "Invite All to Bid"
   - ✅ Verify: Confirmation message (implementation may vary)

---

### Scenario 5: Milestone Progression

**Objective:** Test milestone state management and dependencies.

#### Steps:

1. **View Project Milestones**
   ```sql
   -- Check milestones for a template-based project
   SELECT
     phase_name,
     status,
     planned_start_date,
     planned_end_date,
     dependencies
   FROM project_milestones
   WHERE project_id = '[your_project_id]'
   ORDER BY sequence_order;
   ```
   - ✅ Verify: Milestones are in correct order
   - ✅ Verify: First milestone is "pending" or "in_progress"
   - ✅ Verify: Dependencies are set correctly

2. **Update Milestone Status** (via SQL for now)
   ```sql
   -- Mark first milestone as completed
   UPDATE project_milestones
   SET
     status = 'completed',
     actual_end_date = NOW(),
     progress_percentage = 100
   WHERE project_id = '[your_project_id]'
   AND sequence_order = 1;
   ```

3. **Verify State Updates**
   ```sql
   -- Check if Orchestrator should advance phase
   SELECT current_phase, blockers, current_milestone_id
   FROM project_states
   WHERE project_id = '[your_project_id]';
   ```
   - ✅ Verify: Phase advances when milestone completes
   - ✅ Verify: Blockers list is updated if dependencies aren't met

---

## Integration Testing

### Test Case 1: Complete End-to-End Flow

**Goal:** Verify complete flow from job posting to project completion.

#### Workflow:
```
Homeowner posts job
    ↓
Contractor submits bid
    ↓
Homeowner accepts bid
    ↓
Project appears in AI Command Center (🏆 awarded)
    ↓
Contractor logs updates
    ↓
AI Summarizer generates daily updates
    ↓
Hawk Agent finds subcontractors
    ↓
Milestones are marked complete
    ↓
Project reaches final inspection
```

#### Validation Points:
- [ ] Job visible on job board
- [ ] Bid submission succeeds
- [ ] Bid acceptance triggers project activation
- [ ] Project appears in Command Center with correct icon
- [ ] Logging system works
- [ ] AI Summarizer generates coherent summaries
- [ ] Hawk Agent returns contractors
- [ ] Milestones can be progressed
- [ ] Database state is consistent throughout

---

### Test Case 2: Template Project Initialization

**Goal:** Verify Orchestrator agent properly initializes projects from templates.

#### Steps:
1. Select "New Custom Home (2500 sqft)" template
2. Provide project description and ZIP
3. Launch project
4. Verify in database:
   ```sql
   -- Check all components created
   SELECT
     ps.current_phase,
     COUNT(DISTINCT pm.id) as milestone_count,
     COUNT(DISTINCT pl.id) as log_count,
     COUNT(DISTINCT aa.id) as agent_activity_count
   FROM project_states ps
   LEFT JOIN project_milestones pm ON pm.project_id = ps.project_id
   LEFT JOIN project_logs pl ON pl.project_id = ps.project_id
   LEFT JOIN ai_agent_activity aa ON aa.project_id = ps.project_id
   WHERE ps.project_id = '[your_project_id]'
   GROUP BY ps.current_phase;
   ```

#### Expected Results:
- Milestone count should match template phases (10-26 depending on template)
- At least 1 log entry (initialization)
- At least 1 agent activity (orchestrator initialization)
- Current phase should be first phase from template

---

### Test Case 3: Multi-Agent Coordination

**Goal:** Test multiple agents working on the same project.

#### Scenario:
1. Initialize a "Kitchen Remodel" project
2. Log 3 contractor updates over simulated days
3. Generate AI summary (Summarizer agent)
4. Run Hawk Agent to find subs
5. Log findings in database
6. Verify coordination

#### Validation:
```sql
-- Check agent activity timeline
SELECT
  agent_type,
  action_type,
  created_at,
  status
FROM ai_agent_activity
WHERE project_id = '[your_project_id]'
ORDER BY created_at;
```

Expected agents in sequence:
1. `orchestrator` - initialization
2. `summarizer` - daily summary
3. `hawk` - contractor search

---

## Troubleshooting

### Issue 1: Templates Not Loading

**Symptom:** Dropdown only shows "Quick Estimate Only" option

**Solution:**
1. Check Supabase connection:
   ```bash
   node -e "const {supabase} = require('./database/db'); supabase.from('project_templates').select('*').then(r => console.log(r.data || r.error))"
   ```
2. Verify templates exist:
   ```sql
   SELECT COUNT(*) FROM project_templates;
   ```
3. Re-run seeding if needed:
   ```bash
   node seed-templates-direct.js
   ```

---

### Issue 2: Awarded Jobs Not Showing in Command Center

**Symptom:** Accepted bids don't appear in AI Command Center

**Debug Steps:**
1. Check bid status:
   ```sql
   SELECT id, job_id, contractor_email, status
   FROM contractor_bids
   WHERE contractor_email = 'test-contractor@example.com';
   ```
2. Check job status:
   ```sql
   SELECT id, title, status, winning_bid_id
   FROM job_postings
   WHERE winning_bid_id IS NOT NULL;
   ```
3. Check browser console for errors
4. Verify `loadActiveProjects()` function is being called

**Expected Behavior:**
- Bid status should be `accepted`
- Job status should be `in_progress`
- Job should appear with 🏆 icon in dropdown

---

### Issue 3: AI Summarizer Not Generating

**Symptom:** "Generate AI Summary" button doesn't work

**Debug Steps:**
1. Check API keys are set:
   ```bash
   echo $OPENAI_API_KEY
   echo $ANTHROPIC_API_KEY
   ```
2. Check browser console for errors
3. Check server logs:
   ```bash
   tail -f server.log
   ```
4. Test API endpoint directly:
   ```bash
   curl -X POST http://localhost:3000/api/agents/generate-daily-summary \
     -H "Content-Type: application/json" \
     -d '{"project_id":"your-project-id"}'
   ```

---

### Issue 4: Database Connection Errors

**Symptom:** "TypeError: fetch failed" or "getaddrinfo EAI_AGAIN"

**Solution:**
1. Verify `SUPABASE_URL` in `.env` is correct (not the placeholder)
2. Check Supabase service role key is correct
3. Test connection:
   ```bash
   curl -I https://your-actual-project.supabase.co
   ```

---

## Next Steps After Testing

### 1. Deploy to Production
- Set production environment variables
- Run database migrations on production
- Seed templates in production database
- Test with real users

### 2. Enable Remaining Agents
Currently implemented agents:
- ✅ Summarizer (Phase 1)
- ✅ Orchestrator (Template initialization)
- ✅ Hawk (Contractor search - mock data)

To activate:
- [ ] Whip Agent (Critical Path Method scheduling)
- [ ] Visionary Agent (Blueprint analysis)
- [ ] Sentinel Agent (Code compliance)
- [ ] Diplomat Agent (Communication handler)
- [ ] Inspector Agent (Quality control)

### 3. Connect Real Contractor Database
Replace Hawk Agent mock data with real contractor queries from `user_profiles` table.

### 4. Add Milestone UI
Create contractor interface to:
- View Gantt chart of milestones
- Mark milestones complete
- Request inspections
- Update progress percentage

---

## Test Checklist

Use this checklist to track testing progress:

### Setup
- [ ] Supabase configured with real URL
- [ ] API keys added to `.env`
- [ ] Templates seeded successfully
- [ ] Test accounts created

### Job Board Integration
- [ ] Jobs post successfully
- [ ] Bids submit successfully
- [ ] Bid acceptance works
- [ ] Awarded jobs appear in Command Center
- [ ] Both 🏆 and 📋 icons display correctly

### Template System
- [ ] Templates load in dropdown
- [ ] Template details display
- [ ] Project launches successfully
- [ ] Milestones created from template
- [ ] Project state initialized

### AI Agents
- [ ] Summarizer generates summaries
- [ ] Hawk Agent finds contractors
- [ ] Orchestrator initializes projects
- [ ] Agent activity logged to database
- [ ] No errors in console

### Database Integrity
- [ ] All tables exist
- [ ] Foreign keys working
- [ ] Data persists correctly
- [ ] No orphaned records

---

## Support & Documentation

- **Main README**: `/AI_AGENT_SYSTEM_README.md`
- **Architecture Guide**: `/UNIVERSAL_AUTO_GC_ARCHITECTURE.md`
- **API Documentation**: Coming soon
- **Agent Specifications**: See architecture doc

---

**Happy Testing! 🚀**

For questions or issues, check the console logs and database queries above. Most issues can be diagnosed by checking the browser console and running the SQL queries provided in the troubleshooting section.
