# URGENT FIX: Add action_url Column to Notifications Table

## Error Being Fixed
```
Could not find the 'action_url' column of 'notifications' in the schema cache
```

## Problem
The backend code is trying to insert notifications with an `action_url` field, but this column doesn't exist in the Supabase database yet.

## Solution
Run the migration file `add_action_url_to_notifications.sql` in Supabase.

## Steps to Apply Migration

### Option 1: Supabase Dashboard (Recommended for Quick Fix)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `add_action_url_to_notifications.sql`
5. Click **Run** or press `Ctrl+Enter`
6. Verify success - you should see:
   ```
   column_name | data_type | is_nullable
   -----------+-----------+-------------
   action_url  | text      | YES
   ```

### Option 2: Using Supabase CLI

```bash
cd /home/user/HomeProHub-Live
supabase db push
```

### Option 3: Direct psql Connection

```bash
psql <your-supabase-connection-string> -f database/migrations/add_action_url_to_notifications.sql
```

## Verification

After running the migration, test by:
1. Submitting a project on the frontend
2. Check that no error occurs
3. Query notifications table:
   ```sql
   SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5;
   ```
4. Verify `action_url` column exists and contains values like `/homeowner-dashboard.html`

## Migration File Location
`/home/user/HomeProHub-Live/database/migrations/add_action_url_to_notifications.sql`

## What This Migration Does
- Adds `action_url TEXT` column to notifications table (if not exists)
- Creates index on action_url for faster queries
- Verifies column was added successfully

## Safe to Run
- Uses `ADD COLUMN IF NOT EXISTS` - safe to run multiple times
- Won't drop or modify existing data
- Won't fail if column already exists
