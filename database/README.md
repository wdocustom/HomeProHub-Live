# Database Setup Guide

## Quick Start (Run This First!)

**Run this single SQL file in Supabase SQL Editor:**

```sql
database/complete-setup.sql
```

This will:
- ✅ Create the `reviews` table
- ✅ Set up all RLS policies for reviews
- ✅ Set up RLS policies for job_postings (contractors can view open/active jobs)
- ✅ Create the `calculate_contractor_grade()` function
- ✅ Grant proper permissions

## Individual SQL Files (Alternative)

If you prefer to run them separately:

### 1. Reviews Table & Policies
```sql
database/reviews-rls-policy.sql
```
Creates the reviews table and RLS policies for review submission.

### 2. Job Postings Policies
```sql
database/projects-rls-policy.sql
```
Allows contractors to view open/active jobs (fixes "Unable to load opportunities").

### 3. Grade Calculation Function
```sql
database/contractor-grade-function.sql
```
Creates the function that calculates contractor grades (fixes "Error" on My Grade page).

## Troubleshooting

### Error: "relation 'public.reviews' does not exist"
**Solution:** Run `complete-setup.sql` or `reviews-rls-policy.sql`

### Error: "cannot drop function calculate_contractor_grade because other objects depend on it"
**Solution:** Already fixed! The SQL now uses `DROP FUNCTION ... CASCADE`

### Error: "Failed to submit review" (500 error)
**Cause:** Reviews table doesn't exist yet
**Solution:** Run `complete-setup.sql`

### Error: "Unable to load opportunities" (500 error)
**Cause:** RLS policies missing or status mismatch
**Solution:** Run `complete-setup.sql` (now allows both 'open' and 'active' status)

### Grade page shows "Error" and 0/100
**Cause:** Function has NULL handling issues or doesn't exist
**Solution:** Run `complete-setup.sql` (includes NULL handling with COALESCE)

## What Gets Created

### Tables
- `reviews` - Stores contractor reviews with ratings, tags, photos

### RLS Policies
- Reviews: INSERT, SELECT, UPDATE for authenticated users
- Job Postings: SELECT for contractors (status = 'open' OR 'active')
- Job Postings: Full CRUD for homeowners (their own jobs only)

### Functions
- `calculate_contractor_grade(email)` - Returns grade (A-F), score, breakdown

## Verification

After running `complete-setup.sql`, you should see:
```
NOTICE: ✓ reviews table created
NOTICE: ✓ job_postings table exists
NOTICE: Database setup complete!
```

## Environment Variables Required

Make sure your `.env` file has:
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
```

The server uses `SERVICE_ROLE_KEY` which bypasses RLS for backend operations.
