# Database Migration: contractor_profiles Table

## 🚨 CRITICAL FIX

This migration creates the missing `contractor_profiles` table that is causing:
- ❌ 500 errors on review link endpoint
- ❌ Contractor directory failing to load
- ❌ Profile pages unable to save data

---

## ⚡ Quick Start (Choose One Method)

### Method 1: Supabase SQL Editor (RECOMMENDED - 2 minutes)

1. **Go to your Supabase Dashboard**: https://app.supabase.com
2. **Open SQL Editor**: Click "SQL Editor" in left sidebar
3. **Create New Query**: Click "+ New Query" button
4. **Copy & Paste**: Open `001-create-contractor-profiles.sql` and paste entire contents
5. **Run**: Click "Run" button or press `Cmd/Ctrl + Enter`
6. **Verify**: You should see "Success. No rows returned" (this is correct!)

**That's it!** The table is now created with all policies.

---

### Method 2: Automated Script (Requires Database URL)

If you have direct database access credentials:

1. **Get your Database URL** from Supabase:
   - Go to Project Settings → Database
   - Copy the "Connection string" under "Connection parameters"
   - It looks like: `postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres`

2. **Add to .env file**:
   ```bash
   DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
   ```

3. **Run the migration**:
   ```bash
   node migrate-contractor-profiles.js
   ```

---

## ✅ Verification

After running the migration, verify it worked:

### In Supabase SQL Editor:
```sql
-- Check table exists
SELECT COUNT(*) FROM public.contractor_profiles;

-- Check policies
SELECT policyname FROM pg_policies
WHERE tablename = 'contractor_profiles';
```

You should see:
- Table exists with row count
- 3 policies: "Public profiles are viewable by everyone", "Users can update own profile", "Users can insert own profile"

### On Your Website:
1. **Test Review Link**: Go to contractor dashboard → review link should generate without 500 error
2. **Test Directory**: Visit `/contractor-directory.html` → should load contractor cards
3. **Test Profile**: Edit contractor profile → should save successfully

---

## 🔍 What This Migration Does

1. **Creates Table**: `contractor_profiles` with all required columns
   - Links to auth.users (id)
   - Stores company info, trades, licenses
   - Includes `review_link_slug` (fixes 500 error!)
   - Grade, rating, reviews_count

2. **Enables Row Level Security (RLS)**
   - Public can view profiles (directory works)
   - Contractors can edit their own profile
   - Contractors can create their own profile

3. **Auto-Syncs Existing Users**
   - Creates profiles for users who don't have one
   - Auto-generates review link slugs
   - No data loss, idempotent (safe to re-run)

---

## 🆘 Troubleshooting

### "Permission denied for table contractor_profiles"
→ The table doesn't exist yet. Run the migration first.

### "Relation contractor_profiles already exists"
→ Table already created! Migration was successful. You can ignore this.

### "Could not connect to database"
→ Check your DATABASE_URL in .env file. Use Method 1 (SQL Editor) instead.

---

## 📁 Files

- `001-create-contractor-profiles.sql` - Manual SQL to run in Supabase SQL Editor
- `migrate-contractor-profiles.js` - Automated Node.js script
- `README.md` - This file
