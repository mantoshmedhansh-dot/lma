-- =====================================================
-- Migration: Integrations (Shopify, 3PL, Webhooks, ONDC)
-- =====================================================

-- =====================================================
-- INTEGRATION PROVIDERS
-- =====================================================

CREATE TYPE integration_type AS ENUM ('shopify', 'woocommerce', 'magento', '3pl', 'ondc', 'custom');
CREATE TYPE integration_status AS ENUM ('pending', 'active', 'paused', 'error', 'disconnected');
CREATE TYPE webhook_status AS ENUM ('pending', 'delivered', 'failed', 'retrying');

-- =====================================================
-- SHOPIFY INTEGRATIONS
-- =====================================================

CREATE TABLE shopify_stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Shopify store details
  shop_domain VARCHAR(255) NOT NULL UNIQUE,
  shop_name VARCHAR(255),
  shop_email VARCHAR(255),
  shop_owner VARCHAR(255),

  -- OAuth tokens
  access_token TEXT NOT NULL,
  scope TEXT NOT NULL,

  -- App installation
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  uninstalled_at TIMESTAMPTZ,

  -- Sync settings
  auto_sync_orders BOOLEAN DEFAULT TRUE,
  auto_fulfill_orders BOOLEAN DEFAULT TRUE,
  sync_products BOOLEAN DEFAULT FALSE,

  -- Status
  status integration_status DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,

  -- Webhooks
  webhook_ids JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shopify_stores_merchant ON shopify_stores(merchant_id);
CREATE INDEX idx_shopify_stores_domain ON shopify_stores(shop_domain);
CREATE INDEX idx_shopify_stores_status ON shopify_stores(status);

-- Shopify order mapping
CREATE TABLE shopify_order_mapping (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shopify_store_id UUID NOT NULL REFERENCES shopify_stores(id) ON DELETE CASCADE,
  shopify_order_id VARCHAR(100) NOT NULL,
  shopify_order_number VARCHAR(100),
  lma_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,

  -- Sync status
  fulfillment_status VARCHAR(50),
  last_synced_at TIMESTAMPTZ,
  sync_error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shopify_store_id, shopify_order_id)
);

CREATE INDEX idx_shopify_order_mapping_store ON shopify_order_mapping(shopify_store_id);
CREATE INDEX idx_shopify_order_mapping_lma ON shopify_order_mapping(lma_order_id);

-- =====================================================
-- 3PL PARTNER INTEGRATIONS
-- =====================================================

CREATE TABLE logistics_partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Partner details
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,  -- 'delhivery', 'bluedart', 'shiprocket', etc.
  logo_url TEXT,
  website VARCHAR(255),

  -- API configuration
  api_base_url VARCHAR(255) NOT NULL,
  api_version VARCHAR(20),
  auth_type VARCHAR(50) DEFAULT 'api_key',  -- 'api_key', 'oauth2', 'basic'

  -- Capabilities
  supports_cod BOOLEAN DEFAULT FALSE,
  supports_prepaid BOOLEAN DEFAULT TRUE,
  supports_reverse BOOLEAN DEFAULT FALSE,
  supports_express BOOLEAN DEFAULT FALSE,
  supports_tracking BOOLEAN DEFAULT TRUE,

  -- Service areas
  serviceable_pincodes TEXT[],
  serviceable_countries TEXT[] DEFAULT ARRAY['IN'],

  -- Rate configuration
  rate_card JSONB,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Merchant-Partner connections
CREATE TABLE merchant_logistics_partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES logistics_partners(id) ON DELETE CASCADE,

  -- Credentials (encrypted)
  credentials JSONB NOT NULL,  -- Stored encrypted

  -- Settings
  is_default BOOLEAN DEFAULT FALSE,
  priority INTEGER DEFAULT 0,  -- Higher = preferred
  auto_assign BOOLEAN DEFAULT TRUE,

  -- Filters
  min_order_value DECIMAL(10, 2),
  max_order_value DECIMAL(10, 2),
  allowed_payment_modes TEXT[],  -- 'cod', 'prepaid'

  -- Status
  status integration_status DEFAULT 'active',
  last_used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(merchant_id, partner_id)
);

CREATE INDEX idx_mlp_merchant ON merchant_logistics_partners(merchant_id);
CREATE INDEX idx_mlp_partner ON merchant_logistics_partners(partner_id);

-- 3PL shipments
CREATE TABLE partner_shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id),
  partner_id UUID NOT NULL REFERENCES logistics_partners(id),
  merchant_partner_id UUID REFERENCES merchant_logistics_partners(id),

  -- AWB / Tracking
  awb_number VARCHAR(100),
  tracking_url TEXT,

  -- Shipment details
  shipment_type VARCHAR(50) DEFAULT 'forward',  -- 'forward', 'reverse', 'exchange'
  payment_mode VARCHAR(20),  -- 'cod', 'prepaid'

  -- Package details
  weight_kg DECIMAL(10, 3),
  dimensions JSONB,  -- {length, width, height}
  package_count INTEGER DEFAULT 1,

  -- Costs
  shipping_cost DECIMAL(10, 2),
  cod_charges DECIMAL(10, 2),
  total_cost DECIMAL(10, 2),

  -- Status tracking
  current_status VARCHAR(100),
  status_history JSONB DEFAULT '[]',

  -- Timestamps
  booked_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  in_transit_at TIMESTAMPTZ,
  out_for_delivery_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,

  -- Partner response
  partner_response JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_partner_shipments_order ON partner_shipments(order_id);
CREATE INDEX idx_partner_shipments_awb ON partner_shipments(awb_number);
CREATE INDEX idx_partner_shipments_partner ON partner_shipments(partner_id);

-- =====================================================
-- WEBHOOK SYSTEM
-- =====================================================

-- Webhook endpoints (subscribers)
CREATE TABLE webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Endpoint details
  url TEXT NOT NULL,
  description TEXT,

  -- Authentication
  secret_key TEXT NOT NULL,  -- For HMAC signature

  -- Event subscriptions
  events TEXT[] NOT NULL,  -- ['order.created', 'order.delivered', etc.]

  -- Settings
  is_active BOOLEAN DEFAULT TRUE,
  retry_count INTEGER DEFAULT 3,
  timeout_ms INTEGER DEFAULT 30000,

  -- Rate limiting
  rate_limit_per_minute INTEGER DEFAULT 60,

  -- Stats
  total_deliveries INTEGER DEFAULT 0,
  total_failures INTEGER DEFAULT 0,
  last_delivery_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_endpoints_merchant ON webhook_endpoints(merchant_id);
CREATE INDEX idx_webhook_endpoints_active ON webhook_endpoints(is_active);

-- Webhook delivery log
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,

  -- Event details
  event_type VARCHAR(100) NOT NULL,
  event_id VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,

  -- Delivery status
  status webhook_status DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,

  -- Response
  response_status INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,

  -- Error tracking
  last_error TEXT,

  -- Timestamps
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  first_attempted_at TIMESTAMPTZ,
  last_attempted_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_endpoint ON webhook_deliveries(endpoint_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_scheduled ON webhook_deliveries(scheduled_at);
CREATE INDEX idx_webhook_deliveries_event ON webhook_deliveries(event_type, event_id);

-- =====================================================
-- ONDC INTEGRATION
-- =====================================================

-- ONDC network participants
CREATE TABLE ondc_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,

  -- ONDC registration
  subscriber_id VARCHAR(255) UNIQUE NOT NULL,
  subscriber_url VARCHAR(255) NOT NULL,

  -- Type
  participant_type VARCHAR(50) NOT NULL,  -- 'seller', 'logistics', 'buyer'
  domain VARCHAR(100),  -- 'ONDC:RET10', 'ONDC:LOG10', etc.

  -- Keys
  signing_public_key TEXT NOT NULL,
  encryption_public_key TEXT NOT NULL,

  -- Registry info
  registry_url VARCHAR(255),
  city_code VARCHAR(10),

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  registry_status VARCHAR(50),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ondc_participants_merchant ON ondc_participants(merchant_id);
CREATE INDEX idx_ondc_participants_subscriber ON ondc_participants(subscriber_id);

-- ONDC transactions
CREATE TABLE ondc_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id UUID NOT NULL REFERENCES ondc_participants(id),

  -- ONDC identifiers
  transaction_id VARCHAR(255) NOT NULL,
  message_id VARCHAR(255) NOT NULL,

  -- Context
  action VARCHAR(50) NOT NULL,  -- 'search', 'select', 'init', 'confirm', 'status', etc.
  domain VARCHAR(100),
  bap_id VARCHAR(255),
  bpp_id VARCHAR(255),

  -- Request/Response
  request_payload JSONB,
  response_payload JSONB,

  -- Status
  status VARCHAR(50) DEFAULT 'pending',
  error_code VARCHAR(50),
  error_message TEXT,

  -- Timing
  request_at TIMESTAMPTZ,
  response_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ondc_transactions_participant ON ondc_transactions(participant_id);
CREATE INDEX idx_ondc_transactions_txn ON ondc_transactions(transaction_id);
CREATE INDEX idx_ondc_transactions_action ON ondc_transactions(action);

-- ONDC order mapping
CREATE TABLE ondc_order_mapping (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id UUID NOT NULL REFERENCES ondc_participants(id),
  ondc_order_id VARCHAR(255) NOT NULL,
  lma_order_id UUID REFERENCES orders(id),

  -- ONDC details
  bap_order_id VARCHAR(255),
  transaction_id VARCHAR(255),

  -- Status sync
  ondc_status VARCHAR(50),
  last_synced_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_id, ondc_order_id)
);

CREATE INDEX idx_ondc_order_mapping_lma ON ondc_order_mapping(lma_order_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE shopify_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_logistics_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Merchants can manage their own integrations
CREATE POLICY "Merchants can manage Shopify stores"
  ON shopify_stores FOR ALL
  USING (
    auth.uid() IN (SELECT user_id FROM merchants WHERE id = merchant_id)
  );

CREATE POLICY "Merchants can manage their logistics partners"
  ON merchant_logistics_partners FOR ALL
  USING (
    auth.uid() IN (SELECT user_id FROM merchants WHERE id = merchant_id)
  );

CREATE POLICY "Merchants can view their shipments"
  ON partner_shipments FOR SELECT
  USING (
    auth.uid() IN (
      SELECT m.user_id FROM merchants m
      JOIN orders o ON o.merchant_id = m.id
      WHERE o.id = order_id
    )
  );

CREATE POLICY "Merchants can manage webhooks"
  ON webhook_endpoints FOR ALL
  USING (
    auth.uid() IN (SELECT user_id FROM merchants WHERE id = merchant_id)
  );

-- Anyone can view active logistics partners
CREATE POLICY "Anyone can view logistics partners"
  ON logistics_partners FOR SELECT
  USING (is_active = true);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to record webhook delivery attempt
CREATE OR REPLACE FUNCTION record_webhook_attempt(
  p_delivery_id UUID,
  p_status webhook_status,
  p_response_status INTEGER,
  p_response_body TEXT,
  p_response_time_ms INTEGER,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE webhook_deliveries
  SET
    status = p_status,
    attempts = attempts + 1,
    response_status = p_response_status,
    response_body = p_response_body,
    response_time_ms = p_response_time_ms,
    last_error = p_error,
    last_attempted_at = NOW(),
    first_attempted_at = COALESCE(first_attempted_at, NOW()),
    delivered_at = CASE WHEN p_status = 'delivered' THEN NOW() ELSE NULL END
  WHERE id = p_delivery_id;

  -- Update endpoint stats
  UPDATE webhook_endpoints
  SET
    total_deliveries = total_deliveries + CASE WHEN p_status = 'delivered' THEN 1 ELSE 0 END,
    total_failures = total_failures + CASE WHEN p_status = 'failed' THEN 1 ELSE 0 END,
    last_delivery_at = CASE WHEN p_status = 'delivered' THEN NOW() ELSE last_delivery_at END,
    last_failure_at = CASE WHEN p_status = 'failed' THEN NOW() ELSE last_failure_at END
  WHERE id = (SELECT endpoint_id FROM webhook_deliveries WHERE id = p_delivery_id);
END;
$$ LANGUAGE plpgsql;

-- Function to create webhook delivery for all subscribers
CREATE OR REPLACE FUNCTION queue_webhook_event(
  p_merchant_id UUID,
  p_event_type TEXT,
  p_event_id TEXT,
  p_payload JSONB
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  INSERT INTO webhook_deliveries (endpoint_id, event_type, event_id, payload)
  SELECT id, p_event_type, p_event_id, p_payload
  FROM webhook_endpoints
  WHERE merchant_id = p_merchant_id
    AND is_active = true
    AND p_event_type = ANY(events);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;
