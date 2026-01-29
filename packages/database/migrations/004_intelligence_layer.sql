-- Intelligence Layer Migration
-- Supports geofencing, surge pricing, and demand forecasting

-- Zone type enum
CREATE TYPE zone_type AS ENUM ('delivery', 'pickup', 'restricted', 'surge', 'warehouse');

-- Geofence zones table
CREATE TABLE geofence_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type zone_type NOT NULL DEFAULT 'delivery',
    polygon JSONB NOT NULL, -- { coordinates: [{latitude, longitude}, ...] }
    properties JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Surge pricing rules
CREATE TABLE surge_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID NOT NULL REFERENCES geofence_zones(id) ON DELETE CASCADE,
    condition JSONB NOT NULL, -- { type: 'time' | 'demand' | 'weather' | 'event' | 'driver_shortage', params: {...} }
    multiplier DECIMAL(3, 2) NOT NULL DEFAULT 1.00 CHECK (multiplier >= 1.00 AND multiplier <= 5.00),
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Geofence events (driver zone transitions)
CREATE TABLE geofence_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    zone_id UUID NOT NULL REFERENCES geofence_zones(id) ON DELETE CASCADE,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('enter', 'exit', 'dwell')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    location JSONB NOT NULL -- { latitude, longitude }
);

-- Weather data (for surge pricing)
CREATE TABLE weather_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location JSONB NOT NULL, -- { latitude, longitude }
    condition VARCHAR(50) NOT NULL, -- 'clear', 'rain', 'storm', 'snow', etc.
    temperature DECIMAL(5, 2),
    humidity DECIMAL(5, 2),
    wind_speed DECIMAL(5, 2),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Demand forecasts
CREATE TABLE demand_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID REFERENCES geofence_zones(id) ON DELETE CASCADE,
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    forecast_date DATE NOT NULL,
    hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
    predicted_orders INTEGER NOT NULL,
    predicted_drivers_needed INTEGER NOT NULL,
    confidence DECIMAL(3, 2) NOT NULL DEFAULT 0.70,
    actual_orders INTEGER, -- Filled in after the hour passes
    model_version VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(zone_id, merchant_id, forecast_date, hour)
);

-- Historical demand data for training
CREATE TABLE demand_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID REFERENCES geofence_zones(id) ON DELETE CASCADE,
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    recorded_date DATE NOT NULL,
    hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
    order_count INTEGER NOT NULL DEFAULT 0,
    avg_delivery_time DECIMAL(5, 2),
    active_drivers INTEGER,
    weather_condition VARCHAR(50),
    is_holiday BOOLEAN DEFAULT false,
    is_weekend BOOLEAN DEFAULT false,
    special_event VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(zone_id, merchant_id, recorded_date, hour)
);

-- ML model weights storage
CREATE TABLE ml_model_weights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_type VARCHAR(50) NOT NULL, -- 'delivery_prediction', 'demand_forecast', 'allocation'
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    weights JSONB NOT NULL,
    metrics JSONB, -- { accuracy, mae, mse, etc. }
    training_samples INTEGER,
    trained_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(model_type, merchant_id)
);

-- Allocation history (for learning)
CREATE TABLE allocation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    score DECIMAL(4, 3) NOT NULL,
    score_breakdown JSONB NOT NULL,
    was_accepted BOOLEAN,
    response_time_seconds INTEGER,
    estimated_pickup_time INTEGER,
    actual_pickup_time INTEGER,
    estimated_delivery_time INTEGER,
    actual_delivery_time INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add zone_id to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES geofence_zones(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX idx_geofence_zones_type ON geofence_zones(type) WHERE is_active = true;
CREATE INDEX idx_geofence_zones_merchant ON geofence_zones(merchant_id) WHERE is_active = true;
CREATE INDEX idx_surge_rules_zone ON surge_rules(zone_id) WHERE is_active = true;
CREATE INDEX idx_geofence_events_driver ON geofence_events(driver_id, timestamp DESC);
CREATE INDEX idx_geofence_events_zone ON geofence_events(zone_id, timestamp DESC);
CREATE INDEX idx_weather_data_time ON weather_data(recorded_at DESC);
CREATE INDEX idx_demand_forecasts_date ON demand_forecasts(forecast_date, hour);
CREATE INDEX idx_demand_forecasts_zone ON demand_forecasts(zone_id, forecast_date);
CREATE INDEX idx_demand_history_date ON demand_history(recorded_date, hour);
CREATE INDEX idx_allocation_history_order ON allocation_history(order_id);
CREATE INDEX idx_orders_zone ON orders(zone_id) WHERE zone_id IS NOT NULL;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_geofence_zones_updated_at
    BEFORE UPDATE ON geofence_zones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_surge_rules_updated_at
    BEFORE UPDATE ON surge_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to record demand history hourly
CREATE OR REPLACE FUNCTION record_hourly_demand()
RETURNS void AS $$
DECLARE
    current_hour INTEGER;
    current_date DATE;
    current_day INTEGER;
BEGIN
    current_hour := EXTRACT(HOUR FROM NOW());
    current_date := CURRENT_DATE;
    current_day := EXTRACT(DOW FROM NOW());

    -- Record demand for each zone
    INSERT INTO demand_history (zone_id, merchant_id, recorded_date, hour, order_count, avg_delivery_time, active_drivers, is_weekend)
    SELECT
        o.zone_id,
        o.merchant_id,
        current_date,
        current_hour,
        COUNT(*)::INTEGER,
        AVG(EXTRACT(EPOCH FROM (o.delivered_at - o.created_at)) / 60)::DECIMAL(5, 2),
        (SELECT COUNT(*) FROM drivers d WHERE d.status = 'online')::INTEGER,
        current_day IN (0, 6)
    FROM orders o
    WHERE o.created_at >= DATE_TRUNC('hour', NOW() - INTERVAL '1 hour')
      AND o.created_at < DATE_TRUNC('hour', NOW())
      AND o.zone_id IS NOT NULL
    GROUP BY o.zone_id, o.merchant_id
    ON CONFLICT (zone_id, merchant_id, recorded_date, hour)
    DO UPDATE SET
        order_count = EXCLUDED.order_count,
        avg_delivery_time = EXCLUDED.avg_delivery_time,
        active_drivers = EXCLUDED.active_drivers;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE geofence_zones IS 'Geofence zone definitions with polygon boundaries';
COMMENT ON TABLE surge_rules IS 'Dynamic pricing rules based on various conditions';
COMMENT ON TABLE geofence_events IS 'Driver zone entry/exit events for tracking';
COMMENT ON TABLE demand_forecasts IS 'Predicted order demand for capacity planning';
COMMENT ON TABLE demand_history IS 'Historical demand data for ML training';
COMMENT ON TABLE ml_model_weights IS 'Trained ML model weights for predictions';
COMMENT ON TABLE allocation_history IS 'Order-driver allocation history for learning';
