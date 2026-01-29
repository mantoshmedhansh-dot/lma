import { vi } from 'vitest';

// Mock user data
export const mockUser = {
  id: 'test-user-id-123',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  phone: '+1234567890',
  role: 'customer',
  is_active: true,
  created_at: '2024-01-01T00:00:00.000Z',
};

export const mockMerchant = {
  id: 'test-merchant-id-123',
  business_name: 'Test Restaurant',
  slug: 'test-restaurant',
  logo_url: 'https://example.com/logo.png',
  cover_image_url: 'https://example.com/cover.png',
  merchant_type: 'restaurant',
  average_rating: 4.5,
  total_ratings: 100,
  estimated_prep_time: 30,
  min_order_amount: 100,
  delivery_radius_km: 10,
  city: 'Mumbai',
  state: 'Maharashtra',
  country: 'India',
  latitude: 19.076,
  longitude: 72.8777,
  status: 'active',
  address_line_1: '123 Test Street',
  postal_code: '400001',
  phone: '+919876543210',
};

export const mockProduct = {
  id: 'test-product-id-123',
  merchant_id: mockMerchant.id,
  name: 'Test Product',
  description: 'A test product',
  price: 250,
  image_url: 'https://example.com/product.png',
  is_vegetarian: true,
  is_vegan: false,
  is_available: true,
  is_featured: true,
  display_order: 1,
};

export const mockAddress = {
  id: 'test-address-id-123',
  user_id: mockUser.id,
  label: 'Home',
  address_line_1: '456 Test Lane',
  address_line_2: 'Apt 2',
  city: 'Mumbai',
  state: 'Maharashtra',
  postal_code: '400002',
  country: 'India',
  latitude: 19.08,
  longitude: 72.88,
  delivery_instructions: 'Ring bell twice',
};

export const mockOrder = {
  id: 'test-order-id-123',
  order_number: 'LMA-2024-000001',
  customer_id: mockUser.id,
  merchant_id: mockMerchant.id,
  status: 'pending',
  subtotal: 500,
  delivery_fee: 40,
  service_fee: 25,
  tax_amount: 50,
  discount_amount: 0,
  tip_amount: 20,
  total_amount: 635,
  created_at: '2024-01-15T10:00:00.000Z',
};

// Create chainable mock query builder
export function createMockQueryBuilder(returnData: unknown = null, returnError: unknown = null) {
  const builder: Record<string, unknown> = {};

  const chainMethods = [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'like',
    'ilike',
    'in',
    'contains',
    'containedBy',
    'range',
    'order',
    'limit',
    'single',
    'or',
  ];

  chainMethods.forEach((method) => {
    builder[method] = vi.fn().mockReturnValue(builder);
  });

  // Terminal methods return the result
  builder.then = vi.fn((resolve) =>
    resolve({ data: returnData, error: returnError, count: Array.isArray(returnData) ? returnData.length : null })
  );

  // Make it awaitable
  (builder as { data: unknown; error: unknown; count: number | null }).data = returnData;
  (builder as { data: unknown; error: unknown; count: number | null }).error = returnError;
  (builder as { data: unknown; error: unknown; count: number | null }).count = Array.isArray(returnData) ? returnData.length : null;

  return builder;
}

// Mock Supabase client factory
export function createMockSupabaseClient() {
  return {
    from: vi.fn(() => createMockQueryBuilder()),
    auth: {
      admin: {
        createUser: vi.fn(),
        deleteUser: vi.fn(),
        updateUserById: vi.fn(),
        generateLink: vi.fn(),
        signOut: vi.fn(),
      },
      signInWithPassword: vi.fn(),
      refreshSession: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      getUser: vi.fn(),
    },
    rpc: vi.fn(),
  };
}

// Mock session data
export const mockSession = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_at: Date.now() + 3600000,
  user: {
    id: mockUser.id,
    email: mockUser.email,
  },
};
