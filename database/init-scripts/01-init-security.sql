-- ============================================================================
-- PostgreSQL Security Initialization Script
-- ============================================================================
--
-- This script runs automatically when the database is first created.
-- It configures security settings, creates roles, and sets up auditing.
--
-- Execution: Runs once during docker-compose up (first time only)
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- Encryption functions
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- Query performance monitoring

-- ============================================================================
-- ROLE-BASED ACCESS CONTROL
-- ============================================================================

-- Create read-only role for reporting/analytics
CREATE ROLE pfa_readonly;
GRANT CONNECT ON DATABASE pfa_vanguard_dev TO pfa_readonly;
GRANT USAGE ON SCHEMA public TO pfa_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO pfa_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO pfa_readonly;

-- Create read-write role for application
CREATE ROLE pfa_readwrite;
GRANT CONNECT ON DATABASE pfa_vanguard_dev TO pfa_readwrite;
GRANT USAGE, CREATE ON SCHEMA public TO pfa_readwrite;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pfa_readwrite;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pfa_readwrite;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pfa_readwrite;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO pfa_readwrite;

-- Create backup role (for pg_dump)
CREATE ROLE pfa_backup;
GRANT CONNECT ON DATABASE pfa_vanguard_dev TO pfa_backup;
GRANT USAGE ON SCHEMA public TO pfa_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO pfa_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO pfa_backup;

-- ============================================================================
-- AUDIT LOGGING
-- ============================================================================

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    event_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_name TEXT NOT NULL,
    database_name TEXT NOT NULL,
    client_addr INET,
    application_name TEXT,
    event_type TEXT NOT NULL,  -- INSERT, UPDATE, DELETE, TRUNCATE
    table_name TEXT NOT NULL,
    record_id TEXT,
    old_values JSONB,
    new_values JSONB,
    query TEXT
);

-- Index for efficient querying
CREATE INDEX idx_audit_log_event_time ON audit_log(event_time DESC);
CREATE INDEX idx_audit_log_user_name ON audit_log(user_name);
CREATE INDEX idx_audit_log_table_name ON audit_log(table_name);

-- ============================================================================
-- TRIGGER FUNCTION FOR AUDIT LOGGING
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log for specific sensitive tables
    IF TG_TABLE_NAME IN ('users', 'api_configurations', 'system_configs') THEN
        INSERT INTO audit_log (
            user_name,
            database_name,
            client_addr,
            application_name,
            event_type,
            table_name,
            record_id,
            old_values,
            new_values,
            query
        ) VALUES (
            current_user,
            current_database(),
            inet_client_addr(),
            current_setting('application_name', true),
            TG_OP,
            TG_TABLE_NAME,
            CASE
                WHEN TG_OP = 'DELETE' THEN OLD.id::TEXT
                ELSE NEW.id::TEXT
            END,
            CASE
                WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD)
                ELSE NULL
            END,
            CASE
                WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW)
                ELSE NULL
            END,
            current_query()
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS) PREPARATION
-- ============================================================================

-- Enable RLS on sensitive tables (applied after Prisma migrations)
-- These will be enabled in a later migration after tables are created

-- Example for future use:
-- ALTER TABLE pfa_records ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY pfa_records_isolation ON pfa_records
--     FOR ALL
--     USING (organization_id = current_setting('app.current_organization_id', true)::TEXT);

-- ============================================================================
-- SECURITY SETTINGS
-- ============================================================================

-- Require password authentication
ALTER DATABASE pfa_vanguard_dev SET password_encryption TO 'scram-sha-256';

-- Set secure connection defaults
ALTER DATABASE pfa_vanguard_dev SET ssl TO on;

-- Set statement timeout to prevent long-running queries
ALTER DATABASE pfa_vanguard_dev SET statement_timeout TO '30s';

-- Disable idle in transaction timeout
ALTER DATABASE pfa_vanguard_dev SET idle_in_transaction_session_timeout TO '10min';

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- View for active connections
CREATE OR REPLACE VIEW active_connections AS
SELECT
    pid,
    usename AS username,
    application_name,
    client_addr,
    client_hostname,
    backend_start,
    state,
    state_change,
    query,
    wait_event_type,
    wait_event
FROM pg_stat_activity
WHERE state != 'idle'
  AND pid != pg_backend_pid()
ORDER BY backend_start DESC;

-- View for table sizes
CREATE OR REPLACE VIEW table_sizes AS
SELECT
    schemaname AS schema,
    tablename AS table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- View for slow queries (requires pg_stat_statements)
CREATE OR REPLACE VIEW slow_queries AS
SELECT
    queryid,
    substring(query, 1, 100) AS query_preview,
    calls,
    total_exec_time / 1000 AS total_time_seconds,
    mean_exec_time / 1000 AS mean_time_seconds,
    max_exec_time / 1000 AS max_time_seconds,
    rows
FROM pg_stat_statements
WHERE mean_exec_time > 1000  -- Queries taking more than 1 second on average
ORDER BY mean_exec_time DESC
LIMIT 20;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to safely reset all sequences (useful after data import)
CREATE OR REPLACE FUNCTION reset_all_sequences()
RETURNS void AS $$
DECLARE
    seq RECORD;
BEGIN
    FOR seq IN
        SELECT sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
    LOOP
        EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX(id) FROM %I), 1), true)',
                      seq.sequence_name,
                      replace(seq.sequence_name, '_id_seq', ''));
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to check table permissions
CREATE OR REPLACE FUNCTION check_permissions(role_name TEXT)
RETURNS TABLE (
    table_name TEXT,
    select_priv BOOLEAN,
    insert_priv BOOLEAN,
    update_priv BOOLEAN,
    delete_priv BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.tablename::TEXT,
        has_table_privilege(role_name, t.schemaname||'.'||t.tablename, 'SELECT'),
        has_table_privilege(role_name, t.schemaname||'.'||t.tablename, 'INSERT'),
        has_table_privilege(role_name, t.schemaname||'.'||t.tablename, 'UPDATE'),
        has_table_privilege(role_name, t.schemaname||'.'||t.tablename, 'DELETE')
    FROM pg_tables t
    WHERE t.schemaname = 'public'
    ORDER BY t.tablename;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'PostgreSQL Security Initialization Complete';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Created roles:';
    RAISE NOTICE '  - pfa_readonly   (read-only access)';
    RAISE NOTICE '  - pfa_readwrite  (application access)';
    RAISE NOTICE '  - pfa_backup     (backup operations)';
    RAISE NOTICE '';
    RAISE NOTICE 'Created tables:';
    RAISE NOTICE '  - audit_log      (tracks data modifications)';
    RAISE NOTICE '';
    RAISE NOTICE 'Created views:';
    RAISE NOTICE '  - active_connections';
    RAISE NOTICE '  - table_sizes';
    RAISE NOTICE '  - slow_queries';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Run Prisma migrations: npx prisma migrate deploy';
    RAISE NOTICE '  2. Apply audit triggers to sensitive tables';
    RAISE NOTICE '  3. Configure Row-Level Security if needed';
    RAISE NOTICE '';
    RAISE NOTICE '============================================================';
END $$;
