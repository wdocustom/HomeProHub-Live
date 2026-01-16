# Database Migrations

## 1. Conversation Messages Tables (Latest - REQUIRED)

### What This Does
Creates the conversation-based messaging system tables that the app requires for contractor-homeowner communication.

### Tables Created
- `conversations` - Tracks messaging conversations between homeowners and contractors for specific jobs
- `conversation_messages` - Individual messages within conversations

### SQL to Run

See `create_conversation_messages_table.sql` or run this:

```sql
-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES job_postings(id) ON DELETE CASCADE,
  homeowner_email TEXT NOT NULL,
  contractor_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, homeowner_email, contractor_email)
);

-- Create conversation_messages table
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  sender_email TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_conversations_job_id ON conversations(job_id);
CREATE INDEX IF NOT EXISTS idx_conversations_homeowner ON conversations(homeowner_email);
CREATE INDEX IF NOT EXISTS idx_conversations_contractor ON conversations(contractor_email);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_unread ON conversation_messages(recipient_email, read) WHERE read = FALSE;
```

---

## 2. Estimate Fields for Bids Migration

### What This Does
Adds fields to the `contractor_bids` table to support attaching professional AI-generated estimates to bids.

### Fields Added
- `has_estimate` - Boolean flag indicating if bid includes an estimate
- `estimate` - JSONB field storing full estimate data (line items, costs, breakdown)

### SQL to Run

```sql
-- Add estimate fields to contractor_bids table
ALTER TABLE contractor_bids
ADD COLUMN IF NOT EXISTS has_estimate BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS estimate JSONB;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_contractor_bids_has_estimate ON contractor_bids(has_estimate) WHERE has_estimate = TRUE;
```

---

## 2. License Verification Fields Migration

### What This Does
Adds the necessary columns to the `user_profiles` table to support the email-based license verification workflow.

### Fields Added
- `verification_id` - Unique tracking ID for verification requests
- `license_state` - State where license was issued
- `license_number` - License number
- `license_type` - Type of contractor license
- `license_expiration` - License expiration date
- `license_verified` - Status: 'unverified', 'pending', 'verified', or 'rejected'
- `verified_at` - Timestamp of verification
- `insurance_provider` - Insurance company name
- `insurance_policy_number` - Policy number
- `insurance_expiration` - Insurance expiration date
- `insurance_coverage` - Coverage amount in dollars

### How to Apply

1. **Login to Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your HomeProHub project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the Migration**
   - Copy the contents of `add_license_verification_fields.sql`
   - Paste into the SQL editor
   - Click "Run" or press Cmd/Ctrl + Enter

4. **Verify Success**
   - You should see "Success. No rows returned"
   - Go to Table Editor → user_profiles
   - Confirm the new columns are visible

### Rollback (if needed)

If you need to remove these columns:

```sql
ALTER TABLE user_profiles
DROP COLUMN IF EXISTS verification_id,
DROP COLUMN IF EXISTS license_state,
DROP COLUMN IF EXISTS license_number,
DROP COLUMN IF EXISTS license_type,
DROP COLUMN IF EXISTS license_expiration,
DROP COLUMN IF EXISTS license_verified,
DROP COLUMN IF EXISTS verified_at,
DROP COLUMN IF EXISTS insurance_provider,
DROP COLUMN IF EXISTS insurance_policy_number,
DROP COLUMN IF EXISTS insurance_expiration,
DROP COLUMN IF EXISTS insurance_coverage;

DROP INDEX IF EXISTS idx_user_profiles_verification_id;
DROP INDEX IF EXISTS idx_user_profiles_license_verified;
```

### After Migration

Once the migration is complete:
1. Restart your server (or redeploy on Render)
2. Test the license submission form on contractor-profile.html
3. Check that the admin email is sent when a license is submitted
4. Test the approve/reject workflow from the email links

### Environment Variables

Don't forget to add these to your Render environment:
- `ADMIN_EMAIL` - Email address to receive verification requests
- `BASE_URL` - Your site URL (e.g., https://www.homeprohub.today)
