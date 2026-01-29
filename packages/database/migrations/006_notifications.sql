-- Notifications & Communications Migration
-- Supports push, SMS, email notifications, order tracking, and ratings

-- User devices for push notifications
CREATE TABLE user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    device_name VARCHAR(255),
    app_version VARCHAR(50),
    os_version VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, token)
);

-- Notification preferences
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    push_enabled BOOLEAN NOT NULL DEFAULT true,
    sms_enabled BOOLEAN NOT NULL DEFAULT true,
    email_enabled BOOLEAN NOT NULL DEFAULT true,
    in_app_enabled BOOLEAN NOT NULL DEFAULT true,
    quiet_hours_start VARCHAR(5), -- HH:mm format
    quiet_hours_end VARCHAR(5),
    disabled_types TEXT[], -- Notification types to skip
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- In-app notifications
CREATE TABLE in_app_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    image_url TEXT,
    action_url TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification history
CREATE TABLE notification_history (
    id VARCHAR(100) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    channels_used TEXT[] NOT NULL,
    channel_results JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rate limiting log
CREATE TABLE notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scheduled notifications
CREATE TABLE scheduled_notifications (
    id VARCHAR(100) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_data JSONB NOT NULL,
    payload JSONB NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification templates
CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    channel VARCHAR(20) NOT NULL DEFAULT 'all',
    language VARCHAR(5) NOT NULL DEFAULT 'en',
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    variables TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT true,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tracking tokens for shareable links
CREATE TABLE tracking_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    token VARCHAR(50) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order ratings
CREATE TABLE order_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE UNIQUE,
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
    driver_rating INTEGER CHECK (driver_rating >= 1 AND driver_rating <= 5),
    merchant_rating INTEGER CHECK (merchant_rating >= 1 AND merchant_rating <= 5),
    dimensions JSONB,
    feedback TEXT,
    issues TEXT[],
    tip_amount DECIMAL(10, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Driver ratings
CREATE TABLE driver_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    dimensions JSONB, -- { punctuality, professionalism, delivery_care }
    feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(driver_id, order_id)
);

-- Merchant ratings
CREATE TABLE merchant_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    dimensions JSONB, -- { food_quality, packaging, accuracy, value_for_money }
    feedback TEXT,
    photos TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(merchant_id, order_id)
);

-- Driver tips
CREATE TABLE driver_tips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'paid')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Support tickets
CREATE TABLE support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    subject VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add rating columns to drivers and merchants
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0;

-- Add order tracking columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery TIMESTAMPTZ;

-- Indexes for performance
CREATE INDEX idx_user_devices_user ON user_devices(user_id) WHERE is_active = true;
CREATE INDEX idx_user_devices_token ON user_devices(token);
CREATE INDEX idx_notification_preferences_user ON notification_preferences(user_id);
CREATE INDEX idx_in_app_notifications_user ON in_app_notifications(user_id, created_at DESC);
CREATE INDEX idx_in_app_notifications_unread ON in_app_notifications(user_id) WHERE is_read = false;
CREATE INDEX idx_notification_history_user ON notification_history(user_id, created_at DESC);
CREATE INDEX idx_notification_log_user ON notification_log(user_id, sent_at DESC);
CREATE INDEX idx_notification_log_rate_limit ON notification_log(user_id, channel, sent_at);
CREATE INDEX idx_scheduled_notifications_pending ON scheduled_notifications(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_notification_templates_lookup ON notification_templates(type, channel, language) WHERE is_active = true;
CREATE INDEX idx_tracking_tokens_token ON tracking_tokens(token) WHERE expires_at > NOW();
CREATE INDEX idx_order_ratings_order ON order_ratings(order_id);
CREATE INDEX idx_driver_ratings_driver ON driver_ratings(driver_id, created_at DESC);
CREATE INDEX idx_merchant_ratings_merchant ON merchant_ratings(merchant_id, created_at DESC);
CREATE INDEX idx_support_tickets_customer ON support_tickets(customer_id, created_at DESC);
CREATE INDEX idx_support_tickets_status ON support_tickets(status) WHERE status IN ('open', 'in_progress');

-- Triggers
CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_devices_updated_at
    BEFORE UPDATE ON user_devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at
    BEFORE UPDATE ON notification_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_support_tickets_updated_at
    BEFORE UPDATE ON support_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment driver balance (for tips)
CREATE OR REPLACE FUNCTION increment_driver_balance(p_driver_id UUID, p_amount DECIMAL)
RETURNS void AS $$
BEGIN
    UPDATE drivers
    SET balance = COALESCE(balance, 0) + p_amount
    WHERE id = p_driver_id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := 'ORD' || TO_CHAR(NOW(), 'YYMMDD') || UPPER(SUBSTRING(NEW.id::TEXT, 1, 6));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- Clean up old notification logs (retention: 7 days)
CREATE OR REPLACE FUNCTION cleanup_notification_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM notification_log
    WHERE sent_at < NOW() - INTERVAL '7 days';

    DELETE FROM tracking_tokens
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE user_devices IS 'User device tokens for push notifications';
COMMENT ON TABLE notification_preferences IS 'User notification settings and preferences';
COMMENT ON TABLE in_app_notifications IS 'In-app notification inbox for users';
COMMENT ON TABLE notification_history IS 'Complete notification delivery history';
COMMENT ON TABLE notification_templates IS 'Notification message templates with i18n support';
COMMENT ON TABLE tracking_tokens IS 'Shareable order tracking links';
COMMENT ON TABLE order_ratings IS 'Customer ratings for completed orders';
COMMENT ON TABLE driver_ratings IS 'Customer ratings for delivery drivers';
COMMENT ON TABLE merchant_ratings IS 'Customer ratings for restaurants/merchants';
COMMENT ON TABLE driver_tips IS 'Customer tips for drivers';
COMMENT ON TABLE support_tickets IS 'Customer support and issue tracking';
