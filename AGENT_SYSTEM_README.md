# Autonomous Agent System - Safety Architecture

**Version:** 1.0.0
**Implementation Date:** 2026-01-19
**Status:** Phase 2 Complete - Safety Architecture Built

---

## Executive Summary

This document describes the **Autonomous Development Trinity** - a system of three AI agents designed to assist with software development while maintaining strict safety, auditability, and human oversight.

**Core Principle:**
*"Agents do not deploy to production. All changes are artifacts (PRs, commits, test reports). Human approval is ON by default."*

---

## The Three Agents

### 🔧 The Mechanic - Incident Response

**Role:** Responds to errors, incidents, and system failures

**Workflow:**
1. Detect error/incident
2. **Mitigate FIRST** (rollback, feature flag off, rate limit)
3. Analyze root cause
4. Propose minimal fix
5. Create PR
6. Run Test Pilot validation
7. **Wait for approval**
8. Human merges → CD handles deploy

**Capabilities:**
- ✅ Read errors and logs
- ✅ Create PRs
- ✅ Run tests
- ✅ Create tickets
- ❌ NO live patching
- ❌ NO schema changes
- ❌ NO deployments
- ❌ NO migrations

**File Access:**
- CAN modify: `services/**/*.js`
- CAN read: Most project files
- CANNOT modify: `server.js`, `database/*.sql`, auth code, payment code

**Rate Limits:**
- Configurable per agent config
- Default: 10 runs per 24 hours

---

### 🏗️ The Builder - Feature Development

**Role:** Implements features from validated tickets

**Workflow:**
1. Load validated feature request
2. Validate ticket quality (acceptance criteria, metrics, scope)
3. Load architectural constraints
4. Query knowledge base for context
5. Generate implementation plan
6. Validate plan with policy engine
7. Generate code (or create plan for human)
8. Run Test Pilot validation
9. Create PR with full change artifact
10. **Wait for approval**
11. Human merges → CD handles deploy

**Capabilities:**
- ✅ Create PRs
- ✅ Run tests
- ✅ Propose migrations (via PR only)
- ❌ NO schema modifications
- ❌ NO auth or payment code
- ❌ NO deployments
- ❌ CANNOT read error logs

**File Access:**
- CAN modify: `public/**/*.html`, `public/**/*.js`, `public/**/*.css`, `routes/**/*.js`, `services/**/*.js`
- CAN read: Most project files
- CANNOT modify: `server.js`, `database/*.sql`, `agents/**/*.js`, auth code, payment code

**Rate Limits:**
- Default: 5 runs per 24 hours
- Max 10 files per PR

---

### 🔍 The Improver - Code Quality Analysis

**Role:** Proactively identifies issues and creates improvement tickets

**CRITICAL:** The Improver **NEVER writes code directly**. It only creates tickets for The Builder.

**Workflow:**
1. Triggered by **metrics ONLY** (no random scanning)
2. Analyze specific metric (latency, errors, bundle size, etc.)
3. Create structured tickets
4. Tickets go to The Builder queue

**Allowed Triggers:**
- ✅ Latency regressions (>50% increase)
- ✅ Error hotspots (>10 occurrences)
- ✅ Security warnings
- ✅ Bundle size growth (>20%)
- ✅ Accessibility failures

**Forbidden:**
- ❌ Random file scanning
- ❌ Subjective refactors
- ❌ Cosmetic-only tickets
- ❌ Creating PRs
- ❌ Modifying files

**File Access:**
- CAN read: Most project files
- CANNOT modify: **ANYTHING**

**Rate Limits:**
- Max 3 tickets per run
- Scheduled runs: Every 6-12 hours

---

## Safety Architecture

### 1. Policy & Capability Engine

**Location:** `agents/config/policy-engine.js`

**Purpose:** Enforces file-level and action-level permissions

**How it works:**
- Every file access checked against permissions matrix
- Every action (create PR, rollback, deploy) checked against capabilities
- Agents are **denied at the tool level**, not by convention
- Violations logged and blocked

**Example:**
```javascript
checkFilePermission('mechanic', 'database/schema.sql', 'write')
// => { allowed: false, reason: "Agent 'mechanic' is denied access. This file is HUMAN ONLY." }
```

### 2. Test Pilot Service

**Location:** `agents/config/test-pilot.js`

**Purpose:** CI-equivalent validation pipeline

**Stages:**
1. Syntax check (CRITICAL - blocks if fails)
2. Linting (WARNING - doesn't block)
3. Type checking (OPTIONAL)
4. Unit tests (CRITICAL if tests exist)
5. Integration tests (CRITICAL if API changed)
6. Auth regression (CRITICAL if auth changed)
7. Performance checks (OPTIONAL)
8. Security scan (CRITICAL - blocks if fails)

**Rule:** If any CRITICAL stage fails, the change is **BLOCKED**.

### 3. Agent Orchestrator

**Location:** `agents/orchestrator.js`

**Purpose:** Coordinates agents, enforces rate limits, detects conflicts

**Responsibilities:**
- Validate agent requests with policy engine
- Check rate limits before execution
- Detect conflicts (is another agent already working on this?)
- Execute agent if approved
- Log all activity immutably
- Notify humans of PRs and tickets
- Track active jobs

### 4. Scheduler

**Location:** `agents/scheduler.js`

**Purpose:** Runs periodic tasks for The Improver

**Schedule:**
- Every 6 hours: Error rate check
- Every 12 hours: Performance metrics
- Daily: Bundle size check
- Weekly: Accessibility (not yet implemented)

**Safety:**
- Can be disabled via config
- All runs logged
- Rate limits enforced

---

## Approval Workflow

### All PRs Require Human Approval

1. Agent creates PR (artifact)
2. PR includes:
   - Full change artifact metadata
   - Risk classification
   - Test Pilot results
   - Rollback plan
   - Agent metadata (version, prompt hash, etc.)
3. Notification sent to humans
4. Human reviews:
   - Code changes
   - Test results
   - Risk assessment
   - Policy violations (if any)
5. Human approves or rejects
6. If approved, human merges
7. CD pipeline handles deployment

### Approval is NOT optional

Agents **CANNOT bypass approval**. This is enforced at multiple levels:
- Policy engine blocks deployment actions
- Orchestrator requires approval workflow
- No agent has `can_deploy: true` capability
- All PRs tracked in database

---

## Rate Limiting

### Why Rate Limiting?

Prevents:
- Agent runaway loops
- Resource exhaustion
- Spam PRs/tickets
- Cost overruns (API usage)

### How it works

**Database-enforced:**
```sql
CREATE FUNCTION check_agent_rate_limit(p_agent_name TEXT)
RETURNS BOOLEAN
```

Checks:
- Runs in last N hours
- Max runs per window
- Configurable per agent

**Default Limits:**
- Mechanic: 10 runs / 24 hours
- Builder: 5 runs / 24 hours
- Improver: 20 runs / 24 hours (more frequent, less impactful)

---

## Conflict Detection

### What is a conflict?

Two scenarios:
1. **Active job conflict:** Agent A is currently working on error #123, Agent B tries to also work on error #123
2. **Recent activity conflict:** Agent finished working on ticket #456 less than 30 minutes ago, Agent tries again

### How it's prevented

Orchestrator checks before running:
- `activeJobs` map (in-memory tracking)
- Recent agent activity (database query)
- Returns conflict details if found
- Blocks execution

---

## API Endpoints

**Base Path:** `/api/dev/*`

**Authentication:** Required (TODO: implement in server.js)

| Endpoint | Method | Purpose | Access |
|----------|--------|---------|--------|
| `/api/dev/ticket` | POST | Create feature request ticket | User |
| `/api/dev/agents` | GET | Get status of all agents | User |
| `/api/dev/agents/:name/activity` | GET | Get agent activity log | User |
| `/api/dev/agents/:name/capabilities` | GET | Get agent permissions | User |
| `/api/dev/tickets` | GET | Get pending tickets | User |
| `/api/dev/errors` | GET | Get open system errors | User |
| `/api/dev/agents/:name/trigger` | POST | Manually trigger agent | **Admin** |
| `/api/dev/agents/:name/config` | PUT | Update agent config | **Admin** |
| `/api/dev/scheduler/start` | POST | Start scheduler | **Admin** |
| `/api/dev/scheduler/stop` | POST | Stop scheduler | **Admin** |

---

## Admin Dashboard

**Location:** `/agent-dashboard.html`

**Features:**
- Real-time agent status
- Active jobs count
- Recent activity log
- Create feature request tickets
- View agent capabilities
- Start/stop scheduler
- Manual agent triggering (admin only)

**Access:**
- Navigate to: `https://homeprohub.today/agent-dashboard.html`
- Requires authentication (TODO: add auth check)

---

## Database Schema

### Required Tables

The following tables must exist in Supabase:

1. **`feature_requests`** - Tickets for The Builder
2. **`system_errors`** - Errors for The Mechanic
3. **`agent_activity_log`** - Immutable log of all agent actions
4. **`agent_config`** - Agent configuration (enabled/disabled, rate limits)
5. **`codebase_embeddings`** - Knowledge base (RAG) for context

### Schema Location

See: `database/schema.sql` (existing tables)

Additional agent tables need to be created (migration required).

---

## SOC 2 Compliance

### Change Logs ✅

Every agent action logged to `agent_activity_log`:
- Agent name
- Action type
- Description
- Status (started/completed/failed)
- Timestamps
- Input/output data
- Related error/request IDs

Logs are **immutable** (no UPDATE or DELETE allowed).

### Approval Records ✅

All PRs tracked:
- Who requested (agent)
- When requested
- What changed (files, lines)
- Approval status
- Who approved
- When merged

### Agent Activity Logs ✅

Real-time visibility:
- API endpoint: `/api/dev/agents/:name/activity`
- Admin dashboard
- Queryable by date, status, agent

### Rollback Evidence ✅

Every PR includes:
- Rollback plan
- Commit hash
- Affected files
- How to revert

---

## Deployment Instructions

### Step 1: Database Setup

Create agent tables (run in Supabase SQL Editor):

```sql
-- See: database/agent-tables.sql (TODO: create this migration)
-- Tables: feature_requests, system_errors, agent_activity_log, agent_config, codebase_embeddings
```

### Step 2: Environment Variables

Add to `.env` or Render environment variables:

```bash
# AI Provider (required for agents)
ANTHROPIC_API_KEY=sk-ant-...

# Agent Models (optional, defaults to sonnet)
ANTHROPIC_MECHANIC_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_BUILDER_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_IMPROVER_MODEL=claude-3-5-sonnet-20241022

# Admin email for notifications
ADMIN_EMAIL=admin@homeprohub.today
```

### Step 3: Integrate API Routes

Add to `server.js`:

```javascript
// Agent management routes
const agentRoutes = require('./routes/agents');
app.use('/api/dev', agentRoutes);
```

### Step 4: Enable Agents

Set agent config in database or via API:

```sql
INSERT INTO agent_config (agent_name, is_enabled) VALUES
('mechanic', true),
('builder', true),
('improver', true);
```

### Step 5: Start Scheduler (Optional)

Via API:
```bash
curl -X POST http://localhost:3000/api/dev/scheduler/start
```

Or programmatically in `server.js`:
```javascript
const scheduler = require('./agents/scheduler');
scheduler.start();
```

---

## Testing the System

### 1. Create a Test Ticket

```bash
curl -X POST http://localhost:3000/api/dev/ticket \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Feature Request",
    "description": "This is a test ticket to verify the Builder agent",
    "priority": "low"
  }'
```

### 2. Manually Trigger The Builder

```bash
curl -X POST http://localhost:3000/api/dev/agents/builder/trigger \
  -H "Content-Type: application/json" \
  -d '{ "request_id": "uuid-from-step-1" }'
```

### 3. Check Activity Log

```bash
curl http://localhost:3000/api/dev/agents/builder/activity
```

### 4. View in Dashboard

Navigate to: `http://localhost:3000/agent-dashboard.html`

---

## Monitoring & Observability

### Metrics to Track

1. **Agent execution success rate**
   - Query: `SELECT status, COUNT(*) FROM agent_activity_log GROUP BY status`
2. **PRs created vs merged**
   - Track PR creation in activity log
   - Track merge events
3. **Rate limit hits**
   - Log when agents are blocked by rate limits
4. **Policy violations**
   - Track denied actions
5. **Test Pilot failure rate**
   - How often do agent changes fail validation?

### Alerting

Set up alerts for:
- Agent execution failures (consecutive failures >3)
- Rate limit exceeded (agent may be looping)
- Policy violations (unexpected access attempts)
- Test Pilot failure rate >50%

---

## Safety Checklist

Before enabling agents in production:

- [ ] All agent tables exist in database
- [ ] Policy engine configured and tested
- [ ] Test Pilot stages implemented
- [ ] Rate limits configured
- [ ] Admin authentication added to API
- [ ] Notification system tested
- [ ] Rollback procedure documented
- [ ] SOC 2 logging verified
- [ ] Knowledge base populated (optional)
- [ ] Scheduler tested (optional)

---

## Future Enhancements

### Phase 3 (Planned)
- [ ] GitHub API integration for real PR creation
- [ ] Knowledge base (RAG) implementation
- [ ] Sandbox environment for safe code execution
- [ ] Real-time metrics collection
- [ ] Performance benchmarking
- [ ] Lighthouse accessibility checks

### Phase 4 (Planned)
- [ ] Multi-repo support
- [ ] Agent collaboration (Mechanic → Builder handoff)
- [ ] Auto-merge for low-risk changes (with extensive testing)
- [ ] Cost tracking and budgets
- [ ] Agent performance analytics
- [ ] Canary deployments integration

---

## Troubleshooting

### Agent not running

1. Check agent config: `SELECT * FROM agent_config WHERE agent_name = 'mechanic'`
2. Check rate limits: `SELECT * FROM agent_activity_log WHERE agent_name = 'mechanic' ORDER BY started_at DESC LIMIT 10`
3. Check orchestrator logs: `npm run pm2:logs | grep Orchestrator`

### PRs not created

1. Check agent activity log for errors
2. Verify Test Pilot passed
3. Check policy engine for violations
4. Confirm GitHub API credentials (if integrated)

### Rate limit hit

1. Check agent config: `max_runs_per_window`, `rate_limit_window_hours`
2. Increase limits if legitimate: `UPDATE agent_config SET max_runs_per_window = 20 WHERE agent_name = 'mechanic'`
3. Investigate why agent is running so frequently

---

## Support & Contact

For issues or questions:
- Check logs: `npm run pm2:logs`
- Review agent activity: `/api/dev/agents/{name}/activity`
- Check this documentation
- Review `DEPLOYMENT_FAILURE_REPORT.md` for safety architecture details

---

## License

Internal use only. Not for redistribution.

**End of Documentation**
