# Notification System Migration Guide

## Overview

The `notifications-system.sql` migration adds SMS and email notification functionality to HomeProHub, enabling contractors to receive automatic notifications when new jobs are posted in their service area.

## What This Migration Does

### 1. **User Profile Enhancements**
Adds the following columns to `user_profiles`:

- `service_radius_miles` (INTEGER, default: 25) - How far contractors are willing to travel
- `notifications_sms_enabled` (BOOLEAN, default: true) - SMS notification preference
- `notifications_email_enabled` (BOOLEAN, default: true) - Email notification preference
- `phone_verified` (BOOLEAN, default: false) - Phone verification status
- `phone_verification_code` (TEXT) - 6-digit verification code
- `phone_verification_expires` (TIMESTAMP) - Verification code expiry time

### 2. **Notification Log Table**
Creates `notification_log` table to track all SMS and email notifications:

**Fields:**
- Recipient information (email, ID, phone)
- Notification type (new_job_sms, new_job_email, bid_accepted, etc.)
- Subject and message content
- Related entities (job_id, bid_id)
- Delivery method (sms, email, both)
- SMS tracking (Twilio SID, status, timestamps, errors)
- Email tracking (message ID, status, timestamps, errors)

### 3. **Database Functions**

#### `find_contractors_in_service_area(p_job_zip_code, p_trade)`
Finds all contractors within service radius of a job posting:
- Matches by ZIP code and trade
- Filters by service radius
- Returns only contractors with notifications enabled
- Includes phone verification status

#### `queue_job_notification(job_id, title, zip_code, category, budget_low, budget_high)`
Queues notifications for all eligible contractors:
- Finds contractors in service area
- Creates notification log entries
- Separate entries for SMS and email
- Returns count of notifications queued

### 4. **Automatic Job Posting Trigger**
Creates trigger `job_posting_notification_trigger` that automatically:
- Fires when new job is posted (INSERT on job_postings)
- Only for jobs with status = 'open'
- Calls `queue_job_notification()` to notify contractors

## Prerequisites

- Supabase project with existing schema
- `user_profiles` table with columns: email, id, role, trade, zip_code
- `job_postings` table with columns: id, title, zip_code, category, budget_low, budget_high, status

## How to Run This Migration

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the contents of `notifications-system.sql`
5. Paste into the query editor
6. Click **Run** or press `Ctrl+Enter`
7. Verify success in the **Results** tab

### Option 2: Supabase CLI

```bash
# Make sure you're in the project directory
cd HomeProHub-Live

# Run the migration
supabase db push database/notifications-system.sql
```

### Option 3: psql Command Line

```bash
psql "your-supabase-connection-string" -f database/notifications-system.sql
```

## Verification

After running the migration, verify it was successful:

### 1. Check New Columns
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
  AND column_name IN (
    'service_radius_miles',
    'notifications_sms_enabled',
    'notifications_email_enabled',
    'phone_verified',
    'phone_verification_code',
    'phone_verification_expires'
  );
```

### 2. Check New Table
```sql
SELECT * FROM notification_log LIMIT 5;
```

### 3. Check Functions
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('find_contractors_in_service_area', 'queue_job_notification');
```

### 4. Check Trigger
```sql
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'job_posting_notification_trigger';
```

## Next Steps After Migration

### 1. **Twilio Configuration** (for SMS)
Add Twilio credentials to your environment:
```bash
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone
```

### 2. **Email Service Configuration**
Configure your email service (SendGrid, AWS SES, etc.)

### 3. **Notification Worker**
Set up a background worker to process queued notifications:
- Poll `notification_log` for entries with `sms_status = 'queued'` or `email_status = 'queued'`
- Send via Twilio (SMS) or email service
- Update status and timestamps

### 4. **Contractor Profile UI**
The UI is already implemented in `contractor-profile.html`:
- Service radius slider (5-100 miles)
- Phone verification flow
- SMS/Email notification toggles

### 5. **API Endpoints to Implement**

**Phone Verification:**
```javascript
POST /api/profile/send-verification
POST /api/profile/verify-phone
```

**Notification Preferences:**
```javascript
PUT /api/profile/notification-preferences
```

## Distance Calculation

⚠️ **Important:** The current implementation uses a **mock distance calculation** based on ZIP code matching. For production, you should:

1. Install a ZIP code distance library or service
2. Update `find_contractors_in_service_area()` function
3. Replace the mock distance calculation with real lat/long distance

**Recommended services:**
- Google Maps Distance Matrix API
- ZipCodeAPI.com
- PostgreSQL PostGIS extension with ZIP coordinate data

## Rollback

If you need to rollback this migration:

```sql
-- Remove trigger
DROP TRIGGER IF EXISTS job_posting_notification_trigger ON job_postings;

-- Remove functions
DROP FUNCTION IF EXISTS trigger_job_notifications();
DROP FUNCTION IF EXISTS queue_job_notification(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS find_contractors_in_service_area(TEXT, TEXT);

-- Remove table
DROP TABLE IF EXISTS notification_log;

-- Remove columns from user_profiles
ALTER TABLE user_profiles
  DROP COLUMN IF EXISTS service_radius_miles,
  DROP COLUMN IF EXISTS notifications_sms_enabled,
  DROP COLUMN IF EXISTS notifications_email_enabled,
  DROP COLUMN IF EXISTS phone_verified,
  DROP COLUMN IF EXISTS phone_verification_code,
  DROP COLUMN IF EXISTS phone_verification_expires;
```

## Testing

After migration, test the notification flow:

1. **Create a test contractor:**
```sql
UPDATE user_profiles
SET service_radius_miles = 50,
    notifications_sms_enabled = true,
    notifications_email_enabled = true,
    phone_verified = true,
    trade = 'Plumber',
    zip_code = '68105'
WHERE email = 'test-contractor@example.com';
```

2. **Post a test job:**
```sql
INSERT INTO job_postings (
  title, category, zip_code, budget_low, budget_high, status, homeowner_email
) VALUES (
  'Test Plumbing Job',
  'Plumber',
  '68105',
  500,
  1000,
  'open',
  'homeowner@example.com'
);
```

3. **Check notifications were created:**
```sql
SELECT * FROM notification_log
WHERE notification_type IN ('new_job_sms', 'new_job_email')
ORDER BY created_at DESC
LIMIT 10;
```

## Support

If you encounter issues:
1. Check Supabase logs for errors
2. Verify all prerequisite tables exist
3. Ensure user has proper permissions
4. Review the SQL output for constraint violations

## Related Files

- `notifications-system.sql` - This migration file
- `public/contractor-profile.html` - Notification preferences UI
- `server.js` - Backend API endpoints (notification logic)
- `database/db.js` - Database service layer

## Migration Status

- [x] Schema created
- [ ] Migration run in database
- [ ] Twilio configured
- [ ] Email service configured
- [ ] Notification worker implemented
- [ ] Distance calculation updated with real service
- [ ] End-to-end testing completed
