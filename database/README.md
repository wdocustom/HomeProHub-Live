# HomeProHub Database Setup

This directory contains the database schema and utilities for HomeProHub's PostgreSQL database (via Supabase).

## Files

- `schema.sql` - Complete database schema with all tables, indexes, views, and triggers
- `db.js` - Node.js database module with all CRUD operations

## Quick Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the database to be provisioned (usually 1-2 minutes)
3. Copy your project credentials from Settings > API:
   - Project URL
   - Anon/Public Key
   - Service Role Key (keep this secret!)

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key-here"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
```

### 3. Run Database Schema

1. Open your Supabase project dashboard
2. Go to **SQL Editor** in the left sidebar
3. Copy the entire contents of `database/schema.sql`
4. Paste into the SQL Editor
5. Click **Run** to execute the schema

Alternatively, you can run it via command line:
```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" < database/schema.sql
```

### 4. Verify Installation

After running the schema, verify the tables were created:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see:
- activity_log
- contractor_bids
- homeowner_ratings
- job_postings
- messages
- notifications
- user_profiles

## Database Schema Overview

### Core Tables

#### `user_profiles`
Stores both homeowner and contractor profiles with role-specific fields.

**Key Fields:**
- `email` - Unique identifier
- `role` - 'homeowner' or 'contractor'
- `business_name`, `license_number`, `years_in_business` - Contractor fields
- `address`, `zip_code` - Homeowner fields
- Social media URLs for contractors

#### `job_postings`
Homeowner job postings that contractors can bid on.

**Key Fields:**
- `title`, `description` - Job details
- `address`, `zip_code` - Location
- `budget_low`, `budget_high` - Budget range
- `urgency` - 'flexible', 'soon', or 'urgent'
- `status` - 'open', 'in_progress', 'completed', 'cancelled'
- `ai_analysis` - AI-generated job analysis

#### `contractor_bids`
Bids submitted by contractors on job postings.

**Key Fields:**
- `job_id` - Reference to job_postings
- `contractor_email` - Bidding contractor
- `bid_amount_low`, `bid_amount_high` - Bid range
- `message` - Pitch to homeowner
- `status` - 'pending', 'accepted', 'rejected', 'withdrawn'

#### `homeowner_ratings`
Contractor ratings of homeowners (like Uber ratings).

**Key Fields:**
- `homeowner_contact` - Email or phone (tracks across addresses)
- `communication_rating` - 1-5 stars
- `decision_speed_rating` - 1-5 stars
- `payment_rating` - 1-5 stars
- `project_complexity` - 'simple', 'moderate', 'complex'

#### `messages`
In-app messaging between homeowners and contractors.

**Key Fields:**
- `thread_id` - Groups messages into conversations
- `job_id` - Optional job reference
- `sender_email`, `recipient_email` - Participants
- `message_text` - Message content
- `attachments` - JSON array of file URLs
- `read` - Read status

#### `notifications`
System notifications for users.

**Key Fields:**
- `user_email` - Recipient
- `notification_type` - Type of notification
- `title`, `message` - Notification content
- `job_id`, `bid_id`, `message_id` - Related entities
- `email_sent` - Whether email was sent

### Views

#### `homeowner_rating_summary`
Aggregated ratings per homeowner with averages and counts.

```sql
SELECT * FROM homeowner_rating_summary WHERE homeowner_contact = 'homeowner@email.com';
```

#### `job_board_view`
Job listings with bid counts and homeowner names.

```sql
SELECT * FROM job_board_view WHERE status = 'open' ORDER BY posted_at DESC;
```

## API Endpoints

All endpoints are defined in `server.js` and use the `db.js` module.

### Job Postings

- `POST /api/submit-job` - Submit new job posting
- `GET /api/jobs` - Get all jobs (filter by zip, status, limit)
- `GET /api/jobs/:jobId` - Get specific job with bids
- `GET /api/homeowner/jobs?email=` - Get jobs by homeowner

### Contractor Bids

- `POST /api/submit-bid` - Submit bid on job
- `GET /api/contractor/bids?email=` - Get contractor's bids
- `POST /api/bid/accept` - Homeowner accepts a bid

### Homeowner Ratings

- `POST /api/submit-homeowner-rating` - Submit rating
- `GET /api/homeowner-rating/:contact` - Get aggregated rating
- `GET /api/top-rated-homeowners` - Get directory of top rated

### Messaging

- `POST /api/messages/send` - Send message
- `GET /api/messages/thread/:threadId` - Get thread messages
- `GET /api/messages/conversations?email=` - Get user's conversations

### Notifications

- `GET /api/notifications?email=` - Get user notifications
- `POST /api/notifications/read` - Mark notification as read
- `GET /api/unread-count?email=` - Get unread counts

## Security Considerations

### Row Level Security (RLS)

The schema includes commented-out RLS policies. To enable:

1. Uncomment the RLS policies at the bottom of `schema.sql`
2. Set up Supabase Auth JWT verification
3. Test policies thoroughly before production

### Service Role Key

**IMPORTANT:** The `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS policies. Only use it in backend code, never expose it to the client.

For client-side operations, use the `SUPABASE_ANON_KEY`.

## Indexes

All tables have appropriate indexes for:
- Foreign key relationships
- Common query patterns (email lookups, date sorting)
- Status filters
- Read/unread flags

Run `EXPLAIN ANALYZE` on slow queries to verify index usage.

## Backup and Maintenance

### Automatic Backups

Supabase projects include:
- Daily automated backups (retained for 7 days on free tier)
- Point-in-time recovery (paid plans)

### Manual Backup

```bash
pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" > backup.sql
```

### Restore

```bash
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" < backup.sql
```

## Troubleshooting

### Connection Issues

**Error:** "Could not connect to database"

1. Check `.env` file has correct credentials
2. Verify Supabase project is active (not paused)
3. Check your IP is whitelisted (Supabase > Settings > Database > Connection Pooling)

### Missing Tables

**Error:** "relation does not exist"

Run the schema.sql file again in SQL Editor.

### Permission Errors

**Error:** "permission denied for table"

Make sure you're using the `SERVICE_ROLE_KEY` in backend operations, not the anon key.

## Development Tips

### Testing Queries

Use Supabase SQL Editor to test queries before adding to code:

```sql
-- Test job search
SELECT * FROM job_board_view
WHERE status = 'open'
AND zip_code = '90210'
ORDER BY posted_at DESC
LIMIT 10;

-- Test rating aggregation
SELECT * FROM homeowner_rating_summary
WHERE overall_rating >= 4.0
ORDER BY total_ratings DESC;
```

### Database Functions

You can add custom functions in Supabase:

```sql
-- Example: Increment view count
CREATE OR REPLACE FUNCTION increment_view_count(job_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE job_postings
  SET view_count = view_count + 1
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql;
```

Then call from Node.js:
```javascript
await supabase.rpc('increment_view_count', { job_id: jobId });
```

## Next Steps

1. ✅ Database schema created
2. ✅ API endpoints implemented
3. ⏳ Email notifications (see `server.js` for SendGrid integration)
4. ⏳ Real-time messaging (use Supabase Realtime subscriptions)
5. ⏳ Frontend dashboards (homeowner-dashboard.html, contractor-dashboard.html)

## Support

For Supabase-specific issues, see:
- [Supabase Docs](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
