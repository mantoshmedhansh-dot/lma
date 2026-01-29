import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import healthRouter from '../../src/routes/health.js';
import { createTestApp } from '../helpers.js';

// Mock Supabase
vi.mock('../../src/config/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ count: 1 }], error: null }),
    })),
  },
}));

describe('Health Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp(healthRouter);
  });

  describe('GET /', () => {
    it('should return healthy status when database is connected', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status', 'healthy');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('uptime');
      expect(response.body.data.services).toHaveProperty('database', 'healthy');
    });

    it('should return degraded status when database connection fails', async () => {
      const { supabaseAdmin } = await import('../../src/config/supabase.js');
      vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: new Error('Connection failed') }),
      } as never);

      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status', 'degraded');
      expect(response.body.data.services).toHaveProperty('database', 'unhealthy');
    });
  });
});
