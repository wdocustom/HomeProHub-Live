-- Create conversation_messages table for new conversation-based messaging system
-- This replaces the legacy thread-based messages approach

-- Create conversations table (if not exists)
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_job_id ON conversations(job_id);
CREATE INDEX IF NOT EXISTS idx_conversations_homeowner ON conversations(homeowner_email);
CREATE INDEX IF NOT EXISTS idx_conversations_contractor ON conversations(contractor_email);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_unread ON conversation_messages(recipient_email, read) WHERE read = FALSE;

-- Add trigger to update conversations.updated_at on new message
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_timestamp
AFTER INSERT ON conversation_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_timestamp();

-- Add comments
COMMENT ON TABLE conversations IS 'Messaging conversations between homeowners and contractors for specific jobs';
COMMENT ON TABLE conversation_messages IS 'Individual messages within conversations';
COMMENT ON COLUMN conversation_messages.attachments IS 'Array of attachment objects with file URLs and metadata';
