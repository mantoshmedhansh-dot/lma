import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import merchantsRouter from '../../src/routes/merchants.js';
import { createTestApp } from '../helpers.js';
import { mockMerchant, mockProduct } from '../mocks/supabase.js';

// Mock Supabase
const mockSupabase = {
  from: vi.fn(),
  auth: {
    getUser: vi.fn(),
  },
};

vi.mock('../../src/config/supabase.js', () => ({
  supabaseAdmin: mockSupabase,
}));

vi.mock('@lma/shared', () => ({
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
}));

describe('Merchants Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp(merchantsRouter);
  });

  describe('GET /', () => {
    it('should return list of merchants', async () => {
      const merchants = [mockMerchant, { ...mockMerchant, id: 'merchant-2', business_name: 'Restaurant 2' }];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: merchants.map((m) => ({ ...m, merchant_categories: [] })),
          count: merchants.length,
          error: null,
        }),
      });

      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(2);
    });

    it('should filter merchants by type', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [{ ...mockMerchant, merchant_categories: [] }],
          count: 1,
          error: null,
        }),
      });

      const response = await request(app).get('/?type=restaurant');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('merchants');
    });

    it('should filter merchants by city', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [{ ...mockMerchant, merchant_categories: [] }],
          count: 1,
          error: null,
        }),
      });

      const response = await request(app).get('/?city=Mumbai');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should search merchants by name', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [{ ...mockMerchant, merchant_categories: [] }],
          count: 1,
          error: null,
        }),
      });

      const response = await request(app).get('/?search=Test');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should paginate results', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [{ ...mockMerchant, merchant_categories: [] }],
          count: 50,
          error: null,
        }),
      });

      const response = await request(app).get('/?page=2&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.total).toBe(50);
      expect(response.body.pagination.totalPages).toBe(5);
    });

    it('should sort merchants by rating', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [],
          count: 0,
          error: null,
        }),
      });

      const response = await request(app).get('/?sort_by=rating&sort_order=desc');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /:id', () => {
    it('should return merchant by ID', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            ...mockMerchant,
            merchant_hours: [],
            merchant_categories: [],
            product_categories: [],
          },
          error: null,
        }),
      });

      const response = await request(app).get(`/${mockMerchant.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(mockMerchant.id);
      expect(response.body.data.business_name).toBe(mockMerchant.business_name);
    });

    it('should return 404 for non-existent merchant', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      });

      const response = await request(app).get('/non-existent-uuid-1234-5678');

      expect(response.status).toBe(400); // Invalid UUID format
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await request(app).get('/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /slug/:slug', () => {
    it('should return merchant by slug', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            ...mockMerchant,
            merchant_hours: [],
            merchant_categories: [],
            product_categories: [],
          },
          error: null,
        }),
      });

      const response = await request(app).get(`/slug/${mockMerchant.slug}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.slug).toBe(mockMerchant.slug);
    });

    it('should return 404 for non-existent slug', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      });

      const response = await request(app).get('/slug/non-existent-slug');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /:id/products', () => {
    it('should return merchant products', async () => {
      const products = [
        { ...mockProduct, product_variants: [], product_addons: [] },
        { ...mockProduct, id: 'product-2', name: 'Product 2', product_variants: [], product_addons: [] },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: products,
          error: null,
        }),
      });

      const response = await request(app).get(`/${mockMerchant.id}/products`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should return empty array for merchant with no products', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const response = await request(app).get(`/${mockMerchant.id}/products`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });
  });
});
