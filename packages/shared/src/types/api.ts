// =====================================================
// LMA API Types
// Request and Response types for the API
// =====================================================

// Generic API Response
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Array<{
    field?: string;
    message: string;
  }>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

// Pagination Query
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// =====================================================
// Auth
// =====================================================

export interface SignUpRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  };
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface VerifyOtpRequest {
  phone: string;
  otp: string;
}

// =====================================================
// Users
// =====================================================

export interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

// =====================================================
// Addresses
// =====================================================

export interface CreateAddressRequest {
  label: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  is_default?: boolean;
  delivery_instructions?: string;
}

export interface UpdateAddressRequest extends Partial<CreateAddressRequest> {}

// =====================================================
// Merchants
// =====================================================

export interface MerchantFilters extends PaginationQuery {
  type?: string;
  category?: string;
  city?: string;
  search?: string;
  latitude?: number;
  longitude?: number;
  radius_km?: number;
  is_open?: boolean;
  min_rating?: number;
}

export interface MerchantListItem {
  id: string;
  business_name: string;
  slug: string;
  logo_url: string | null;
  cover_image_url: string | null;
  merchant_type: string;
  average_rating: number;
  total_ratings: number;
  estimated_prep_time: number;
  min_order_amount: number;
  delivery_radius_km: number;
  is_open: boolean;
  distance_km?: number;
  categories: Array<{ id: string; name: string }>;
}

export interface MerchantDetail extends MerchantListItem {
  description: string | null;
  phone: string;
  email: string;
  website: string | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  accepts_online_payment: boolean;
  accepts_cash: boolean;
  hours: Array<{
    day_of_week: string;
    open_time: string;
    close_time: string;
    is_closed: boolean;
  }>;
  product_categories: Array<{
    id: string;
    name: string;
    products: ProductListItem[];
  }>;
}

// =====================================================
// Products
// =====================================================

export interface ProductListItem {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  compare_at_price: number | null;
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_available: boolean;
  is_featured: boolean;
}

export interface ProductDetail extends ProductListItem {
  merchant_id: string;
  category_id: string | null;
  is_gluten_free: boolean;
  spice_level: number | null;
  calories: number | null;
  prep_time: number | null;
  variants: Array<{
    id: string;
    name: string;
    price_modifier: number;
    is_default: boolean;
    is_available: boolean;
  }>;
  addons: Array<{
    id: string;
    name: string;
    price: number;
    max_quantity: number;
    is_required: boolean;
    is_available: boolean;
  }>;
}

// =====================================================
// Cart
// =====================================================

export interface CartItem {
  product_id: string;
  variant_id?: string;
  quantity: number;
  addons?: Array<{
    addon_id: string;
    quantity: number;
  }>;
  special_instructions?: string;
}

export interface Cart {
  merchant_id: string;
  items: CartItem[];
}

export interface CartSummary {
  merchant: {
    id: string;
    business_name: string;
    logo_url: string | null;
  };
  items: Array<{
    product_id: string;
    product_name: string;
    product_image: string | null;
    variant_id: string | null;
    variant_name: string | null;
    unit_price: number;
    quantity: number;
    addons: Array<{
      addon_id: string;
      addon_name: string;
      unit_price: number;
      quantity: number;
      total_price: number;
    }>;
    item_total: number;
    special_instructions: string | null;
  }>;
  subtotal: number;
  delivery_fee: number;
  service_fee: number;
  tax_amount: number;
  total: number;
}

// =====================================================
// Orders
// =====================================================

export interface CreateOrderRequest {
  merchant_id: string;
  items: CartItem[];
  delivery_address_id: string;
  payment_method: string;
  coupon_code?: string;
  tip_amount?: number;
  customer_notes?: string;
  scheduled_for?: string;
}

export interface OrderFilters extends PaginationQuery {
  status?: string;
  from_date?: string;
  to_date?: string;
}

export interface OrderListItem {
  id: string;
  order_number: string;
  status: string;
  merchant: {
    id: string;
    business_name: string;
    logo_url: string | null;
  };
  total_amount: number;
  items_count: number;
  created_at: string;
  delivered_at: string | null;
}

export interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  merchant: {
    id: string;
    business_name: string;
    logo_url: string | null;
    phone: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
  };
  driver: {
    id: string;
    name: string;
    phone: string;
    avatar_url: string | null;
    vehicle_type: string;
    vehicle_number: string | null;
    current_latitude: number | null;
    current_longitude: number | null;
    average_rating: number;
  } | null;
  delivery_address: {
    label: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
  };
  items: Array<{
    id: string;
    product_name: string;
    variant_name: string | null;
    unit_price: number;
    quantity: number;
    total_price: number;
    addons: Array<{
      addon_name: string;
      quantity: number;
      total_price: number;
    }>;
    special_instructions: string | null;
  }>;
  subtotal: number;
  delivery_fee: number;
  service_fee: number;
  tax_amount: number;
  discount_amount: number;
  tip_amount: number;
  total_amount: number;
  coupon_code: string | null;
  payment_method: string;
  payment_status: string;
  estimated_delivery_time: number | null;
  scheduled_for: string | null;
  customer_notes: string | null;
  status_history: Array<{
    status: string;
    created_at: string;
    notes: string | null;
  }>;
  created_at: string;
  confirmed_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
}

// =====================================================
// Payments
// =====================================================

export interface CreatePaymentIntentRequest {
  order_id: string;
  payment_method: string;
}

export interface PaymentIntentResponse {
  client_secret: string;
  payment_intent_id: string;
}

export interface ConfirmPaymentRequest {
  payment_intent_id: string;
}

// =====================================================
// Reviews
// =====================================================

export interface CreateReviewRequest {
  order_id: string;
  rating: number;
  comment?: string;
  food_rating?: number;
  delivery_rating?: number;
  packaging_rating?: number;
}

// =====================================================
// Driver
// =====================================================

export interface DriverLocationUpdate {
  latitude: number;
  longitude: number;
}

export interface DeliveryRequest {
  id: string;
  order_number: string;
  pickup: {
    merchant_name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  dropoff: {
    address: string;
    latitude: number;
    longitude: number;
  };
  estimated_distance_km: number;
  estimated_earnings: number;
  items_count: number;
  expires_at: string;
}

export interface DriverEarningsSummary {
  today: number;
  this_week: number;
  this_month: number;
  total_deliveries: number;
  pending_payout: number;
}

// =====================================================
// Merchant Dashboard
// =====================================================

export interface MerchantOrderUpdate {
  status: 'confirmed' | 'preparing' | 'ready_for_pickup' | 'cancelled';
  notes?: string;
  estimated_prep_time?: number;
}

export interface CreateProductRequest {
  category_id?: string;
  name: string;
  description?: string;
  image_url?: string;
  price: number;
  compare_at_price?: number;
  sku?: string;
  stock_quantity?: number;
  track_inventory?: boolean;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  is_gluten_free?: boolean;
  spice_level?: number;
  calories?: number;
  prep_time?: number;
  is_available?: boolean;
  is_featured?: boolean;
  variants?: Array<{
    name: string;
    price_modifier: number;
    is_default?: boolean;
  }>;
  addons?: Array<{
    name: string;
    price: number;
    max_quantity?: number;
    is_required?: boolean;
  }>;
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {}

export interface MerchantAnalytics {
  period: {
    start: string;
    end: string;
  };
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  total_revenue: number;
  average_order_value: number;
  average_prep_time: number;
  average_rating: number;
  top_products: Array<{
    id: string;
    name: string;
    orders_count: number;
    revenue: number;
  }>;
  orders_by_day: Array<{
    date: string;
    orders: number;
    revenue: number;
  }>;
}

// =====================================================
// Search
// =====================================================

export interface SearchRequest {
  query: string;
  latitude?: number;
  longitude?: number;
  filters?: {
    type?: string[];
    categories?: string[];
    price_range?: { min: number; max: number };
    min_rating?: number;
    is_vegetarian?: boolean;
    is_vegan?: boolean;
  };
}

export interface SearchResponse {
  merchants: MerchantListItem[];
  products: Array<
    ProductListItem & {
      merchant: {
        id: string;
        business_name: string;
        slug: string;
      };
    }
  >;
}

// =====================================================
// Notifications
// =====================================================

export interface RegisterPushTokenRequest {
  token: string;
  device_type: 'ios' | 'android' | 'web';
  device_id?: string;
}

// =====================================================
// Realtime
// =====================================================

export interface OrderStatusUpdate {
  order_id: string;
  status: string;
  timestamp: string;
  driver?: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  };
  estimated_time?: number;
}

export interface DriverLocationBroadcast {
  order_id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  timestamp: string;
}
