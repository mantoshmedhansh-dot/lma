import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Custom providers wrapper
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

// Custom render function
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: AllTheProviders, ...options }),
  };
};

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Test data factories
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  phone: '+1234567890',
  role: 'customer',
  avatar_url: null,
  created_at: '2024-01-01T00:00:00.000Z',
};

export const mockMerchant = {
  id: 'test-merchant-id',
  business_name: 'Test Restaurant',
  slug: 'test-restaurant',
  logo_url: 'https://example.com/logo.png',
  cover_image_url: 'https://example.com/cover.png',
  merchant_type: 'restaurant',
  average_rating: 4.5,
  total_ratings: 100,
  estimated_prep_time: 30,
  min_order_amount: 100,
  city: 'Mumbai',
  status: 'active',
  is_open: true,
  categories: [],
};

export const mockProduct = {
  id: 'test-product-id',
  name: 'Test Product',
  description: 'A test product description',
  price: 250,
  image_url: 'https://example.com/product.png',
  is_vegetarian: true,
  is_vegan: false,
  is_available: true,
  is_featured: false,
};

export const mockAddress = {
  id: 'test-address-id',
  label: 'Home',
  address_line_1: '123 Test Street',
  address_line_2: 'Apt 4',
  city: 'Mumbai',
  state: 'Maharashtra',
  postal_code: '400001',
  country: 'India',
  latitude: 19.076,
  longitude: 72.877,
  is_default: true,
};

export const mockOrder = {
  id: 'test-order-id',
  order_number: 'LMA-2024-000001',
  status: 'pending',
  total_amount: 635,
  created_at: '2024-01-15T10:00:00.000Z',
  merchant: mockMerchant,
  items_count: 2,
};

// Helper to wait for async operations
export const waitFor = async (callback: () => void, timeout = 1000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      callback();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  callback();
};
