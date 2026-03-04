-- =====================================================
-- 009: CJDQuick OMS Integration
-- =====================================================
-- Adds external order tracking, integration configs, and sync logging

-- Add external order reference columns to delivery_orders
ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS external_order_id VARCHAR(100);
ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS external_source VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_delivery_orders_external
  ON delivery_orders (external_source, external_order_id);

-- Integration configuration per hub
CREATE TABLE IF NOT EXISTS integration_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hub_id UUID NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,  -- 'cjdquick'
  api_key_encrypted TEXT,
  webhook_secret TEXT,
  location_id VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(hub_id, provider)
);

-- Sync log for auditing all inbound/outbound events
CREATE TABLE IF NOT EXISTS sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hub_id UUID REFERENCES hubs(id),
  provider VARCHAR(50) NOT NULL,
  direction VARCHAR(10) NOT NULL,   -- 'inbound' or 'outbound'
  event_type VARCHAR(50) NOT NULL,
  external_id VARCHAR(100),
  lma_order_id UUID,
  status VARCHAR(20) NOT NULL,      -- 'success' or 'failed'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_provider_created
  ON sync_log (provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_log_hub
  ON sync_log (hub_id, created_at DESC);

-- Enable RLS
ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

-- Policies: service role can do everything
CREATE POLICY "Service role full access on integration_configs"
  ON integration_configs FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on sync_log"
  ON sync_log FOR ALL
  USING (true) WITH CHECK (true);
