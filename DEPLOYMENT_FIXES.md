# Deployment Fixes - Command Center Issues

## Issues Fixed

### 1. Authentication Failure in Command Center ✅
**Problem:** Command center was calling `checkAuth()` before app-controller.js loaded, causing authentication to fail and projects not to load.

**Fix:**
- Moved app-controller.js and unified-navigation.js to load in the `<head>` before inline scripts
- Updated checkAuth() to use global window.app.checkAuth when available
- Added fallback logic for backward compatibility

**Files Modified:**
- `public/command-center.html`

### 2. Database Column Error - years_experience ✅
**Problem:** The `calculate_contractor_grade` RPC function referenced `years_experience` column which doesn't exist in `user_profiles` table.

**Fix:**
- Updated function to use correct column name: `years_in_business`
- Created migration script to update the function in production database

**Files Modified:**
- `database/contractor-grade-function.sql`
- `database/complete-setup.sql`
- `database/migrations/04_fix_contractor_grade_column.sql` (new)

### 3. Projects Not Loading ✅
**Problem:** Projects weren't loading due to authentication failure.

**Fix:** Resolved by fixing authentication issue (see #1 above).

---

## Manual Database Migration Required

**⚠️ IMPORTANT:** The database function needs to be updated in production Supabase.

### Steps to Apply Migration:

1. Log in to your Supabase dashboard
2. Go to SQL Editor
3. Run the migration script: `database/migrations/04_fix_contractor_grade_column.sql`
4. Verify the function works:
   ```sql
   SELECT calculate_contractor_grade('your-contractor-email@example.com');
   ```

**Note:** Until this migration is applied, the contractor grade calculation will return a default grade instead of showing an error.

---

## Testing Checklist

After deployment, verify:

- [ ] Command center loads without authentication errors
- [ ] Projects dropdown populates with contractor's projects
- [ ] Selecting a project loads project details correctly
- [ ] Contractor grade API returns data without column errors
- [ ] Activity log displays correctly
- [ ] Project timeline/Gantt chart renders

---

## Related Logs

Previous deployment showed these errors:
```
[checkAuth] AuthService or Supabase client not available at app-controller.js:225
Authentication failed at command-center.html:1425
column "years_experience" does not exist
```

All of these should be resolved after this deployment + manual migration.
