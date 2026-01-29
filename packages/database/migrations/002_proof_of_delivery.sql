-- =====================================================
-- Migration: Proof of Delivery (POD) & Cash on Delivery (COD)
-- =====================================================

-- Create delivery type enum
CREATE TYPE delivery_type AS ENUM ('standard', 'contactless', 'handed');

-- Create COD status enum
CREATE TYPE cod_status AS ENUM ('pending', 'collected', 'deposited', 'reconciled');

-- =====================================================
-- PROOF OF DELIVERY TABLE
-- =====================================================

CREATE TABLE proof_of_delivery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id),

  -- Delivery type
  delivery_type delivery_type NOT NULL DEFAULT 'standard',

  -- Photo proofs (stored in Supabase Storage)
  photo_urls TEXT[] DEFAULT '{}',

  -- Signature (stored in Supabase Storage)
  signature_url TEXT,

  -- Delivery notes
  notes TEXT,

  -- Location at delivery
  delivery_latitude DECIMAL(10, 8),
  delivery_longitude DECIMAL(11, 8),

  -- COD details
  cod_collected BOOLEAN,
  cod_amount DECIMAL(10, 2),
  cod_collection_method VARCHAR(50), -- 'cash', 'upi', 'card'

  -- Recipient info
  recipient_name VARCHAR(255),
  recipient_relationship VARCHAR(100), -- 'self', 'family', 'security', 'neighbor'

  -- Timestamps
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX idx_pod_order_id ON proof_of_delivery(order_id);
CREATE INDEX idx_pod_driver_id ON proof_of_delivery(driver_id);
CREATE INDEX idx_pod_completed_at ON proof_of_delivery(completed_at DESC);

-- Enable RLS
ALTER TABLE proof_of_delivery ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Drivers can insert POD for their deliveries"
  ON proof_of_delivery FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM drivers WHERE id = driver_id)
  );

CREATE POLICY "Drivers can view their POD records"
  ON proof_of_delivery FOR SELECT
  USING (
    auth.uid() IN (SELECT user_id FROM drivers WHERE id = driver_id)
  );

CREATE POLICY "Customers can view POD for their orders"
  ON proof_of_delivery FOR SELECT
  USING (
    auth.uid() IN (SELECT customer_id FROM orders WHERE id = order_id)
  );

CREATE POLICY "Merchants can view POD for their orders"
  ON proof_of_delivery FOR SELECT
  USING (
    auth.uid() IN (
      SELECT m.user_id FROM merchants m
      JOIN orders o ON o.merchant_id = m.id
      WHERE o.id = order_id
    )
  );

-- =====================================================
-- COD COLLECTIONS TABLE
-- =====================================================

CREATE TABLE cod_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES drivers(id),
  order_id UUID NOT NULL REFERENCES orders(id),

  -- Amount details
  expected_amount DECIMAL(10, 2) NOT NULL,
  collected_amount DECIMAL(10, 2) NOT NULL,
  difference_amount DECIMAL(10, 2) GENERATED ALWAYS AS (collected_amount - expected_amount) STORED,

  -- Collection details
  collection_method VARCHAR(50) DEFAULT 'cash',
  reference_number VARCHAR(100), -- UPI ref or receipt number

  -- Status tracking
  status cod_status DEFAULT 'collected',

  -- Deposit details
  deposited_at TIMESTAMPTZ,
  deposit_reference VARCHAR(255),
  deposit_account VARCHAR(100),

  -- Reconciliation
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID REFERENCES users(id),
  reconciliation_notes TEXT,

  -- Timestamps
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_cod_driver_id ON cod_collections(driver_id);
CREATE INDEX idx_cod_order_id ON cod_collections(order_id);
CREATE INDEX idx_cod_status ON cod_collections(status);
CREATE INDEX idx_cod_collected_at ON cod_collections(collected_at DESC);

-- Enable RLS
ALTER TABLE cod_collections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for COD collections
CREATE POLICY "Drivers can insert COD collections"
  ON cod_collections FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM drivers WHERE id = driver_id)
  );

CREATE POLICY "Drivers can view their COD collections"
  ON cod_collections FOR SELECT
  USING (
    auth.uid() IN (SELECT user_id FROM drivers WHERE id = driver_id)
  );

CREATE POLICY "Admins can manage COD collections"
  ON cod_collections FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM users WHERE role IN ('admin', 'super_admin'))
  );

-- =====================================================
-- DRIVER COD BALANCE TABLE
-- =====================================================

CREATE TABLE driver_cod_balance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID UNIQUE NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

  -- Current balance
  pending_amount DECIMAL(10, 2) DEFAULT 0, -- Collected but not deposited
  total_collected DECIMAL(10, 2) DEFAULT 0, -- All time collected
  total_deposited DECIMAL(10, 2) DEFAULT 0, -- All time deposited

  -- Daily limits
  daily_collection_limit DECIMAL(10, 2) DEFAULT 10000,
  today_collected DECIMAL(10, 2) DEFAULT 0,
  last_collection_date DATE,

  -- Last deposit info
  last_deposit_at TIMESTAMPTZ,
  last_deposit_amount DECIMAL(10, 2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE driver_cod_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view own COD balance"
  ON driver_cod_balance FOR SELECT
  USING (
    auth.uid() IN (SELECT user_id FROM drivers WHERE id = driver_id)
  );

-- =====================================================
-- ADD COLUMNS TO EXISTING TABLES
-- =====================================================

-- Add COD-related columns to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_cod BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cod_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS cod_status cod_status;

-- Add POD reference to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES proof_of_delivery(id);

-- Add payment method to orders if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_method_type'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_method_type VARCHAR(20) DEFAULT 'online';
  END IF;
END $$;

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update driver COD balance when collection is made
CREATE OR REPLACE FUNCTION update_driver_cod_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update driver COD balance
  INSERT INTO driver_cod_balance (driver_id, pending_amount, total_collected, today_collected, last_collection_date)
  VALUES (
    NEW.driver_id,
    NEW.collected_amount,
    NEW.collected_amount,
    NEW.collected_amount,
    CURRENT_DATE
  )
  ON CONFLICT (driver_id) DO UPDATE SET
    pending_amount = driver_cod_balance.pending_amount + NEW.collected_amount,
    total_collected = driver_cod_balance.total_collected + NEW.collected_amount,
    today_collected = CASE
      WHEN driver_cod_balance.last_collection_date = CURRENT_DATE
      THEN driver_cod_balance.today_collected + NEW.collected_amount
      ELSE NEW.collected_amount
    END,
    last_collection_date = CURRENT_DATE,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cod_balance_on_collection
  AFTER INSERT ON cod_collections
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_cod_balance();

-- Function to update COD balance when deposit is made
CREATE OR REPLACE FUNCTION update_cod_balance_on_deposit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'deposited' AND OLD.status = 'collected' THEN
    UPDATE driver_cod_balance
    SET
      pending_amount = pending_amount - NEW.collected_amount,
      total_deposited = total_deposited + NEW.collected_amount,
      last_deposit_at = NOW(),
      last_deposit_amount = NEW.collected_amount,
      updated_at = NOW()
    WHERE driver_id = NEW.driver_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cod_balance_on_deposit
  AFTER UPDATE ON cod_collections
  FOR EACH ROW
  EXECUTE FUNCTION update_cod_balance_on_deposit();

-- Function to link POD to order
CREATE OR REPLACE FUNCTION link_pod_to_order()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE orders
  SET pod_id = NEW.id
  WHERE id = NEW.order_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER link_pod_to_order_trigger
  AFTER INSERT ON proof_of_delivery
  FOR EACH ROW
  EXECUTE FUNCTION link_pod_to_order();

-- =====================================================
-- STORAGE BUCKET SETUP (run in Supabase dashboard)
-- =====================================================

-- Create storage bucket for delivery proofs
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('deliveries', 'deliveries', true);

-- Storage policies for deliveries bucket
-- CREATE POLICY "Drivers can upload POD files"
--   ON storage.objects FOR INSERT
--   WITH CHECK (
--     bucket_id = 'deliveries'
--     AND auth.uid() IN (SELECT user_id FROM drivers WHERE is_active = true)
--   );

-- CREATE POLICY "Anyone can view POD files"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'deliveries');

-- =====================================================
-- SAMPLE DATA FOR TESTING
-- =====================================================

-- Note: Run these after creating test orders and drivers

-- Example POD record:
-- INSERT INTO proof_of_delivery (
--   order_id, driver_id, delivery_type, photo_urls, notes,
--   cod_collected, cod_amount, completed_at
-- ) VALUES (
--   'order-uuid', 'driver-uuid', 'handed',
--   ARRAY['https://storage.url/pod/photo1.jpg'],
--   'Delivered to customer at front door',
--   true, 599.00, NOW()
-- );
