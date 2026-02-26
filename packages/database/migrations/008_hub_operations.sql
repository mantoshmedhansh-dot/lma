-- =====================================================
-- Migration 008: Hub Operations System
-- Transforms LMA from marketplace to Delivery Hub Operations
-- =====================================================

-- =====================================================
-- 1. DELIVERY HUBS
-- =====================================================
CREATE TABLE IF NOT EXISTS hubs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  postal_code VARCHAR(10) NOT NULL,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  manager_id UUID REFERENCES users(id),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. HUB VEHICLES (fleet at each hub)
-- =====================================================
CREATE TABLE IF NOT EXISTS hub_vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hub_id UUID NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  vehicle_type VARCHAR(50) NOT NULL,
  plate_number VARCHAR(20) NOT NULL,
  capacity_kg DECIMAL(8,2),
  capacity_volume_cft DECIMAL(8,2),
  make_model VARCHAR(100),
  status VARCHAR(20) DEFAULT 'available',
  assigned_driver_id UUID REFERENCES drivers(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. ORDER IMPORTS (bulk upload tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS order_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hub_id UUID NOT NULL REFERENCES hubs(id),
  uploaded_by UUID NOT NULL REFERENCES users(id),
  source VARCHAR(20) NOT NULL,
  file_url TEXT,
  file_name VARCHAR(255),
  total_records INTEGER DEFAULT 0,
  processed INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  error_log JSONB,
  status VARCHAR(20) DEFAULT 'processing',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- =====================================================
-- 4. DELIVERY ROUTES
-- =====================================================
CREATE TABLE IF NOT EXISTS delivery_routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hub_id UUID NOT NULL REFERENCES hubs(id),
  route_name VARCHAR(100),
  vehicle_id UUID REFERENCES hub_vehicles(id),
  driver_id UUID REFERENCES drivers(id),
  route_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'planned',
  total_stops INTEGER DEFAULT 0,
  total_distance_km DECIMAL(8,2),
  estimated_duration_mins INTEGER,
  total_weight_kg DECIMAL(8,2),
  total_volume_cft DECIMAL(8,2),
  optimized_polyline TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. DELIVERY ORDERS (replaces marketplace orders)
-- =====================================================
CREATE TABLE IF NOT EXISTS delivery_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hub_id UUID NOT NULL REFERENCES hubs(id),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  source VARCHAR(20) NOT NULL,
  import_batch_id UUID REFERENCES order_imports(id),

  -- Seller info
  seller_name VARCHAR(255),
  seller_order_ref VARCHAR(100),
  marketplace VARCHAR(50),

  -- Customer info
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_alt_phone VARCHAR(20),
  customer_email VARCHAR(255),

  -- Delivery address
  delivery_address TEXT NOT NULL,
  delivery_city VARCHAR(100),
  delivery_state VARCHAR(100),
  delivery_postal_code VARCHAR(10),
  delivery_latitude DECIMAL(10,8),
  delivery_longitude DECIMAL(11,8),

  -- Product info
  product_description TEXT NOT NULL,
  product_sku VARCHAR(100),
  product_category VARCHAR(100),
  package_count INTEGER DEFAULT 1,
  total_weight_kg DECIMAL(8,2),
  total_volume_cft DECIMAL(8,2),

  -- Payment
  is_cod BOOLEAN DEFAULT false,
  cod_amount DECIMAL(10,2) DEFAULT 0,
  declared_value DECIMAL(10,2),

  -- Status
  status VARCHAR(30) DEFAULT 'pending',
  priority VARCHAR(10) DEFAULT 'normal',

  -- Assignment
  route_id UUID REFERENCES delivery_routes(id),
  driver_id UUID REFERENCES drivers(id),

  -- Delivery slot
  scheduled_date DATE,
  delivery_slot VARCHAR(20),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  out_for_delivery_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. ROUTE STOPS (ordered stops within a route)
-- =====================================================
CREATE TABLE IF NOT EXISTS route_stops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID NOT NULL REFERENCES delivery_routes(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES delivery_orders(id),
  sequence INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  planned_eta TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  actual_departure TIMESTAMPTZ,
  distance_from_prev_km DECIMAL(8,2),
  duration_from_prev_mins INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. DELIVERY ATTEMPTS (each try at a stop)
-- =====================================================
CREATE TABLE IF NOT EXISTS delivery_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES delivery_orders(id),
  route_stop_id UUID REFERENCES route_stops(id),
  driver_id UUID NOT NULL REFERENCES drivers(id),
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL,

  -- OTP
  delivery_otp VARCHAR(6),
  return_otp VARCHAR(6),
  otp_verified BOOLEAN DEFAULT false,
  otp_sent_at TIMESTAMPTZ,
  otp_verified_at TIMESTAMPTZ,

  -- Failure reason
  failure_reason VARCHAR(50),
  failure_notes TEXT,

  -- Proof
  photo_urls TEXT[],
  signature_url TEXT,
  recipient_name VARCHAR(255),

  -- COD
  cod_collected BOOLEAN DEFAULT false,
  cod_amount DECIMAL(10,2),

  -- Location
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 8. OTP TOKENS
-- =====================================================
CREATE TABLE IF NOT EXISTS otp_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES delivery_orders(id),
  otp_code VARCHAR(6) NOT NULL,
  otp_type VARCHAR(20) NOT NULL,
  sent_to VARCHAR(20) NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- MODIFY EXISTING TABLES
-- =====================================================

-- Add hub_id to drivers
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS hub_id UUID REFERENCES hubs(id);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS daily_capacity_orders INTEGER DEFAULT 20;

-- =====================================================
-- INDEXES
-- =====================================================

-- Hubs
CREATE INDEX IF NOT EXISTS idx_hubs_code ON hubs(code);
CREATE INDEX IF NOT EXISTS idx_hubs_manager ON hubs(manager_id);
CREATE INDEX IF NOT EXISTS idx_hubs_active ON hubs(is_active);

-- Hub Vehicles
CREATE INDEX IF NOT EXISTS idx_hub_vehicles_hub ON hub_vehicles(hub_id);
CREATE INDEX IF NOT EXISTS idx_hub_vehicles_status ON hub_vehicles(status);
CREATE INDEX IF NOT EXISTS idx_hub_vehicles_driver ON hub_vehicles(assigned_driver_id);

-- Delivery Orders
CREATE INDEX IF NOT EXISTS idx_delivery_orders_hub ON delivery_orders(hub_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_status ON delivery_orders(status);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_route ON delivery_orders(route_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_driver ON delivery_orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_date ON delivery_orders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_number ON delivery_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_import ON delivery_orders(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_created ON delivery_orders(created_at DESC);

-- Order Imports
CREATE INDEX IF NOT EXISTS idx_order_imports_hub ON order_imports(hub_id);
CREATE INDEX IF NOT EXISTS idx_order_imports_status ON order_imports(status);

-- Delivery Routes
CREATE INDEX IF NOT EXISTS idx_delivery_routes_hub ON delivery_routes(hub_id);
CREATE INDEX IF NOT EXISTS idx_delivery_routes_date ON delivery_routes(route_date);
CREATE INDEX IF NOT EXISTS idx_delivery_routes_status ON delivery_routes(status);
CREATE INDEX IF NOT EXISTS idx_delivery_routes_driver ON delivery_routes(driver_id);

-- Route Stops
CREATE INDEX IF NOT EXISTS idx_route_stops_route ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_order ON route_stops(order_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_status ON route_stops(status);

-- Delivery Attempts
CREATE INDEX IF NOT EXISTS idx_delivery_attempts_order ON delivery_attempts(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_attempts_driver ON delivery_attempts(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_attempts_stop ON delivery_attempts(route_stop_id);

-- OTP Tokens
CREATE INDEX IF NOT EXISTS idx_otp_tokens_order ON otp_tokens(order_id);
CREATE INDEX IF NOT EXISTS idx_otp_tokens_code ON otp_tokens(otp_code);

-- Drivers hub
CREATE INDEX IF NOT EXISTS idx_drivers_hub ON drivers(hub_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at for new tables
CREATE TRIGGER update_hubs_updated_at
  BEFORE UPDATE ON hubs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_orders_updated_at
  BEFORE UPDATE ON delivery_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_routes_updated_at
  BEFORE UPDATE ON delivery_routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-generate delivery order number
CREATE OR REPLACE FUNCTION generate_delivery_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number = 'DH-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_delivery_order_number
  BEFORE INSERT ON delivery_orders
  FOR EACH ROW EXECUTE FUNCTION generate_delivery_order_number();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_tokens ENABLE ROW LEVEL SECURITY;

-- Service role bypass (API uses service role key)
CREATE POLICY "Service role full access on hubs"
  ON hubs FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on hub_vehicles"
  ON hub_vehicles FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on order_imports"
  ON order_imports FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on delivery_routes"
  ON delivery_routes FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on delivery_orders"
  ON delivery_orders FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on route_stops"
  ON route_stops FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on delivery_attempts"
  ON delivery_attempts FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on otp_tokens"
  ON otp_tokens FOR ALL
  USING (true)
  WITH CHECK (true);
