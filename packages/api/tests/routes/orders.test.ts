import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import ordersRouter from '../../src/routes/orders.js';
import { createTestApp, createAuthHeader } from '../helpers.js';
import { mockUser, mockMerchant, mockProduct, mockAddress, mockOrder } from '../mocks/supabase.js';

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
  ERROR_CODES: {
    NOT_FOUND: 'NOT_FOUND',
    PRODUCT_UNAVAILABLE: 'PRODUCT_UNAVAILABLE',
    BELOW_MINIMUM_ORDER: 'BELOW_MINIMUM_ORDER',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    ORDER_CANNOT_BE_CANCELLED: 'ORDER_CANNOT_BE_CANCELLED',
  },
  CANCELLABLE_ORDER_STATUSES: ['pending', 'confirmed'],
  calculateOrderTotals: vi.fn((subtotal, deliveryFee, discountAmount, tipAmount) => ({
    subtotal,
    deliveryFee,
    serviceFee: Math.round(subtotal * 0.05),
    taxAmount: Math.round(subtotal * 0.1),
    discountAmount,
    tipAmount,
    total: subtotal + deliveryFee + Math.round(subtotal * 0.05) + Math.round(subtotal * 0.1) - discountAmount + tipAmount,
  })),
  calculateDeliveryFee: vi.fn(() => 40),
}));

// Mock auth middleware
vi.mock('../../src/middleware/auth.js', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(Object.assign(new Error('Unauthorized'), { statusCode: 401, code: 'UNAUTHORIZED' }));
    }
    req.user = mockUser;
    req.accessToken = authHeader.split(' ')[1];
    next();
  },
  requireCustomer: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    if (req.user?.role !== 'customer') {
      return next(Object.assign(new Error('Forbidden'), { statusCode: 403, code: 'FORBIDDEN' }));
    }
    next();
  },
}));

describe('Orders Routes', () => {
  let app: express.Express;
  const authHeader = createAuthHeader('test-token');

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp(ordersRouter);
  });

  describe('GET /', () => {
    it('should return user orders', async () => {
      const orders = [
        { ...mockOrder, merchants: mockMerchant, order_items: [{ count: 2 }] },
        { ...mockOrder, id: 'order-2', order_number: 'LMA-2024-000002', merchants: mockMerchant, order_items: [{ count: 1 }] },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: orders,
          count: orders.length,
          error: null,
        }),
      });

      const response = await request(app).get('/').set(authHeader);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter orders by status', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [{ ...mockOrder, merchants: mockMerchant, order_items: [{ count: 2 }] }],
          count: 1,
          error: null,
        }),
      });

      const response = await request(app).get('/?status=pending').set(authHeader);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /:id', () => {
    it('should return order details', async () => {
      const orderWithDetails = {
        ...mockOrder,
        merchants: mockMerchant,
        drivers: null,
        order_items: [
          {
            id: 'item-1',
            product_name: mockProduct.name,
            variant_name: null,
            unit_price: mockProduct.price,
            quantity: 2,
            total_price: mockProduct.price * 2,
            special_instructions: null,
            order_item_addons: [],
          },
        ],
        order_status_history: [{ status: 'pending', created_at: mockOrder.created_at, notes: null }],
        payments: [{ payment_method: 'card', status: 'completed' }],
        delivery_address_snapshot: mockAddress,
        delivery_latitude: mockAddress.latitude,
        delivery_longitude: mockAddress.longitude,
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: orderWithDetails,
          error: null,
        }),
      });

      const response = await request(app).get(`/${mockOrder.id}`).set(authHeader);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(mockOrder.id);
      expect(response.body.data.order_number).toBe(mockOrder.order_number);
      expect(response.body.data.items).toBeDefined();
    });

    it('should return 404 for non-existent order', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      });

      const response = await request(app).get('/00000000-0000-0000-0000-000000000000').set(authHeader);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await request(app).get('/invalid-id').set(authHeader);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /', () => {
    const validOrderData = {
      merchant_id: mockMerchant.id,
      items: [
        {
          product_id: mockProduct.id,
          quantity: 2,
        },
      ],
      delivery_address_id: mockAddress.id,
      payment_method: 'card',
      tip_amount: 20,
    };

    it('should create order successfully', async () => {
      // Mock merchant lookup
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'merchants') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockMerchant, error: null }),
          };
        }
        if (table === 'addresses') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockAddress, error: null }),
          };
        }
        if (table === 'products') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [{ ...mockProduct, product_variants: [], product_addons: [] }],
              error: null,
            }),
          };
        }
        if (table === 'coupons') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (table === 'orders') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { ...mockOrder, order_number: 'LMA-2024-000003' },
              error: null,
            }),
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === 'order_items') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'item-id' },
              error: null,
            }),
          };
        }
        if (table === 'order_item_addons') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === 'order_status_history') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === 'payments') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const response = await request(app).post('/').set(authHeader).send(validOrderData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('order_id');
      expect(response.body.data).toHaveProperty('order_number');
    });

    it('should return 400 for empty items array', async () => {
      const response = await request(app).post('/').set(authHeader).send({
        ...validOrderData,
        items: [],
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid payment method', async () => {
      const response = await request(app).post('/').set(authHeader).send({
        ...validOrderData,
        payment_method: 'bitcoin',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).post('/').send(validOrderData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /:id/cancel', () => {
    it('should cancel a pending order', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'orders') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockOrder, error: null }),
            update: vi.fn().mockReturnThis(),
          };
        }
        if (table === 'order_status_history') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const response = await request(app)
        .post(`/${mockOrder.id}/cancel`)
        .set(authHeader)
        .send({ reason: 'Changed my mind' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('cancelled');
    });

    it('should return 404 for non-existent order', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const response = await request(app)
        .post('/00000000-0000-0000-0000-000000000000/cancel')
        .set(authHeader)
        .send({ reason: 'Test' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for non-cancellable order status', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...mockOrder, status: 'delivered' },
          error: null,
        }),
      });

      const response = await request(app)
        .post(`/${mockOrder.id}/cancel`)
        .set(authHeader)
        .send({ reason: 'Test' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ORDER_CANNOT_BE_CANCELLED');
    });
  });
});
