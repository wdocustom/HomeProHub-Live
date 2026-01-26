# AI Agent Phased Rollout Strategy
**Platform:** HomeProHub.today
**Date:** 2026-01-26
**Purpose:** Gradual AI feature rollout with user controls and feedback collection

---

## 🎯 Executive Summary

This document outlines a phased approach to rolling out AI agents, allowing:
- **User-initiated AI** (contractors opt-in to test features)
- **Automatic AI** (agents run in background for enrolled users)
- **Granular control** (enable/disable individual agents)
- **Feedback collection** (gather user insights before full rollout)

---

## 🤖 Available AI Agents (Current Implementation)

### **Tier 1: Core Agents (Production Ready)**
1. **Orchestrator** - Project initialization, milestone management, state machine
2. **Visionary** - Blueprint analysis, project intake (PDF/photo ingestion)
3. **Whip** - Critical path scheduling, dependency management

### **Tier 2: Enhanced Agents (Testing Phase)**
4. **Shark** - Contractor procurement, trade matching, opportunity creation
5. **Sentinel** - Code compliance checking, quality control, photo inspection

### **Tier 3: Future Agents (Planned)**
6. **Hawk** - Lead scouting, market analysis
7. **Diplomat** - Homeowner communication, updates
8. **Summarizer** - Daily/weekly project summaries

---

## 📊 Current State Analysis

### **What's Working:**
✅ Projects automatically initialize AI when imported via contractor import
✅ Manual initialization available via Command Center button
✅ Activity log shows AI agent actions
✅ Template system supports multiple project types

### **What's Missing:**
❌ No user preferences for AI features
❌ No feature flags to control individual agents
❌ No opt-in/opt-out mechanism
❌ No feedback collection system
❌ Agents run automatically with no user control

---

## 🎚️ Proposed Feature Flag System

### **Database Schema Addition**

```sql
-- User AI preferences table
CREATE TABLE user_ai_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,

  -- Global AI toggle
  ai_enabled BOOLEAN DEFAULT false,
  enrollment_date TIMESTAMPTZ,

  -- Individual agent toggles
  orchestrator_enabled BOOLEAN DEFAULT true,
  visionary_enabled BOOLEAN DEFAULT false,
  shark_enabled BOOLEAN DEFAULT false,
  whip_enabled BOOLEAN DEFAULT false,
  sentinel_enabled BOOLEAN DEFAULT false,
  hawk_enabled BOOLEAN DEFAULT false,

  -- Activation modes
  auto_initialize_new_projects BOOLEAN DEFAULT false,
  manual_approval_required BOOLEAN DEFAULT true,

  -- Notification preferences
  notify_on_agent_actions BOOLEAN DEFAULT true,
  daily_summary_enabled BOOLEAN DEFAULT false,

  -- Feedback tracking
  feedback_provided BOOLEAN DEFAULT false,
  satisfaction_score INTEGER, -- 1-5
  feedback_notes TEXT,
  last_feedback_date TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id),
  UNIQUE(user_email)
);

-- Project-level AI settings (override user preferences)
CREATE TABLE project_ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES job_postings(id) ON DELETE CASCADE,

  -- Override user preferences for this project
  ai_enabled BOOLEAN DEFAULT NULL, -- null = use user preference

  -- Which agents are active for THIS project
  active_agents JSONB DEFAULT '[]'::jsonb,

  -- Automation level
  automation_mode TEXT CHECK (automation_mode IN (
    'manual', -- All agent actions require approval
    'assisted', -- Agents suggest, user approves
    'automatic' -- Agents run autonomously
  )) DEFAULT 'assisted',

  -- Usage tracking
  total_agent_actions INTEGER DEFAULT 0,
  last_agent_action_date TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id)
);

-- Agent action approval queue (for manual/assisted mode)
CREATE TABLE agent_action_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES job_postings(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_description TEXT NOT NULL,
  action_payload JSONB,

  -- Approval status
  status TEXT CHECK (status IN (
    'pending', 'approved', 'rejected', 'expired'
  )) DEFAULT 'pending',

  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Auto-expire after 24 hours
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI feedback collection
CREATE TABLE ai_feature_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  user_email TEXT NOT NULL,
  project_id UUID REFERENCES job_postings(id),

  -- What feature/agent is this feedback about?
  feature_name TEXT NOT NULL, -- 'orchestrator', 'command_center', 'auto_summary', etc.

  -- Feedback
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  helpful BOOLEAN,
  would_recommend BOOLEAN,
  feedback_text TEXT,

  -- Usage context
  days_used INTEGER,
  features_used JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🎬 Phased Rollout Plan

### **Phase 1: Beta Enrollment (Week 1-2)**
**Goal:** Get 10-20 contractors to opt-in for testing

**Implementation:**
1. Add "AI Beta Program" banner to Command Center
2. Create enrollment flow with consent
3. Enable only **Orchestrator** agent (safe, low-risk)
4. Manual initialization only (no auto-activation)

**What Users Experience:**
- Click "Join AI Beta" button
- See AI initialization option for existing projects
- Orchestrator creates milestones and tracks progress
- Activity log shows what AI is doing

**Success Metrics:**
- 10+ contractors enrolled
- 20+ projects initialized
- Zero complaints about unexpected behavior

---

### **Phase 2: Assisted Mode (Week 3-4)**
**Goal:** Test agent suggestions with human approval

**Implementation:**
1. Add "Approve Agent Actions" UI to Command Center
2. Enable **Visionary** + **Whip** agents
3. Agents suggest actions, wait for approval
4. Collect feedback on suggestions

**What Users Experience:**
- Visionary analyzes blueprints → user approves/rejects findings
- Whip suggests schedule adjustments → user approves/rejects
- Dashboard shows "3 pending AI suggestions"

**Success Metrics:**
- 70%+ approval rate for agent suggestions
- Positive feedback on suggestion quality
- Users understand what AI is doing

---

### **Phase 3: Automatic Mode (Week 5-6)**
**Goal:** Enable autonomous agents for power users

**Implementation:**
1. Add "Automation Level" setting (Manual / Assisted / Automatic)
2. Enable **Shark** agent for contractor matching
3. Enable **Sentinel** for quality checks
4. Daily summary emails

**What Users Experience:**
- Set automation to "Automatic"
- Agents run in background
- Receive daily summary: "Your AI team completed 5 actions today"
- Can review and undo agent actions

**Success Metrics:**
- 50%+ of beta users choose Automatic mode
- High satisfaction with autonomous operations
- Feedback collected for improvements

---

### **Phase 4: General Availability (Week 7+)**
**Goal:** Offer AI to all contractors as opt-in feature

**Implementation:**
1. Remove "beta" label
2. Add AI features to pricing/marketing
3. Create onboarding tutorial
4. Full feedback system

**What Users Experience:**
- See "Unlock AI Command Center" on dashboard
- Choose subscription tier with AI features
- Full suite of agents available
- In-app support and tutorials

---

## 🎛️ User Control Interface

### **Settings Page: AI Preferences**

```
┌─────────────────────────────────────────────────┐
│ 🤖 AI Command Center Settings                  │
├─────────────────────────────────────────────────┤
│                                                 │
│ ⚡ AI Status: [●] ACTIVE    [Change]           │
│                                                 │
│ 🎚️ Automation Level:                           │
│   ( ) Manual - I approve every action           │
│   (●) Assisted - AI suggests, I decide         │
│   ( ) Automatic - AI works autonomously         │
│                                                 │
├─────────────────────────────────────────────────┤
│ 🤖 Active AI Agents:                           │
│                                                 │
│ [✓] Orchestrator - Project management          │
│     ↳ Creates milestones, tracks progress       │
│                                                 │
│ [✓] Visionary - Blueprint analysis             │
│     ↳ Analyzes plans, extracts requirements     │
│                                                 │
│ [✓] Whip - Scheduling & dependencies           │
│     ↳ Critical path management, alerts          │
│                                                 │
│ [ ] Shark - Contractor matching (Coming Soon)  │
│     ↳ Finds subcontractors, manages bids        │
│                                                 │
│ [ ] Sentinel - Quality control (Beta)          │
│     ↳ Photo inspection, code compliance         │
│                                                 │
├─────────────────────────────────────────────────┤
│ 📬 Notifications:                              │
│                                                 │
│ [✓] Notify me when agents take actions         │
│ [✓] Daily activity summary                     │
│ [ ] Weekly progress report                      │
│                                                 │
├─────────────────────────────────────────────────┤
│ 🆕 New Projects:                               │
│                                                 │
│ [ ] Auto-initialize AI for new projects        │
│ [✓] Ask me each time                           │
│                                                 │
│         [Save Preferences]                      │
└─────────────────────────────────────────────────┘
```

---

## 💬 Feedback Collection Points

### **1. In-App Feedback Widget**
After each AI action, show subtle prompt:
```
┌─────────────────────────────────────────────┐
│ 🤖 The Orchestrator created 12 milestones  │
│                                             │
│ Was this helpful?  👍 Yes   👎 No          │
└─────────────────────────────────────────────┘
```

### **2. Weekly Check-in**
After 1 week of use:
```
┌──────────────────────────────────────────────┐
│ 📊 How's your AI experience going?          │
│                                              │
│ Rate your satisfaction: ⭐⭐⭐⭐⭐           │
│                                              │
│ What's working well?                         │
│ [                                        ]   │
│                                              │
│ What needs improvement?                      │
│ [                                        ]   │
│                                              │
│         [Submit Feedback]                    │
└──────────────────────────────────────────────┘
```

### **3. Feature-Specific Surveys**
After using specific agent:
- "How accurate was Visionary's blueprint analysis?"
- "Did Whip's schedule suggestions save you time?"
- "Would you trust Shark to find subcontractors?"

---

## 🔧 Implementation Checklist

### **Backend (server.js)**
- [ ] Create user AI preferences endpoints
  - `GET /api/ai/preferences` - Get user's AI settings
  - `POST /api/ai/preferences` - Update AI settings
  - `POST /api/ai/enroll` - Enroll in beta program
  - `POST /api/ai/feedback` - Submit feedback

- [ ] Create project AI settings endpoints
  - `GET /api/ai/project-settings/:project_id`
  - `POST /api/ai/project-settings/:project_id`

- [ ] Create agent action approval endpoints
  - `GET /api/ai/pending-actions/:project_id`
  - `POST /api/ai/approve-action/:action_id`
  - `POST /api/ai/reject-action/:action_id`

- [ ] Modify agent services to check permissions
  - Before any agent action, check `user_ai_preferences`
  - In assisted mode, create approval request instead of executing
  - Log all agent actions with user ID for analytics

### **Frontend (Command Center)**
- [ ] Create AI Settings page (`/ai-settings.html`)
- [ ] Add "Join AI Beta" enrollment flow
- [ ] Add "Pending AI Actions" approval UI
- [ ] Add feedback widget to activity log
- [ ] Add automation level toggle

### **Database Migrations**
- [ ] Create migration: `add_ai_preferences.sql`
- [ ] Seed default preferences for existing users
- [ ] Add indexes for performance

---

## 📈 Success Metrics

### **Adoption Metrics**
- Beta enrollment rate
- Feature activation rate per agent
- Projects with AI enabled
- User retention after 30 days

### **Usage Metrics**
- Agent actions per project
- Approval rate (assisted mode)
- Time to approve actions
- Automation mode distribution

### **Satisfaction Metrics**
- NPS score for AI features
- Thumbs up/down ratio
- Feedback survey responses
- Feature requests

### **Business Metrics**
- Time saved per project
- Reduction in scheduling conflicts
- Increase in project completion rate
- Contractor referrals (AI as selling point)

---

## 🚀 Quick Start: Minimum Viable Rollout

If you want to start **immediately** with minimal development:

### **Option A: Manual Opt-In (No Code Changes)**
1. Create Google Form: "Join AI Beta Program"
2. Manually add test users to whitelist in code
3. Manually initialize their projects via Command Center
4. Collect feedback via email/form

### **Option B: Simple Feature Flag (1 hour dev)**
1. Add `ai_beta_enabled` boolean to `user_profiles` table
2. Check this flag before calling `OrchestratorAgent.initializeProject()`
3. Add "Enable AI" checkbox to contractor profile page
4. Manually enable for test users

### **Option C: Full System (1-2 days dev)**
Implement the complete feature flag system described above.

---

## 🎯 Recommendation

**Start with Option B** for immediate testing:
- Low development effort (< 2 hours)
- Gives you control over who sees AI
- Easy to expand later to full system
- Allows safe testing with select users

Then **transition to Option C** after gathering feedback from 10-20 users.

---

## 📞 Next Steps

1. **Choose rollout approach** (A, B, or C above)
2. **Identify 5-10 test users** (contractors you trust for honest feedback)
3. **Enable AI for test users** (manually or via flag)
4. **Monitor Command Center activity** for 1 week
5. **Collect feedback** via calls/emails
6. **Iterate** based on learnings
7. **Expand** to broader audience

---

## 🤔 Key Questions to Answer During Beta

- Do users understand what AI is doing?
- Do they trust AI suggestions?
- Which agents provide the most value?
- Which agents cause confusion/concern?
- What's the ideal automation level?
- How often do users check AI activity?
- What features are missing?
- Would they recommend AI to other contractors?
