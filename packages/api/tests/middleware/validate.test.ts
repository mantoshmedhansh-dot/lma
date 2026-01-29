import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Create a simple validation middleware for testing
const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: result.error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
      });
    }
    req.body = result.data;
    next();
  };
};

const validateQuery = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: result.error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
      });
    }
    req.query = result.data;
    next();
  };
};

const validateParams = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: result.error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
      });
    }
    req.params = result.data;
    next();
  };
};

describe('Validation Middleware', () => {
  describe('validateBody', () => {
    const schema = z.object({
      email: z.string().email('Invalid email format'),
      name: z.string().min(2, 'Name must be at least 2 characters'),
      age: z.number().min(18, 'Must be at least 18 years old').optional(),
    });

    const createApp = () => {
      const app = express();
      app.use(express.json());
      app.post('/test', validateBody(schema), (req: Request, res: Response) => {
        res.json({ success: true, data: req.body });
      });
      return app;
    };

    it('should pass valid data', async () => {
      const app = createApp();
      const response = await request(app)
        .post('/test')
        .send({ email: 'test@example.com', name: 'John' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('test@example.com');
    });

    it('should reject invalid email', async () => {
      const app = createApp();
      const response = await request(app)
        .post('/test')
        .send({ email: 'invalid-email', name: 'John' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({ field: 'email' })
      );
    });

    it('should reject short name', async () => {
      const app = createApp();
      const response = await request(app)
        .post('/test')
        .send({ email: 'test@example.com', name: 'J' });

      expect(response.status).toBe(400);
      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({ field: 'name' })
      );
    });

    it('should reject missing required fields', async () => {
      const app = createApp();
      const response = await request(app).post('/test').send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({ field: 'name' })
      );
    });

    it('should reject invalid age', async () => {
      const app = createApp();
      const response = await request(app)
        .post('/test')
        .send({ email: 'test@example.com', name: 'John', age: 16 });

      expect(response.status).toBe(400);
      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({ field: 'age' })
      );
    });
  });

  describe('validateQuery', () => {
    const schema = z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
      search: z.string().optional(),
    });

    const createApp = () => {
      const app = express();
      app.get('/test', validateQuery(schema), (req: Request, res: Response) => {
        res.json({ success: true, data: req.query });
      });
      return app;
    };

    it('should pass valid query params', async () => {
      const app = createApp();
      const response = await request(app).get('/test?page=2&limit=50');

      expect(response.status).toBe(200);
      expect(response.body.data.page).toBe(2);
      expect(response.body.data.limit).toBe(50);
    });

    it('should use default values', async () => {
      const app = createApp();
      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(20);
    });

    it('should reject invalid page number', async () => {
      const app = createApp();
      const response = await request(app).get('/test?page=0');

      expect(response.status).toBe(400);
      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({ field: 'page' })
      );
    });

    it('should reject limit exceeding max', async () => {
      const app = createApp();
      const response = await request(app).get('/test?limit=150');

      expect(response.status).toBe(400);
      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({ field: 'limit' })
      );
    });
  });

  describe('validateParams', () => {
    const schema = z.object({
      id: z.string().uuid('Invalid UUID format'),
    });

    const createApp = () => {
      const app = express();
      app.get('/test/:id', validateParams(schema), (req: Request, res: Response) => {
        res.json({ success: true, data: { id: req.params.id } });
      });
      return app;
    };

    it('should pass valid UUID', async () => {
      const app = createApp();
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app).get(`/test/${uuid}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(uuid);
    });

    it('should reject invalid UUID', async () => {
      const app = createApp();
      const response = await request(app).get('/test/invalid-uuid');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({ field: 'id' })
      );
    });
  });
});
