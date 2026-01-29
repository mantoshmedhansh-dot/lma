// =====================================================
// LMA Database Types
// Auto-generated types should replace this file
// Run: pnpm db:generate-types
// =====================================================

// Enums
export type UserRole = 'customer' | 'driver' | 'merchant' | 'admin' | 'super_admin';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'driver_assigned'
  | 'picked_up'
  | 'in_transit'
  | 'arrived'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export type PaymentMethod = 'card' | 'wallet' | 'cash' | 'upi' | 'net_banking';

export type VehicleType = 'bicycle' | 'motorcycle' | 'car' | 'van' | 'truck';

export type DriverStatus = 'offline' | 'online' | 'busy' | 'on_delivery';

export type MerchantStatus = 'pending' | 'active' | 'suspended' | 'closed';

export type MerchantType = 'restaurant' | 'grocery' | 'pharmacy' | 'retail' | 'other';

export type NotificationType = 'order' | 'promotion' | 'system' | 'chat';

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

// Base entity with common fields
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at?: string;
}

// User
export interface User extends BaseEntity {
  email: string;
  phone: string | null;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  role: UserRole;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  is_active: boolean;
  last_login_at: string | null;
}

// Address
export interface Address extends BaseEntity {
  user_id: string;
  label: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  delivery_instructions: string | null;
}

// Merchant
export interface Merchant extends BaseEntity {
  user_id: string;
  business_name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  merchant_type: MerchantType;
  status: MerchantStatus;
  phone: string;
  email: string;
  website: string | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  tax_id: string | null;
  commission_rate: number;
  average_rating: number;
  total_ratings: number;
  min_order_amount: number;
  estimated_prep_time: number;
  delivery_radius_km: number;
  is_featured: boolean;
  accepts_online_payment: boolean;
  accepts_cash: boolean;
}

// Merchant Hours
export interface MerchantHours {
  id: string;
  merchant_id: string;
  day_of_week: DayOfWeek;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

// Category
export interface Category extends BaseEntity {
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  parent_id: string | null;
  display_order: number;
  is_active: boolean;
}

// Product Category (within merchant)
export interface ProductCategory extends BaseEntity {
  merchant_id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
}

// Product
export interface Product extends BaseEntity {
  merchant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  compare_at_price: number | null;
  sku: string | null;
  stock_quantity: number | null;
  track_inventory: boolean;
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_gluten_free: boolean;
  spice_level: number | null;
  calories: number | null;
  prep_time: number | null;
  is_available: boolean;
  is_featured: boolean;
  display_order: number;
}

// Product Variant
export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  price_modifier: number;
  is_default: boolean;
  is_available: boolean;
  display_order: number;
}

// Product Addon
export interface ProductAddon {
  id: string;
  product_id: string;
  name: string;
  price: number;
  max_quantity: number;
  is_required: boolean;
  is_available: boolean;
  display_order: number;
}

// Driver
export interface Driver extends BaseEntity {
  user_id: string;
  vehicle_type: VehicleType;
  vehicle_number: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  license_number: string;
  license_expiry: string;
  license_image_url: string | null;
  id_proof_type: string | null;
  id_proof_number: string | null;
  id_proof_image_url: string | null;
  status: DriverStatus;
  is_verified: boolean;
  is_active: boolean;
  current_latitude: number | null;
  current_longitude: number | null;
  last_location_update: string | null;
  average_rating: number;
  total_ratings: number;
  total_deliveries: number;
  wallet_balance: number;
}

// Order
export interface Order extends BaseEntity {
  order_number: string;
  customer_id: string;
  merchant_id: string;
  driver_id: string | null;
  status: OrderStatus;
  delivery_address_id: string | null;
  delivery_address_snapshot: AddressSnapshot;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  delivery_instructions: string | null;
  pickup_address_snapshot: AddressSnapshot;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  subtotal: number;
  delivery_fee: number;
  service_fee: number;
  tax_amount: number;
  discount_amount: number;
  tip_amount: number;
  total_amount: number;
  coupon_id: string | null;
  coupon_code: string | null;
  estimated_prep_time: number | null;
  estimated_delivery_time: number | null;
  scheduled_for: string | null;
  confirmed_at: string | null;
  preparing_at: string | null;
  ready_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  customer_notes: string | null;
  merchant_notes: string | null;
}

// Address Snapshot (stored with order)
export interface AddressSnapshot {
  label: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

// Order Item
export interface OrderItem extends BaseEntity {
  order_id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  unit_price: number;
  quantity: number;
  total_price: number;
  special_instructions: string | null;
}

// Order Item Addon
export interface OrderItemAddon {
  id: string;
  order_item_id: string;
  addon_id: string;
  addon_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

// Order Status History
export interface OrderStatusHistory {
  id: string;
  order_id: string;
  status: OrderStatus;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
}

// Payment
export interface Payment extends BaseEntity {
  order_id: string;
  user_id: string;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  gateway_provider: string | null;
  gateway_payment_id: string | null;
  gateway_order_id: string | null;
  gateway_signature: string | null;
  card_last_four: string | null;
  card_brand: string | null;
  paid_at: string | null;
  failed_at: string | null;
  refunded_at: string | null;
  refund_amount: number | null;
  refund_reason: string | null;
  metadata: Record<string, unknown> | null;
}

// Coupon
export interface Coupon extends BaseEntity {
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_discount_amount: number | null;
  min_order_amount: number;
  starts_at: string;
  expires_at: string;
  total_usage_limit: number | null;
  per_user_limit: number;
  current_usage: number;
  merchant_id: string | null;
  applicable_categories: string[] | null;
  first_order_only: boolean;
  is_active: boolean;
}

// Review
export interface Review extends BaseEntity {
  order_id: string;
  user_id: string;
  merchant_id: string | null;
  driver_id: string | null;
  rating: number;
  comment: string | null;
  food_rating: number | null;
  delivery_rating: number | null;
  packaging_rating: number | null;
  merchant_response: string | null;
  merchant_responded_at: string | null;
  is_visible: boolean;
}

// Notification
export interface Notification extends BaseEntity {
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
}

// Wallet
export interface Wallet extends BaseEntity {
  user_id: string;
  balance: number;
  currency: string;
  is_active: boolean;
}

// Wallet Transaction
export interface WalletTransaction {
  id: string;
  wallet_id: string;
  amount: number;
  transaction_type: 'credit' | 'debit';
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  balance_after: number;
  created_at: string;
}

// Conversation
export interface Conversation extends BaseEntity {
  order_id: string;
  customer_id: string;
  driver_id: string | null;
  is_active: boolean;
}

// Message
export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'location';
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

// Service Zone
export interface ServiceZone extends BaseEntity {
  name: string;
  city: string;
  state: string;
  is_active: boolean;
  base_delivery_fee: number;
  per_km_rate: number;
  surge_multiplier: number;
}
