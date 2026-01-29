-- Security, Compliance & Performance Migration
-- Audit logs, data requests, consents, caching, and monitoring

-- Audit logs table
CREATE TABLE audit_logs (
    id VARCHAR(100) PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    details JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    previous_value JSONB,
    new_value JSONB,
    hash VARCHAR(64) NOT NULL,
    previous_hash VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs archive (for retention policy)
CREATE TABLE audit_logs_archive (
    id VARCHAR(100) PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    user_id UUID,
    target_user_id UUID,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    details JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    previous_value JSONB,
    new_value JSONB,
    hash VARCHAR(64) NOT NULL,
    previous_hash VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User consents (GDPR compliance)
CREATE TABLE user_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type VARCHAR(50) NOT NULL,
    is_granted BOOLEAN NOT NULL DEFAULT false,
    granted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, consent_type)
);

-- Data requests (export/deletion)
CREATE TABLE data_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('export', 'deletion', 'correction')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    requested_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    download_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Session logs
CREATE TABLE session_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(100) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,
    location JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Security events
CREATE TABLE security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    description TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rate limit logs
CREATE TABLE rate_limit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    ip_address INET,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    limit_type VARCHAR(50) NOT NULL,
    current_count INTEGER NOT NULL,
    max_count INTEGER NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    blocked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- API keys for service-to-service
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    key_prefix VARCHAR(10) NOT NULL,
    permissions TEXT[] NOT NULL DEFAULT '{}',
    rate_limit INTEGER DEFAULT 1000,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cache entries (for application-level caching)
CREATE TABLE cache_entries (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Health check logs
CREATE TABLE health_check_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
    response_time_ms INTEGER,
    details JSONB DEFAULT '{}',
    error_message TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System metrics
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(20, 4) NOT NULL,
    unit VARCHAR(20),
    tags JSONB DEFAULT '{}',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add encrypted columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_hash VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_hash VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add encrypted columns to drivers table
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS pan_hash VARCHAR(64);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS aadhaar_hash VARCHAR(64);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS bank_account_encrypted TEXT;

-- Saved payment methods
CREATE TABLE IF NOT EXISTS saved_payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('card', 'upi', 'netbanking', 'wallet')),
    provider VARCHAR(50),
    token_encrypted TEXT NOT NULL,
    last_four VARCHAR(4),
    expiry_month INTEGER,
    expiry_year INTEGER,
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type, created_at DESC);
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity) WHERE severity IN ('error', 'critical');
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

CREATE INDEX idx_user_consents_user ON user_consents(user_id);
CREATE INDEX idx_user_consents_type ON user_consents(consent_type, is_granted);

CREATE INDEX idx_data_requests_user ON data_requests(user_id, created_at DESC);
CREATE INDEX idx_data_requests_status ON data_requests(status) WHERE status = 'pending';

CREATE INDEX idx_session_logs_user ON session_logs(user_id, started_at DESC);
CREATE INDEX idx_session_logs_active ON session_logs(user_id) WHERE is_active = true;

CREATE INDEX idx_security_events_type ON security_events(event_type, created_at DESC);
CREATE INDEX idx_security_events_unresolved ON security_events(severity, created_at DESC) WHERE is_resolved = false;

CREATE INDEX idx_rate_limit_logs_key ON rate_limit_logs(key, created_at DESC);
CREATE INDEX idx_rate_limit_logs_blocked ON rate_limit_logs(created_at DESC) WHERE blocked = true;

CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix) WHERE is_active = true;

CREATE INDEX idx_cache_entries_expires ON cache_entries(expires_at);
CREATE INDEX idx_cache_entries_tags ON cache_entries USING GIN(tags);

CREATE INDEX idx_health_check_logs_service ON health_check_logs(service_name, checked_at DESC);
CREATE INDEX idx_health_check_logs_status ON health_check_logs(status, checked_at DESC);

CREATE INDEX idx_system_metrics_name ON system_metrics(metric_name, recorded_at DESC);
CREATE INDEX idx_system_metrics_recorded ON system_metrics(recorded_at DESC);

CREATE INDEX idx_users_email_hash ON users(email_hash);
CREATE INDEX idx_users_phone_hash ON users(phone_hash);
CREATE INDEX idx_users_deleted ON users(id) WHERE is_deleted = true;

CREATE INDEX idx_saved_payment_methods_user ON saved_payment_methods(user_id) WHERE is_active = true;

-- Triggers
CREATE TRIGGER update_user_consents_updated_at
    BEFORE UPDATE ON user_consents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cache_entries_updated_at
    BEFORE UPDATE ON cache_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_payment_methods_updated_at
    BEFORE UPDATE ON saved_payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM cache_entries WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to clean old metrics
CREATE OR REPLACE FUNCTION cleanup_old_metrics()
RETURNS void AS $$
BEGIN
    -- Keep last 30 days of metrics
    DELETE FROM system_metrics WHERE recorded_at < NOW() - INTERVAL '30 days';

    -- Keep last 7 days of health checks
    DELETE FROM health_check_logs WHERE checked_at < NOW() - INTERVAL '7 days';

    -- Keep last 24 hours of rate limit logs
    DELETE FROM rate_limit_logs WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_payment_methods ENABLE ROW LEVEL SECURITY;

-- Users can view their own consents
CREATE POLICY user_consents_select ON user_consents
    FOR SELECT USING (auth.uid() = user_id);

-- Users can view their own data requests
CREATE POLICY data_requests_select ON data_requests
    FOR SELECT USING (auth.uid() = user_id);

-- Users can view their own sessions
CREATE POLICY session_logs_select ON session_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Users can manage their own payment methods
CREATE POLICY saved_payment_methods_all ON saved_payment_methods
    FOR ALL USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE audit_logs IS 'Tamper-evident audit trail with hash chain';
COMMENT ON TABLE audit_logs_archive IS 'Archived audit logs for long-term retention';
COMMENT ON TABLE user_consents IS 'GDPR consent records for users';
COMMENT ON TABLE data_requests IS 'User data export and deletion requests';
COMMENT ON TABLE session_logs IS 'User session tracking for security';
COMMENT ON TABLE security_events IS 'Security incidents and alerts';
COMMENT ON TABLE rate_limit_logs IS 'Rate limiting events for monitoring';
COMMENT ON TABLE api_keys IS 'API keys for service-to-service authentication';
COMMENT ON TABLE cache_entries IS 'Application-level cache storage';
COMMENT ON TABLE health_check_logs IS 'Service health check history';
COMMENT ON TABLE system_metrics IS 'System performance metrics';
COMMENT ON TABLE saved_payment_methods IS 'Encrypted saved payment methods';
