-- =====================================================
-- 010: Reverse Pickups (Customer → Hub Returns)
-- =====================================================
-- Adds reverse_pickups and pickup_attempts tables for
-- handling product returns/pickups from customers.

-- Reverse Pickups table
CREATE TABLE IF NOT EXISTS reverse_pickups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hub_id UUID NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  pickup_number VARCHAR(20) NOT NULL UNIQUE,

  -- Link to original delivery order (optional)
  original_order_id UUID REFERENCES delivery_orders(id),

  -- Source tracking
  source VARCHAR(20) NOT NULL DEFAULT 'manual',  -- manual, cjdquick, api
  external_order_id VARCHAR(100),
  external_source VARCHAR(50),
  external_return_id VARCHAR(100),

  -- Return reason
  return_reason TEXT,
  return_notes TEXT,

  -- Customer info
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_email VARCHAR(255),

  -- Pickup address
  pickup_address TEXT NOT NULL,
  pickup_city VARCHAR(100),
  pickup_state VARCHAR(100),
  pickup_postal_code VARCHAR(20),
  pickup_latitude DOUBLE PRECISION,
  pickup_longitude DOUBLE PRECISION,

  -- Product info
  product_description TEXT NOT NULL,
  product_sku VARCHAR(100),
  package_count INT DEFAULT 1,
  total_weight_kg DOUBLE PRECISION,

  -- Status flow: pickup_pending → assigned → out_for_pickup → picked_up → received_at_hub (or cancelled)
  status VARCHAR(30) NOT NULL DEFAULT 'pickup_pending',

  -- Assignment
  route_id UUID,
  driver_id UUID,
  scheduled_date DATE,
  pickup_slot VARCHAR(50),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  out_for_pickup_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  received_at_hub_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reverse_pickups_hub_status
  ON reverse_pickups (hub_id, status);

CREATE INDEX IF NOT EXISTS idx_reverse_pickups_driver
  ON reverse_pickups (driver_id, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_reverse_pickups_original_order
  ON reverse_pickups (original_order_id);

CREATE INDEX IF NOT EXISTS idx_reverse_pickups_external
  ON reverse_pickups (external_source, external_order_id);

CREATE INDEX IF NOT EXISTS idx_reverse_pickups_created
  ON reverse_pickups (created_at DESC);


-- Pickup Attempts table
CREATE TABLE IF NOT EXISTS pickup_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pickup_id UUID NOT NULL REFERENCES reverse_pickups(id) ON DELETE CASCADE,
  driver_id UUID,
  attempt_number INT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL,  -- 'picked_up' or 'failed'

  -- OTP verification
  otp_verified BOOLEAN DEFAULT false,
  otp_verified_at TIMESTAMPTZ,

  -- Failure info
  failure_reason VARCHAR(50),
  failure_notes TEXT,

  -- Item condition (key differentiator from delivery attempts)
  item_condition VARCHAR(30),  -- good, damaged, opened, missing_parts
  item_condition_notes TEXT,
  condition_photo_urls TEXT[],  -- min 2 required for successful pickup

  -- Standard proof
  photo_urls TEXT[],
  signature_url TEXT,
  recipient_name VARCHAR(255),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pickup_attempts_pickup
  ON pickup_attempts (pickup_id, attempt_number);


-- Enable RLS
ALTER TABLE reverse_pickups ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_attempts ENABLE ROW LEVEL SECURITY;

-- Policies: service role can do everything
CREATE POLICY "Service role full access on reverse_pickups"
  ON reverse_pickups FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on pickup_attempts"
  ON pickup_attempts FOR ALL
  USING (true) WITH CHECK (true);
