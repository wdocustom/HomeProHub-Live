-- ========================================
-- AUTONOMOUS DEVELOPMENT TRINITY
-- Database Schema Migration
-- ========================================
-- This migration creates the tables needed for the three AI agents
-- to function autonomously: The Mechanic, The Builder, and The Improver
-- ========================================

-- ========================================
-- 1. ENABLE PGVECTOR EXTENSION
-- ========================================
-- Required for semantic code search in the Knowledge Base
CREATE EXTENSION IF NOT EXISTS vector;

-- ========================================
-- 2. CODEBASE EMBEDDINGS TABLE
-- ========================================
-- Stores vector embeddings of code files for RAG-based context retrieval
-- Used by all agents to understand existing code before making changes

CREATE TABLE IF NOT EXISTS codebase_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- File identification
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'js', 'html', 'css', 'json', etc.

    -- Content tracking
    chunk_text TEXT NOT NULL, -- The actual code chunk
    chunk_index INTEGER NOT NULL, -- Position in file (for multi-chunk files)
    file_hash TEXT NOT NULL, -- MD5 hash to detect changes

    -- Vector embedding (1536 dimensions for OpenAI text-embedding-3-small)
    embedding vector(1536) NOT NULL,

    -- Metadata
    line_start INTEGER,
    line_end INTEGER,
    function_name TEXT, -- Extracted function/class name if applicable
    imports JSONB DEFAULT '[]'::jsonb, -- Dependencies detected

    -- Tracking
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Performance index
    CONSTRAINT unique_file_chunk UNIQUE (file_path, chunk_index)
);

-- Create index for vector similarity search (cosine distance)
CREATE INDEX IF NOT EXISTS codebase_embeddings_vector_idx
ON codebase_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for file lookups
CREATE INDEX IF NOT EXISTS codebase_embeddings_file_path_idx
ON codebase_embeddings (file_path);

-- Index for timestamp-based queries
CREATE INDEX IF NOT EXISTS codebase_embeddings_updated_idx
ON codebase_embeddings (last_updated DESC);

-- ========================================
-- 3. FEATURE REQUESTS TABLE
-- ========================================
-- Work queue for The Builder agent
-- Can be populated manually via API or automatically by The Improver

CREATE TABLE IF NOT EXISTS feature_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Request details
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),

    -- Classification
    request_type TEXT DEFAULT 'feature' CHECK (request_type IN ('feature', 'refactor', 'optimization', 'bug_fix', 'improvement')),

    -- Affected areas
    affected_files JSONB DEFAULT '[]'::jsonb, -- Array of file paths
    target_directory TEXT, -- Where new code should go

    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'testing', 'completed', 'failed', 'cancelled')),

    -- Agent assignment
    assigned_to TEXT DEFAULT 'builder', -- Which agent should handle this

    -- Source tracking
    created_by TEXT, -- 'user', 'improver', 'mechanic', or user email
    source_file TEXT, -- If created by Improver, which file triggered it

    -- Implementation tracking
    implementation_plan JSONB, -- Agent's planned approach
    sandbox_session_id TEXT, -- Reference to sandbox session
    test_results JSONB, -- Results from TestPilot

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Retry logic
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_error TEXT,

    -- Human oversight
    requires_approval BOOLEAN DEFAULT false,
    approved_by TEXT,
    approved_at TIMESTAMP WITH TIME ZONE
);

-- Index for status-based queries (The Builder's work queue)
CREATE INDEX IF NOT EXISTS feature_requests_status_idx
ON feature_requests (status)
WHERE status IN ('pending', 'in_progress');

-- Index for priority sorting
CREATE INDEX IF NOT EXISTS feature_requests_priority_idx
ON feature_requests (priority DESC, created_at ASC);

-- Index for agent assignment
CREATE INDEX IF NOT EXISTS feature_requests_assigned_idx
ON feature_requests (assigned_to, status);

-- ========================================
-- 4. SYSTEM ERRORS TABLE
-- ========================================
-- Error log for The Mechanic to monitor and fix
-- Populated by error handlers, monitoring systems, and crash reports

CREATE TABLE IF NOT EXISTS system_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Error identification
    error_type TEXT NOT NULL, -- 'uncaught_exception', 'api_error', 'database_error', etc.
    error_message TEXT NOT NULL,
    stack_trace TEXT,

    -- Context
    source_file TEXT, -- File where error occurred
    source_function TEXT, -- Function name if available
    line_number INTEGER,

    -- Request context (if applicable)
    request_method TEXT, -- GET, POST, etc.
    request_path TEXT, -- /api/jobs, etc.
    user_email TEXT, -- Affected user

    -- Error details
    error_data JSONB DEFAULT '{}'::jsonb, -- Additional error context
    environment TEXT DEFAULT 'production' CHECK (environment IN ('production', 'staging', 'development')),

    -- Frequency tracking
    occurrence_count INTEGER DEFAULT 1,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Resolution tracking
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'fixed', 'ignored', 'duplicate')),
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),

    -- Fix tracking
    fixed_by_agent BOOLEAN DEFAULT false,
    fix_session_id TEXT, -- Reference to sandbox session
    fix_deployed_at TIMESTAMP WITH TIME ZONE,
    fix_description TEXT,

    -- Human oversight
    acknowledged_by TEXT,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT
);

-- Index for error monitoring queries
CREATE INDEX IF NOT EXISTS system_errors_status_severity_idx
ON system_errors (status, severity DESC, last_seen DESC)
WHERE status = 'open';

-- Index for duplicate detection
CREATE INDEX IF NOT EXISTS system_errors_lookup_idx
ON system_errors (error_type, source_file, line_number);

-- Index for frequency analysis
CREATE INDEX IF NOT EXISTS system_errors_occurrence_idx
ON system_errors (occurrence_count DESC);

-- ========================================
-- 5. AGENT ACTIVITY LOG
-- ========================================
-- Comprehensive audit trail of all agent actions
-- Used for debugging, analysis, and human oversight

CREATE TABLE IF NOT EXISTS agent_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Agent identification
    agent_name TEXT NOT NULL CHECK (agent_name IN ('mechanic', 'builder', 'improver')),
    action_type TEXT NOT NULL, -- 'error_detected', 'fix_deployed', 'feature_built', etc.

    -- Action details
    description TEXT NOT NULL,

    -- References
    related_error_id UUID REFERENCES system_errors(id) ON DELETE SET NULL,
    related_request_id UUID REFERENCES feature_requests(id) ON DELETE SET NULL,

    -- Results
    status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failure', 'partial')),
    result_data JSONB DEFAULT '{}'::jsonb,

    -- Files affected
    files_modified JSONB DEFAULT '[]'::jsonb, -- Array of file paths

    -- Sandbox tracking
    sandbox_session_id TEXT,

    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,

    -- Resource usage
    tokens_used INTEGER, -- LLM tokens consumed
    cost_estimate DECIMAL(10, 6), -- Estimated cost in USD

    -- Safety
    requires_approval BOOLEAN DEFAULT false,
    approved BOOLEAN DEFAULT false
);

-- Index for agent activity queries
CREATE INDEX IF NOT EXISTS agent_activity_log_agent_idx
ON agent_activity_log (agent_name, started_at DESC);

-- Index for time-based analysis
CREATE INDEX IF NOT EXISTS agent_activity_log_time_idx
ON agent_activity_log (started_at DESC);

-- ========================================
-- 6. AGENT CONFIGURATION TABLE
-- ========================================
-- Runtime configuration and safety controls for agents

CREATE TABLE IF NOT EXISTS agent_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name TEXT UNIQUE NOT NULL CHECK (agent_name IN ('mechanic', 'builder', 'improver', 'global')),

    -- Enable/disable
    enabled BOOLEAN DEFAULT true,

    -- Safety rails
    require_approval BOOLEAN DEFAULT false,
    max_deployments_per_hour INTEGER DEFAULT 5,
    max_deployments_per_day INTEGER DEFAULT 50,

    -- File restrictions
    allowed_directories JSONB DEFAULT '["public", "services", "routes"]'::jsonb,
    denied_patterns JSONB DEFAULT '[".env", "node_modules", "config", "database/migrations"]'::jsonb,

    -- LLM configuration
    model_name TEXT DEFAULT 'gpt-4o',
    temperature DECIMAL(3, 2) DEFAULT 0.2,
    max_tokens INTEGER DEFAULT 4000,

    -- Rate limiting
    last_deployment TIMESTAMP WITH TIME ZONE,
    deployments_this_hour INTEGER DEFAULT 0,
    deployments_today INTEGER DEFAULT 0,

    -- Custom settings
    custom_config JSONB DEFAULT '{}'::jsonb,

    -- Tracking
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by TEXT
);

-- Insert default configurations
INSERT INTO agent_config (agent_name, enabled, require_approval, max_deployments_per_hour) VALUES
    ('mechanic', true, false, 10),
    ('builder', true, true, 5),
    ('improver', true, false, 0), -- Improver doesn't deploy, only creates tickets
    ('global', true, false, 20)
ON CONFLICT (agent_name) DO NOTHING;

-- ========================================
-- 7. HELPER FUNCTIONS
-- ========================================

-- Function to increment error occurrence count
CREATE OR REPLACE FUNCTION increment_error_occurrence(
    p_error_type TEXT,
    p_error_message TEXT,
    p_source_file TEXT,
    p_stack_trace TEXT,
    p_error_data JSONB
) RETURNS UUID AS $$
DECLARE
    v_error_id UUID;
BEGIN
    -- Try to find existing error
    SELECT id INTO v_error_id
    FROM system_errors
    WHERE error_type = p_error_type
      AND error_message = p_error_message
      AND source_file = p_source_file
      AND status = 'open'
    LIMIT 1;

    IF v_error_id IS NOT NULL THEN
        -- Update existing error
        UPDATE system_errors
        SET occurrence_count = occurrence_count + 1,
            last_seen = NOW(),
            stack_trace = p_stack_trace,
            error_data = p_error_data
        WHERE id = v_error_id;
    ELSE
        -- Create new error
        INSERT INTO system_errors (
            error_type,
            error_message,
            source_file,
            stack_trace,
            error_data
        ) VALUES (
            p_error_type,
            p_error_message,
            p_source_file,
            p_stack_trace,
            p_error_data
        ) RETURNING id INTO v_error_id;
    END IF;

    RETURN v_error_id;
END;
$$ LANGUAGE plpgsql;

-- Function to match code embeddings by similarity
CREATE OR REPLACE FUNCTION match_code_embeddings(
    query_embedding vector(1536),
    match_count int DEFAULT 10
) RETURNS TABLE (
    id UUID,
    file_path TEXT,
    file_type TEXT,
    chunk_text TEXT,
    chunk_index INTEGER,
    line_start INTEGER,
    line_end INTEGER,
    function_name TEXT,
    imports JSONB,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ce.id,
        ce.file_path,
        ce.file_type,
        ce.chunk_text,
        ce.chunk_index,
        ce.line_start,
        ce.line_end,
        ce.function_name,
        ce.imports,
        1 - (ce.embedding <=> query_embedding) AS similarity
    FROM codebase_embeddings ce
    ORDER BY ce.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check if agent is within rate limits
CREATE OR REPLACE FUNCTION check_agent_rate_limit(p_agent_name TEXT) RETURNS BOOLEAN AS $$
DECLARE
    v_config RECORD;
    v_hour_count INTEGER;
    v_day_count INTEGER;
BEGIN
    -- Get agent config
    SELECT * INTO v_config FROM agent_config WHERE agent_name = p_agent_name;

    IF NOT v_config.enabled THEN
        RETURN false;
    END IF;

    -- Count deployments in last hour
    SELECT COUNT(*) INTO v_hour_count
    FROM agent_activity_log
    WHERE agent_name = p_agent_name
      AND action_type = 'deployment'
      AND started_at > NOW() - INTERVAL '1 hour';

    -- Count deployments today
    SELECT COUNT(*) INTO v_day_count
    FROM agent_activity_log
    WHERE agent_name = p_agent_name
      AND action_type = 'deployment'
      AND started_at > CURRENT_DATE;

    RETURN v_hour_count < v_config.max_deployments_per_hour
       AND v_day_count < v_config.max_deployments_per_day;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

COMMENT ON TABLE codebase_embeddings IS 'Vector embeddings of codebase for semantic search and RAG';
COMMENT ON TABLE feature_requests IS 'Work queue for The Builder agent';
COMMENT ON TABLE system_errors IS 'Error monitoring and tracking for The Mechanic';
COMMENT ON TABLE agent_activity_log IS 'Audit trail of all autonomous agent actions';
COMMENT ON TABLE agent_config IS 'Runtime configuration and safety controls';
