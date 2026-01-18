# Database Migration Guide - Fix Deployment Errors

## Current Status

**Latest Deployment Errors:**
1. ✅ **FIXED** - `db.query is not a function` (fixed in server.js)
2. ⚠️ **NEEDS MIGRATION** - Missing `updated_at` column in `project_states`
3. ⚠️ **NEEDS MIGRATION** - Missing `metadata` column in `notifications`

---

## Quick Fix: Run This Migration

### Step 1: Open Supabase SQL Editor

1. Go to: https://supabase.com/dashboard
2. Select your **HomeProHub-Live** project
3. Click **SQL Editor** in the left sidebar
4. Click **New query**

### Step 2: Run the Migration

Copy and paste the contents of this file:

```
/home/user/HomeProHub-Live/database/migrations/fix_missing_columns.sql
```

**OR** Copy the SQL below:

```sql
-- ========================================
-- Migration: Fix Missing Columns
-- Date: 2026-01-18
-- Purpose: Add missing columns to project_states and notifications tables
-- ========================================

DO $$
BEGIN
  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_states' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE project_states
    ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

    RAISE NOTICE 'Added updated_at column to project_states';
  ELSE
    RAISE NOTICE 'Column updated_at already exists in project_states';
  END IF;

  -- Add estimated_completion_date if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_states' AND column_name = 'estimated_completion_date'
  ) THEN
    ALTER TABLE project_states
    ADD COLUMN estimated_completion_date DATE;

    RAISE NOTICE 'Added estimated_completion_date column to project_states';
  END IF;

  -- Add actual_start_date if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_states' AND column_name = 'actual_start_date'
  ) THEN
    ALTER TABLE project_states
    ADD COLUMN actual_start_date DATE;

    RAISE NOTICE 'Added actual_start_date column to project_states';
  END IF;

  -- Add last_activity_date if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_states' AND column_name = 'last_activity_date'
  ) THEN
    ALTER TABLE project_states
    ADD COLUMN last_activity_date TIMESTAMP WITH TIME ZONE;

    RAISE NOTICE 'Added last_activity_date column to project_states';
  END IF;
END $$;

-- Add metadata to notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE notifications
    ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;

    RAISE NOTICE 'Added metadata column to notifications';
  END IF;

  -- Add read column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'read'
  ) THEN
    ALTER TABLE notifications
    ADD COLUMN read BOOLEAN DEFAULT false;

    RAISE NOTICE 'Added read column to notifications';
  END IF;

  -- Add read_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'read_at'
  ) THEN
    ALTER TABLE notifications
    ADD COLUMN read_at TIMESTAMP WITH TIME ZONE;

    RAISE NOTICE 'Added read_at column to notifications';
  END IF;
END $$;

-- Ensure trigger exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_project_states_updated_at ON project_states;
CREATE TRIGGER update_project_states_updated_at
  BEFORE UPDATE ON project_states
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Verification
SELECT '✅ Missing columns migration completed successfully!' as status;
```

### Step 3: Click "Run" Button

You should see output like:
```
✅ Missing columns migration completed successfully!
```

---

## What This Migration Does

### 1. Adds Missing Columns to `project_states`
- `updated_at` - Timestamp for last update (auto-updated via trigger)
- `estimated_completion_date` - Projected completion date
- `actual_start_date` - When construction actually started
- `last_activity_date` - Last contractor activity timestamp

### 2. Adds Missing Columns to `notifications`
- `metadata` - JSONB field for storing additional notification data
- `read` - Boolean flag to track if notification has been read
- `read_at` - Timestamp of when notification was read

### 3. Creates Auto-Update Trigger
- Automatically updates `updated_at` whenever a row is modified
- Uses PostgreSQL trigger function

---

## Verification Steps

After running the migration, verify the columns exist:

```sql
-- Check project_states columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'project_states'
ORDER BY column_name;

-- Check notifications columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY column_name;
```

---

## What Gets Fixed

### Before Migration:
- ❌ `Could not find the 'updated_at' column of 'project_states'`
- ❌ `Could not find the 'metadata' column of 'notifications'`
- ❌ `Could not find the 'read' column of 'notifications'`
- ❌ `Could not find the table 'public.bids'` (should be contractor_bids)
- ❌ `new row violates check constraint "project_states_current_phase_check"`
- ❌ Contractor update logging fails (500 error)
- ❌ AI summary notifications fail to save

### After Migration:
- ✅ All database columns exist
- ✅ Contractor update logging works
- ✅ AI summary notifications save successfully
- ✅ Automatic timestamp updates on project state changes

---

## Code That Depends on These Columns

### server.js - Line ~7500 (log-contractor-update endpoint)
```javascript
// This code needs updated_at column
const { error: updateError } = await supabase
  .from('project_states')
  .update({
    last_activity_date: new Date(),
    updated_at: new Date()  // ← Needs this column
  })
  .eq('project_id', projectId);
```

### server.js - Line ~7550 (generate-daily-summary endpoint)
```javascript
// This code needs metadata column
const { error: notifError } = await supabase
  .from('notifications')
  .insert({
    user_email: project.homeowner_email,
    type: 'ai_summary',
    title: 'Daily Project Summary',
    message: summary,
    metadata: { project_id: projectId }  // ← Needs this column
  });
```

---

## Troubleshooting

### Error: "relation does not exist"
**Solution:** Run the main AI Agent System migration first:
```bash
/home/user/HomeProHub-Live/database/migrations/add_ai_agent_system_tables.sql
```

### Error: "column already exists"
**Solution:** This is fine! The migration checks for existing columns and skips them.

### Error: "permission denied"
**Solution:** Make sure you're logged into Supabase with admin access.

---

## Next Steps After Migration

1. ✅ **Wait for Render auto-deploy** (~2-3 minutes)
2. ✅ **Test contractor-tools.html** - All features should work now
3. ✅ **Check Render logs** - Should see no more column errors
4. ✅ **Test AI summary** - Should generate and save successfully
5. ✅ **Test contractor updates** - Should log without errors

---

## Migration History

| Date | Migration | Status |
|------|-----------|--------|
| 2026-01-15 | `add_ai_agent_system_tables.sql` | ✅ Completed |
| 2026-01-18 | `fix_missing_columns.sql` | ⏳ **Run this now** |

---

## Summary

**This migration is SAFE to run multiple times.** It uses conditional logic to check if columns exist before adding them.

**Time to complete:** ~5 seconds

**Downtime:** None - ALTER TABLE is non-blocking for new columns

**Risk level:** ✅ **LOW** - Only adds columns, doesn't modify existing data

---

Let me know once you've run this migration and I'll help verify everything is working!
