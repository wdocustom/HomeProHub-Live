# Autonomous Development Trinity

## Architecture Overview

The HomeProHub platform now includes a sophisticated **Autonomous Development Trinity** - three AI agents that work together to maintain, expand, and optimize the codebase with minimal human oversight.

```
┌─────────────────────────────────────────────────────────────┐
│              THE AUTONOMOUS DEVELOPMENT TRINITY             │
└─────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
    ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
    │  MECHANIC   │   │   BUILDER   │   │  IMPROVER   │
    │  (Reactive  │   │  (Reactive  │   │ (Proactive  │
    │   Defense)  │   │   Offense)  │   │   Offense)  │
    └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
           │                  │                  │
           └──────────────────┼──────────────────┘
                              │
           ┌──────────────────▼──────────────────┐
           │         THE SAFETY CORE             │
           │  ┌────────────┬──────────────────┐  │
           │  │  Sandbox   │  Knowledge Base  │  │
           │  │            │     (RAG)        │  │
           │  └────────────┴──────────────────┘  │
           │  ┌────────────────────────────────┐ │
           │  │       Test Pilot               │ │
           │  └────────────────────────────────┘ │
           └─────────────────────────────────────┘
```

---

## 🛡️ The Safety Core

### 1. The Sandbox (`services/SandboxService.js`)
- **Isolated environment** in `.mechanic_sandbox/` directory
- AI code is **written and tested here first**
- **No AI touches production directly**
- Automatic import path rewriting
- Session management with unique IDs
- Automatic rollback on failure

### 2. The Knowledge Base (`services/KnowledgeBase.js`)
- **Vector database** using pgvector extension
- **RAG (Retrieval-Augmented Generation)** for code understanding
- Semantic code search with OpenAI embeddings
- Agents query this before making changes
- Tracks dependencies and file relationships

### 3. The Test Pilot (`services/TestPilotService.js`)
- **Automated verification** service
- Tests code in sandbox before promotion
- Three testing modes:
  - **Code Testing**: Child process execution with TEST_MODE
  - **Browser Testing**: Headless Puppeteer tests
  - **API Testing**: Endpoint verification
- Detects console errors, failed requests, and crashes

---

## 🤖 The Three Agents

### Agent A: The Mechanic 2.0 (Reactive Defense)

**Trigger**: System errors and crashes

**Workflow**:
1. **Detects Error** → Monitors `system_errors` table
2. **Applies Band-aid** → If high traffic, applies temporary fix
3. **Diagnoses Root Cause** → Uses GPT-4o to analyze stack trace
4. **Writes Fix in Sandbox** → Creates patched code
5. **Tests** → TestPilot verifies the fix
6. **Deploys** → If tests pass, promotes to production
7. **Logs** → Records all activity

**Status**: Infrastructure Ready (Agent implementation in progress)

### Agent B: The Builder (Reactive Offense)

**Trigger**: New tickets in `feature_requests` table

**Workflow**:
1. **Reads Ticket** → Gets pending feature request
2. **Queries Knowledge Base** → Understands existing code
3. **Plans Code** → Creates implementation plan
4. **Writes Feature in Sandbox** → Develops the feature
5. **Tests** → TestPilot verifies functionality
6. **Deploys** → If tests pass, promotes to production
7. **Updates Ticket** → Marks as completed

**Status**: Infrastructure Ready (Agent implementation in progress)

### Agent C: The Improver (Proactive Offense)

**Trigger**: Nightly schedule (cron job)

**Workflow**:
1. **Reads PRODUCT_VISION.md** → Understands quality standards
2. **Scans Random Files** → Selects 3-5 files to analyze
3. **Identifies Misalignments** → Finds violations of standards
4. **Creates Tickets** → Adds to `feature_requests` for The Builder

**Example Tickets Created**:
- "Font size 12px in dashboard.css violates mobile-first (min 16px)"
- "Missing error handling in submitBid() function"
- "Page loads in 4.2s - exceeds performance target"

**Status**: Infrastructure Ready (Agent implementation in progress)

---

## 📊 Database Schema

### Tables Created

1. **`codebase_embeddings`**
   - Stores vector embeddings (1536 dimensions)
   - Enables semantic code search
   - Tracks file changes via hash

2. **`feature_requests`**
   - Work queue for The Builder
   - Priority-based ticket system
   - Tracks implementation status

3. **`system_errors`**
   - Error logs for The Mechanic
   - Deduplication and frequency tracking
   - Resolution status tracking

4. **`agent_activity_log`**
   - Comprehensive audit trail
   - All agent actions logged
   - Cost and performance tracking

5. **`agent_config`**
   - Runtime configuration
   - Safety rails and rate limits
   - Enable/disable agents

### SQL Migration

Run the schema migration:

```sql
-- In Supabase SQL Editor
\i database/migrations/autonomous-agents-schema.sql
```

Or manually execute: `database/migrations/autonomous-agents-schema.sql`

---

## 🚀 Setup Instructions

### 1. Prerequisites

```bash
# Install required packages
npm install openai puppeteer chokidar

# Set environment variable
export OPENAI_API_KEY=your_key_here
```

### 2. Database Setup

```sql
-- Run in Supabase SQL Editor
\i database/migrations/autonomous-agents-schema.sql
```

This creates:
- pgvector extension
- All tables with indexes
- Helper functions
- Default agent configurations

### 3. Index the Codebase

```bash
# Full codebase index
node services/CodeIndexer.js --full

# Test the index
node services/CodeIndexer.js --full --test

# Watch mode (auto-reindex on changes)
node services/CodeIndexer.js --watch
```

Expected output:
```
📊 Statistics:
   Files Indexed:  157
   Chunks Created: 423
   Duration:       45.2s
```

### 4. Test the Knowledge Base

```javascript
const knowledgeBase = require('./services/KnowledgeBase');

// Query for context
const results = await knowledgeBase.queryContext(
    'How does user authentication work?'
);

console.log(results);
// Returns relevant code chunks with file paths and relevance scores
```

---

## 🛠️ Usage Examples

### Creating a Feature Request (For The Builder)

```javascript
const db = require('./database/db');

const ticket = await db.createFeatureRequest({
    title: 'Add dark mode toggle to settings',
    description: 'Users should be able to switch between light and dark themes',
    priority: 'medium',
    request_type: 'feature',
    target_directory: 'public',
    created_by: 'user@example.com'
});

// The Builder will pick this up automatically
```

### Logging a System Error (For The Mechanic)

```javascript
const db = require('./database/db');

const errorId = await db.logSystemError({
    error_type: 'uncaught_exception',
    error_message: 'Cannot read property "title" of null',
    source_file: 'services/JobService.js',
    stack_trace: error.stack,
    severity: 'high'
});

// The Mechanic will analyze and fix this
```

### Testing with TestPilot

```javascript
const TestPilotService = require('./services/TestPilotService');

const pilot = new TestPilotService();

// Test a page
const pageResult = await pilot.testPage('/dashboard.html', {
    waitForSelector: '#user-profile',
    checkConsole: true
});

// Test an API
const apiResult = await pilot.testAPI('/api/jobs', {
    method: 'GET',
    expectedStatus: 200,
    expectedFields: ['jobs', 'total']
});

console.log(pageResult.success); // true/false
```

---

## 🔒 Safety Rails & Controls

### Rate Limiting

Agents are configured with deployment limits:

```sql
-- Check current limits
SELECT * FROM agent_config;

-- Update limits
UPDATE agent_config
SET max_deployments_per_hour = 5
WHERE agent_name = 'builder';
```

### File Restrictions

Agents can **ONLY** write to:
- `/public`
- `/services`
- `/routes`

Agents **CANNOT** write to:
- `.env`
- `/config`
- `node_modules`
- `/database/migrations`

### Approval Gates

```sql
-- Require approval for Builder
UPDATE agent_config
SET require_approval = true
WHERE agent_name = 'builder';

-- Now Builder will pause before deploying
-- Manual approval via API: POST /api/dev/approve/{sessionId}
```

### Emergency Stop

```sql
-- Disable all agents
UPDATE agent_config SET enabled = false;

-- Disable specific agent
UPDATE agent_config SET enabled = false WHERE agent_name = 'mechanic';
```

---

## 📁 File Structure

```
HomeProHub-Live/
├── database/
│   ├── db.js (updated with agent functions)
│   ├── db-wrapper.js (TEST_MODE safety wrapper)
│   └── migrations/
│       └── autonomous-agents-schema.sql
│
├── services/
│   ├── SandboxService.js (Isolation environment)
│   ├── TestFlightRunner.js (Child process testing)
│   ├── TestPilotService.js (Enhanced testing w/ browser)
│   ├── KnowledgeBase.js (RAG & semantic search)
│   ├── CodeIndexer.js (Codebase indexing CLI)
│   ├── MechanicAgent.js (To be implemented)
│   ├── BuilderAgent.js (To be implemented)
│   └── ImproverAgent.js (To be implemented)
│
├── .mechanic_sandbox/ (Created automatically, gitignored)
│
├── PRODUCT_VISION.md (Quality standards for Improver)
└── AUTONOMOUS_AGENTS_README.md (This file)
```

---

## 🧪 Testing

### Test the Sandbox System

```bash
node services/test-sandbox-simple.js
```

Expected: All tests pass ✓

### Test the Knowledge Base

```bash
node services/CodeIndexer.js --full --test
```

Expected: Returns relevant code for test queries ✓

### Test the Test Pilot

```javascript
const TestPilotService = require('./services/TestPilotService');
const pilot = new TestPilotService({ baseUrl: 'http://localhost:3000' });

// Test a page
const result = await pilot.testPage('/index.html');
console.log(result.success); // true if page loads without errors
```

---

## 📊 Monitoring & Logs

### View Agent Activity

```sql
-- Recent agent actions
SELECT
    agent_name,
    action_type,
    description,
    status,
    started_at
FROM agent_activity_log
ORDER BY started_at DESC
LIMIT 20;
```

### Check Pending Work

```sql
-- Feature requests waiting for Builder
SELECT title, priority, created_at
FROM feature_requests
WHERE status = 'pending'
ORDER BY priority DESC;

-- Open errors for Mechanic
SELECT error_message, severity, occurrence_count
FROM system_errors
WHERE status = 'open'
ORDER BY severity DESC, occurrence_count DESC;
```

---

## 🎯 Next Steps (Implementation Phases)

### Phase 1: Foundation ✅ COMPLETE
- [x] Database schemas
- [x] Sandbox service
- [x] Test Pilot service
- [x] Knowledge Base with RAG
- [x] Code indexer
- [x] Safety rails

### Phase 2: Agent Implementation (In Progress)
- [ ] MechanicAgent.js - Error detection and fixing
- [ ] BuilderAgent.js - Feature development
- [ ] ImproverAgent.js - Proactive quality analysis

### Phase 3: Orchestration
- [ ] Agent scheduler (cron jobs)
- [ ] Agent coordinator service
- [ ] Conflict resolution logic

### Phase 4: API & UI
- [ ] API endpoints for agent control
- [ ] Admin dashboard for monitoring
- [ ] Manual ticket creation UI

### Phase 5: Production Hardening
- [ ] Comprehensive testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Documentation completion

---

## 🤝 Contributing

When adding to the agent system:

1. **Always use the Safety Core** - No direct production access
2. **Log all activities** to `agent_activity_log`
3. **Check rate limits** before deploying
4. **Respect file restrictions** - Only allowed directories
5. **Test in sandbox first** - Use TestPilot before promotion

---

## 📞 Support & Questions

- Infrastructure Issues: Check `agent_activity_log` for errors
- Performance: Monitor embedding generation costs
- Safety: Review `agent_config` settings
- Documentation: This file + inline code comments

---

**The Autonomous Development Trinity is designed to scale with the platform,
learning and improving continuously while maintaining the highest safety standards.**

Last Updated: 2026-01-19
