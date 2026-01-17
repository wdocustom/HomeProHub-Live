# Database Migration Guide

## Critical Fixes Applied

This document outlines the permanent fixes for critical database issues.

### Fix 1: Templates API Error

**Error:** `db.query is not a function`

**Root Cause:** The `/api/templates` endpoint was using `db.query()` which doesn't exist in the Supabase client module.

**Permanent Fix:** Rewrote the endpoint to use the Supabase client query builder instead of raw SQL.

**File Changed:** `server.js` line ~7647

**Status:** ✅ Fixed automatically in code

---

### Fix 2: Profile Photo URL Missing

**Error:** `column "profile_photo_url" does not exist`

**Root Cause:** The `calculate_contractor_grade` PostgreSQL function references `profile_photo_url` column in the `user_profiles` table, but this column was never added to the database.

**Permanent Fix:** Add the missing column to the `user_profiles` table.

**Migration Required:** Yes (must be applied in Supabase)

#### How to Apply the Migration

**Option 1: Automatic (Recommended)**

The server now includes an auto-migration checker that will detect missing columns on startup and provide instructions.

1. Restart your server
2. Check the console logs for migration instructions
3. If migration is needed, follow the printed SQL instructions

**Option 2: Manual (Immediate Fix)**

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the contents of `database/migrations/APPLY_FIRST_add_profile_photo_url.sql`
5. Click **Run** (or press Cmd/Ctrl + Enter)
6. Verify success message: "✅ Migration successful: profile_photo_url column added"

**Option 3: Using Migration Script**

```bash
node migrate-add-profile-photo.js
```

This will provide you with the SQL to run manually.

---

## Verification

After applying fixes:

1. **Templates API:**
   ```bash
   curl http://localhost:3000/api/templates
   ```
   Should return templates list without errors

2. **Contractor Grade:**
   ```bash
   curl http://localhost:3000/api/contractor/my-grade \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```
   Should return grade data without "profile_photo_url" error

---

## Files Modified

### Code Changes (Automatic)
- ✅ `server.js` - Fixed templates endpoint
- ✅ `database/schema.sql` - Updated schema documentation
- ✅ `database/auto-migrations.js` - Created auto-migration checker
- ✅ `server.js` - Integrated auto-migrations on startup

### Migration Files (Manual Application)
- 📄 `database/migrations/APPLY_FIRST_add_profile_photo_url.sql` - SQL migration
- 📄 `database/migrations/add_profile_photo_url.sql` - Original migration file
- 📄 `migrate-add-profile-photo.js` - Node.js migration script

---

## Production Deployment

When deploying to production (Render):

1. **Before Deployment:**
   - Apply the `APPLY_FIRST_add_profile_photo_url.sql` migration in your production Supabase database

2. **After Deployment:**
   - The server will automatically check for the column on startup
   - Monitor logs for any migration warnings
   - Test both endpoints (`/api/templates` and `/api/contractor/my-grade`)

---

## Rollback (if needed)

If you need to rollback the profile_photo_url column:

```sql
ALTER TABLE user_profiles DROP COLUMN IF EXISTS profile_photo_url;
```

**Note:** This will cause the contractor grade calculation to fail again.

---

## Support

If you encounter issues:

1. Check server logs for detailed error messages
2. Verify Supabase connection is active
3. Ensure you have admin access to run SQL migrations
4. Review the auto-migration logs on server startup
