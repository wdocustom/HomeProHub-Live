# Proposed Changes for Deployment Safety

This document outlines recommended code changes that require **human approval** before implementation.

## 1. Disable Auto-Migrations on Startup

**File:** `server.js:8987-8989`

**Current Code:**
```javascript
app.listen(PORT, async () => {
  console.log('=====');
  console.log(`🚀 HomeProHub Server`);
  console.log(`📍 Running at: http://localhost:${PORT}`);
  console.log(`🔑 Anthropic API: ${ANTHROPIC_API_KEY ? '✓ Configured' : '❌ Missing'}`);
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  console.log('=====');

  // Run database auto-migrations
  await runAutoMigrations();
});
```

**Proposed Code:**
```javascript
app.listen(PORT, async () => {
  console.log('=====');
  console.log(`🚀 HomeProHub Server`);
  console.log(`📍 Running at: http://localhost:${PORT}`);
  console.log(`🔑 Anthropic API: ${ANTHROPIC_API_KEY ? '✓ Configured' : '❌ Missing'}`);
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  console.log('=====');

  // SAFETY: Auto-migrations disabled in production
  // Run migrations manually with: node scripts/run-migrations.js
  // This prevents unreviewed schema changes on every deploy
  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_AUTO_MIGRATIONS === 'true') {
    console.log('⚠️  Auto-migrations enabled (development only)');
    await runAutoMigrations();
  } else {
    console.log('✅ Auto-migrations disabled (production safety)');
    console.log('   Run migrations manually if needed: node scripts/run-migrations.js');
  }
});
```

**Rationale:**
- Prevents agents from applying migrations
- Requires explicit human action to run migrations
- Reduces deployment risk
- Aligns with "agents may NOT apply migrations" principle

---

## 2. Add Health Check Endpoint

**File:** `server.js` (after line 8974, before app.listen)

**Proposed Code:**
```javascript
// ====== HEALTH CHECK ENDPOINT ======

/**
 * Health check endpoint for monitoring and load balancers
 * Returns 200 OK if server is running and can connect to database
 */
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  };

  // Basic database connectivity check
  try {
    const { data, error } = await db.supabase
      .from('user_profiles')
      .select('email')
      .limit(1);

    if (error) {
      health.database = 'error';
      health.database_error = error.message;
      return res.status(503).json(health);
    }

    health.database = 'connected';
  } catch (err) {
    health.database = 'error';
    health.database_error = err.message;
    return res.status(503).json(health);
  }

  res.status(200).json(health);
});

/**
 * Detailed health check with component status
 * Use this for debugging, not for load balancer checks
 */
app.get('/health/detailed', async (req, res) => {
  const detailed = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    memory: process.memoryUsage(),
    components: {}
  };

  // Check Supabase connection
  try {
    const { error } = await db.supabase.from('user_profiles').select('email').limit(1);
    detailed.components.database = error ? 'error' : 'ok';
  } catch (err) {
    detailed.components.database = 'error';
  }

  // Check AI providers
  detailed.components.anthropic = ANTHROPIC_API_KEY ? 'configured' : 'missing';
  detailed.components.openai = process.env.OPENAI_API_KEY ? 'configured' : 'missing';

  // Check external services
  detailed.components.brevo = process.env.BREVO_API_KEY ? 'configured' : 'missing';
  detailed.components.stripe = process.env.STRIPE_SECRET_KEY ? 'configured' : 'missing';

  const allOk = detailed.components.database === 'ok';
  res.status(allOk ? 200 : 503).json(detailed);
});
```

**Rationale:**
- Enables automated deployment health checks
- Allows load balancers to detect failures
- Provides debugging information via /health/detailed
- Critical for rollback triggers

---

## 3. Add Environment Validation on Startup

**File:** `server.js:32-44`

**Current Code:**
```javascript
if (!ANTHROPIC_API_KEY && !OPENAI_API_KEY) {
  console.error("❌ CRITICAL: No AI API keys configured.");
  console.error("   Please add ANTHROPIC_API_KEY or OPENAI_API_KEY to your .env file.");
} else if (!ANTHROPIC_API_KEY) {
  console.warn("⚠️  WARNING: ANTHROPIC_API_KEY not set. Using OpenAI as primary provider.");
} else if (!OPENAI_API_KEY) {
  console.warn("⚠️  WARNING: OPENAI_API_KEY not set. No fallback provider available.");
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("⚠️  WARNING: Supabase credentials not configured. Authentication will not work.");
  console.warn("   Add SUPABASE_URL and SUPABASE_ANON_KEY to your environment variables.");
}
```

**Proposed Code:**
```javascript
// ====== CRITICAL ENVIRONMENT VALIDATION ======
// In production, missing critical vars should BLOCK startup

const CRITICAL_VARS = {
  'SUPABASE_URL': SUPABASE_URL,
  'SUPABASE_ANON_KEY': SUPABASE_ANON_KEY,
  'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY
};

const RECOMMENDED_VARS = {
  'ANTHROPIC_API_KEY': ANTHROPIC_API_KEY,
  'OPENAI_API_KEY': OPENAI_API_KEY
};

// Check critical vars (block startup in production)
const missingCritical = Object.entries(CRITICAL_VARS)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingCritical.length > 0) {
  console.error("❌ CRITICAL: Missing required environment variables:");
  missingCritical.forEach(key => console.error(`   - ${key}`));

  if (process.env.NODE_ENV === 'production') {
    console.error("\n🛑 STARTUP BLOCKED in production mode.");
    console.error("   Set required variables and restart.\n");
    process.exit(1);
  } else {
    console.warn("\n⚠️  Continuing in development mode, but functionality will be limited.\n");
  }
}

// Check recommended vars (warnings only)
if (!ANTHROPIC_API_KEY && !OPENAI_API_KEY) {
  console.error("❌ WARNING: No AI API keys configured.");
  console.error("   Please add ANTHROPIC_API_KEY or OPENAI_API_KEY to your .env file.");
} else if (!ANTHROPIC_API_KEY) {
  console.warn("⚠️  WARNING: ANTHROPIC_API_KEY not set. Using OpenAI as primary provider.");
} else if (!OPENAI_API_KEY) {
  console.warn("⚠️  WARNING: OPENAI_API_KEY not set. No fallback provider available.");
}
```

**Rationale:**
- Fails fast in production if critical vars missing
- Prevents silent failures
- Clear error messages for operators
- Allows development flexibility

---

## 4. Create Manual Migration Script

**New File:** `scripts/run-migrations.js`

**Proposed Code:**
```javascript
#!/usr/bin/env node
/**
 * Manual Migration Runner
 *
 * Runs database migrations with human approval
 * This replaces automatic migrations on server startup
 *
 * Usage:
 *   node scripts/run-migrations.js
 *   node scripts/run-migrations.js --dry-run
 */

require('dotenv').config();
const { runAutoMigrations } = require('../database/auto-migrations');
const readline = require('readline');

const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║        HomeProHub Manual Migration Runner             ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
    console.log('');
  }

  console.log('⚠️  WARNING: Migrations will attempt to modify your database schema.');
  console.log('');
  console.log('Migrations to run:');
  console.log('  1. Add profile_photo_url column (if missing)');
  console.log('  2. Add project template columns (if missing)');
  console.log('');
  console.log('Prerequisites:');
  console.log('  - Database backup completed');
  console.log('  - Rollback script ready');
  console.log('  - Approval from authorized personnel');
  console.log('');

  if (isDryRun) {
    console.log('🔍 Dry run - skipping approval');
    await runMigrations();
    return;
  }

  // Prompt for approval
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Type "APPLY" to run migrations, or anything else to cancel: ', async (answer) => {
    rl.close();

    if (answer.trim().toUpperCase() === 'APPLY') {
      await runMigrations();
    } else {
      console.log('❌ Cancelled - no changes made');
      process.exit(0);
    }
  });
}

async function runMigrations() {
  console.log('');
  console.log('🔧 Running migrations...');
  console.log('');

  try {
    const results = await runAutoMigrations();

    console.log('');
    console.log('═══════════════════════════════════════════════════════');

    if (Object.values(results).every(r => r === true)) {
      console.log('✅ All migrations completed successfully');
      process.exit(0);
    } else {
      console.log('⚠️  Some migrations require manual SQL execution');
      console.log('   Check the output above for instructions');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
```

**Rationale:**
- Requires explicit human action to run migrations
- Includes approval prompt
- Dry-run capability for testing
- Clear documentation of what will change
- Aligns with "agents may NOT apply migrations"

---

## 5. Update package.json Scripts

**File:** `package.json`

**Add these scripts:**
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "NODE_ENV=development node server.js",
    "prod": "NODE_ENV=production node server.js",
    "pm2:start": "pm2 start ecosystem.config.js",
    "pm2:stop": "pm2 stop homeprohub",
    "pm2:restart": "pm2 restart homeprohub",
    "pm2:logs": "pm2 logs homeprohub",
    "worker": "node services/notification-worker.js",
    "test": "echo \"Error: no test specified\" && exit 1",

    "validate:env": "node scripts/validate-env.js",
    "validate:pre-deploy": "bash scripts/pre-deploy.sh",
    "migrate": "node scripts/run-migrations.js",
    "migrate:dry-run": "node scripts/run-migrations.js --dry-run"
  }
}
```

**Rationale:**
- Provides clear commands for operators
- Separates validation from deployment
- Makes migration process explicit
- Follows best practices

---

## Approval Checklist

Before implementing these changes:

- [ ] Human review of all proposed changes
- [ ] Approval from technical lead
- [ ] Backup of production database created
- [ ] Rollback procedure tested
- [ ] Deployment window scheduled
- [ ] Stakeholders notified

**Remember:** These are proposals. No code changes have been applied.

---

**Change Risk Level:** MEDIUM
**Files Affected:** 2 existing, 3 new
**Rollback Complexity:** LOW (git revert)
**Test Coverage Required:** Health endpoint tests, migration tests

---
