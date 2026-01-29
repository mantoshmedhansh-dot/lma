// =====================================================
// LMA Constants
// =====================================================

// API Versions
export const API_VERSION = 'v1';

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Order Status Flow
export const ORDER_STATUS_FLOW = [
  'pending',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'driver_assigned',
  'picked_up',
  'in_transit',
  'arrived',
  'delivered',
] as const;

export const CANCELLABLE_ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
] as const;

// Order Status Display
export const ORDER_STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  pending: { label: 'Order Placed', color: '#FFA500' },
  confirmed: { label: 'Confirmed', color: '#3B82F6' },
  preparing: { label: 'Preparing', color: '#8B5CF6' },
  ready_for_pickup: { label: 'Ready for Pickup', color: '#10B981' },
  driver_assigned: { label: 'Driver Assigned', color: '#06B6D4' },
  picked_up: { label: 'Picked Up', color: '#14B8A6' },
  in_transit: { label: 'On the Way', color: '#22C55E' },
  arrived: { label: 'Arrived', color: '#84CC16' },
  delivered: { label: 'Delivered', color: '#22C55E' },
  cancelled: { label: 'Cancelled', color: '#EF4444' },
  refunded: { label: 'Refunded', color: '#6B7280' },
};

// Payment Methods
export const PAYMENT_METHODS = {
  CARD: 'card',
  WALLET: 'wallet',
  CASH: 'cash',
  UPI: 'upi',
  NET_BANKING: 'net_banking',
} as const;

export const PAYMENT_METHOD_DISPLAY: Record<string, { label: string; icon: string }> = {
  card: { label: 'Credit/Debit Card', icon: 'credit-card' },
  wallet: { label: 'Wallet', icon: 'wallet' },
  cash: { label: 'Cash on Delivery', icon: 'banknote' },
  upi: { label: 'UPI', icon: 'smartphone' },
  net_banking: { label: 'Net Banking', icon: 'building' },
};

// Vehicle Types
export const VEHICLE_TYPES = {
  BICYCLE: 'bicycle',
  MOTORCYCLE: 'motorcycle',
  CAR: 'car',
  VAN: 'van',
  TRUCK: 'truck',
} as const;

export const VEHICLE_TYPE_DISPLAY: Record<string, { label: string; icon: string }> = {
  bicycle: { label: 'Bicycle', icon: 'bike' },
  motorcycle: { label: 'Motorcycle', icon: 'bike' },
  car: { label: 'Car', icon: 'car' },
  van: { label: 'Van', icon: 'truck' },
  truck: { label: 'Truck', icon: 'truck' },
};

// Merchant Types
export const MERCHANT_TYPES = {
  RESTAURANT: 'restaurant',
  GROCERY: 'grocery',
  PHARMACY: 'pharmacy',
  RETAIL: 'retail',
  OTHER: 'other',
} as const;

export const MERCHANT_TYPE_DISPLAY: Record<string, { label: string; icon: string }> = {
  restaurant: { label: 'Restaurant', icon: 'utensils' },
  grocery: { label: 'Grocery', icon: 'shopping-basket' },
  pharmacy: { label: 'Pharmacy', icon: 'pill' },
  retail: { label: 'Retail', icon: 'shopping-bag' },
  other: { label: 'Other', icon: 'store' },
};

// User Roles
export const USER_ROLES = {
  CUSTOMER: 'customer',
  DRIVER: 'driver',
  MERCHANT: 'merchant',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const;

// Days of Week
export const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

// Delivery Settings
export const DELIVERY = {
  MIN_ORDER_AMOUNT: 0,
  MAX_DELIVERY_RADIUS_KM: 50,
  DEFAULT_PREP_TIME_MINUTES: 30,
  BASE_DELIVERY_FEE: 30,
  PER_KM_RATE: 5,
  FREE_DELIVERY_THRESHOLD: 500,
  SERVICE_FEE_PERCENTAGE: 5,
  TAX_PERCENTAGE: 5,
} as const;

// Driver Settings
export const DRIVER = {
  DELIVERY_REQUEST_TIMEOUT_SECONDS: 60,
  LOCATION_UPDATE_INTERVAL_MS: 5000,
  MAX_CONCURRENT_DELIVERIES: 2,
  MIN_PAYOUT_AMOUNT: 100,
} as const;

// Rating
export const RATING = {
  MIN: 1,
  MAX: 5,
} as const;

// File Upload
export const FILE_UPLOAD = {
  MAX_SIZE_MB: 5,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'image/jpeg', 'image/png'],
} as const;

// Error Codes
export const ERROR_CODES = {
  // Auth
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Order
  MERCHANT_CLOSED: 'MERCHANT_CLOSED',
  BELOW_MINIMUM_ORDER: 'BELOW_MINIMUM_ORDER',
  OUT_OF_DELIVERY_RANGE: 'OUT_OF_DELIVERY_RANGE',
  PRODUCT_UNAVAILABLE: 'PRODUCT_UNAVAILABLE',
  ORDER_CANNOT_BE_CANCELLED: 'ORDER_CANNOT_BE_CANCELLED',

  // Payment
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  INVALID_COUPON: 'INVALID_COUPON',
  COUPON_EXPIRED: 'COUPON_EXPIRED',
  COUPON_USAGE_EXCEEDED: 'COUPON_USAGE_EXCEEDED',

  // Driver
  DRIVER_NOT_AVAILABLE: 'DRIVER_NOT_AVAILABLE',
  DELIVERY_EXPIRED: 'DELIVERY_EXPIRED',

  // General
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

// Regex Patterns
export const PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_INDIA: /^[6-9]\d{9}$/,
  POSTAL_CODE_INDIA: /^\d{6}$/,
  PAN: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
  GSTIN: /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/,
  IFSC: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  VEHICLE_NUMBER: /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/,
} as const;

// Storage Buckets
export const STORAGE_BUCKETS = {
  AVATARS: 'avatars',
  MERCHANT_LOGOS: 'merchant-logos',
  MERCHANT_COVERS: 'merchant-covers',
  PRODUCTS: 'products',
  DRIVER_DOCUMENTS: 'driver-documents',
  REVIEWS: 'reviews',
  CHAT: 'chat',
} as const;

// Notification Types
export const NOTIFICATION_TYPES = {
  ORDER: 'order',
  PROMOTION: 'promotion',
  SYSTEM: 'system',
  CHAT: 'chat',
} as const;

// Notification Templates
export const NOTIFICATION_TEMPLATES = {
  ORDER_CONFIRMED: {
    title: 'Order Confirmed',
    body: 'Your order #{orderNumber} has been confirmed by {merchantName}',
  },
  ORDER_PREPARING: {
    title: 'Preparing Your Order',
    body: '{merchantName} is preparing your order',
  },
  DRIVER_ASSIGNED: {
    title: 'Driver Assigned',
    body: '{driverName} is on the way to pick up your order',
  },
  ORDER_PICKED_UP: {
    title: 'Order Picked Up',
    body: 'Your order is on the way! Estimated arrival: {eta}',
  },
  ORDER_DELIVERED: {
    title: 'Order Delivered',
    body: 'Your order has been delivered. Enjoy your meal!',
  },
  ORDER_CANCELLED: {
    title: 'Order Cancelled',
    body: 'Your order #{orderNumber} has been cancelled',
  },
  NEW_DELIVERY_REQUEST: {
    title: 'New Delivery Request',
    body: 'New delivery from {merchantName} - ₹{earnings}',
  },
  NEW_ORDER_MERCHANT: {
    title: 'New Order!',
    body: 'New order #{orderNumber} received',
  },
} as const;
