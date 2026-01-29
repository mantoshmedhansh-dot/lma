-- Analytics & Reporting Migration
-- Supports KPIs, reports, real-time tracking, and alerts

-- Generated reports table
CREATE TABLE generated_reports (
    id VARCHAR(100) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    format VARCHAR(10) NOT NULL DEFAULT 'json',
    date_range_start TIMESTAMPTZ NOT NULL,
    date_range_end TIMESTAMPTZ NOT NULL,
    filters JSONB DEFAULT '{}',
    file_url TEXT,
    file_name VARCHAR(255),
    schedule_id UUID,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Scheduled reports table
CREATE TABLE scheduled_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    format VARCHAR(10) NOT NULL DEFAULT 'csv',
    schedule VARCHAR(20) NOT NULL CHECK (schedule IN ('daily', 'weekly', 'monthly')),
    recipients TEXT[] NOT NULL,
    filters JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Operational alerts table
CREATE TABLE operational_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order status log for tracking
CREATE TABLE order_status_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT
);

-- Driver location log for history
CREATE TABLE driver_location_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(10, 2),
    speed DECIMAL(10, 2),
    heading DECIMAL(5, 2),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dashboard snapshots for historical comparison
CREATE TABLE dashboard_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date DATE NOT NULL,
    snapshot_hour INTEGER NOT NULL CHECK (snapshot_hour >= 0 AND snapshot_hour <= 23),
    metrics JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(snapshot_date, snapshot_hour)
);

-- KPI aggregates for faster queries
CREATE TABLE kpi_daily_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_date DATE NOT NULL,
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES geofence_zones(id) ON DELETE CASCADE,
    total_orders INTEGER NOT NULL DEFAULT 0,
    completed_orders INTEGER NOT NULL DEFAULT 0,
    cancelled_orders INTEGER NOT NULL DEFAULT 0,
    total_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_delivery_fees DECIMAL(12, 2) NOT NULL DEFAULT 0,
    avg_delivery_time DECIMAL(6, 2),
    active_drivers INTEGER,
    active_merchants INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(aggregate_date, merchant_id, zone_id)
);

-- User activity log for analytics
CREATE TABLE user_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    metadata JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_generated_reports_type ON generated_reports(type);
CREATE INDEX idx_generated_reports_date ON generated_reports(generated_at DESC);
CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active = true;
CREATE INDEX idx_operational_alerts_unacknowledged ON operational_alerts(created_at DESC) WHERE acknowledged = false;
CREATE INDEX idx_operational_alerts_severity ON operational_alerts(severity, created_at DESC);
CREATE INDEX idx_order_status_log_order ON order_status_log(order_id, changed_at DESC);
CREATE INDEX idx_order_status_log_time ON order_status_log(changed_at DESC);
CREATE INDEX idx_driver_location_log_driver ON driver_location_log(driver_id, recorded_at DESC);
CREATE INDEX idx_driver_location_log_time ON driver_location_log(recorded_at DESC);
CREATE INDEX idx_dashboard_snapshots_date ON dashboard_snapshots(snapshot_date DESC);
CREATE INDEX idx_kpi_daily_aggregates_date ON kpi_daily_aggregates(aggregate_date DESC);
CREATE INDEX idx_kpi_daily_aggregates_merchant ON kpi_daily_aggregates(merchant_id, aggregate_date DESC);
CREATE INDEX idx_user_activity_log_user ON user_activity_log(user_id, recorded_at DESC);
CREATE INDEX idx_user_activity_log_type ON user_activity_log(activity_type, recorded_at DESC);

-- Trigger to update scheduled reports timestamp
CREATE TRIGGER update_scheduled_reports_updated_at
    BEFORE UPDATE ON scheduled_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to aggregate daily KPIs
CREATE OR REPLACE FUNCTION aggregate_daily_kpis(target_date DATE)
RETURNS void AS $$
BEGIN
    INSERT INTO kpi_daily_aggregates (
        aggregate_date,
        merchant_id,
        zone_id,
        total_orders,
        completed_orders,
        cancelled_orders,
        total_revenue,
        total_delivery_fees,
        avg_delivery_time
    )
    SELECT
        target_date,
        o.merchant_id,
        o.zone_id,
        COUNT(*)::INTEGER,
        COUNT(*) FILTER (WHERE o.status = 'delivered')::INTEGER,
        COUNT(*) FILTER (WHERE o.status = 'cancelled')::INTEGER,
        COALESCE(SUM(o.total_amount), 0),
        COALESCE(SUM(o.delivery_fee), 0),
        AVG(EXTRACT(EPOCH FROM (o.delivered_at - o.created_at)) / 60)
            FILTER (WHERE o.status = 'delivered' AND o.delivered_at IS NOT NULL)
    FROM orders o
    WHERE DATE(o.created_at) = target_date
    GROUP BY o.merchant_id, o.zone_id
    ON CONFLICT (aggregate_date, merchant_id, zone_id)
    DO UPDATE SET
        total_orders = EXCLUDED.total_orders,
        completed_orders = EXCLUDED.completed_orders,
        cancelled_orders = EXCLUDED.cancelled_orders,
        total_revenue = EXCLUDED.total_revenue,
        total_delivery_fees = EXCLUDED.total_delivery_fees,
        avg_delivery_time = EXCLUDED.avg_delivery_time;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old location logs (retention: 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_location_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM driver_location_log
    WHERE recorded_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Function to take dashboard snapshot
CREATE OR REPLACE FUNCTION take_dashboard_snapshot()
RETURNS void AS $$
DECLARE
    current_date DATE;
    current_hour INTEGER;
    metrics JSONB;
BEGIN
    current_date := CURRENT_DATE;
    current_hour := EXTRACT(HOUR FROM NOW())::INTEGER;

    -- Calculate metrics
    SELECT jsonb_build_object(
        'active_orders', (SELECT COUNT(*) FROM orders WHERE status NOT IN ('delivered', 'cancelled')),
        'orders_today', (SELECT COUNT(*) FROM orders WHERE DATE(created_at) = current_date),
        'revenue_today', (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE DATE(created_at) = current_date),
        'online_drivers', (SELECT COUNT(*) FROM drivers WHERE status = 'online'),
        'completion_rate', (
            SELECT CASE
                WHEN COUNT(*) > 0 THEN
                    (COUNT(*) FILTER (WHERE status = 'delivered')::DECIMAL / COUNT(*) * 100)
                ELSE 0
            END
            FROM orders WHERE DATE(created_at) = current_date
        )
    ) INTO metrics;

    INSERT INTO dashboard_snapshots (snapshot_date, snapshot_hour, metrics)
    VALUES (current_date, current_hour, metrics)
    ON CONFLICT (snapshot_date, snapshot_hour)
    DO UPDATE SET metrics = EXCLUDED.metrics;
END;
$$ LANGUAGE plpgsql;

-- Add commission_rate to merchants if not exists
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5, 4) DEFAULT 0.15;

-- Add tracking columns to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_assigned_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

-- Comments
COMMENT ON TABLE generated_reports IS 'History of generated reports';
COMMENT ON TABLE scheduled_reports IS 'Scheduled report configurations';
COMMENT ON TABLE operational_alerts IS 'System operational alerts and notifications';
COMMENT ON TABLE order_status_log IS 'Complete order status change history';
COMMENT ON TABLE driver_location_log IS 'Driver location history for analytics';
COMMENT ON TABLE dashboard_snapshots IS 'Hourly dashboard metric snapshots';
COMMENT ON TABLE kpi_daily_aggregates IS 'Pre-aggregated daily KPIs for performance';
COMMENT ON TABLE user_activity_log IS 'User activity tracking for analytics';
