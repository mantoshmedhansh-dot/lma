import { describe, it, expect } from 'vitest';
import { ApiError } from '../../src/utils/errors.js';

describe('ApiError', () => {
  describe('constructor', () => {
    it('should create an error with all properties', () => {
      const error = new ApiError(400, 'VALIDATION_ERROR', 'Invalid input', [
        { field: 'email', message: 'Invalid email format' },
      ]);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid input');
      expect(error.details).toHaveLength(1);
      expect(error.details?.[0].field).toBe('email');
    });

    it('should create an error without details', () => {
      const error = new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong');

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.message).toBe('Something went wrong');
      expect(error.details).toBeUndefined();
    });
  });

  describe('static methods', () => {
    describe('badRequest', () => {
      it('should create a 400 error', () => {
        const error = ApiError.badRequest('INVALID_INPUT', 'Bad request');

        expect(error.statusCode).toBe(400);
        expect(error.code).toBe('INVALID_INPUT');
        expect(error.message).toBe('Bad request');
      });

      it('should include details when provided', () => {
        const error = ApiError.badRequest('VALIDATION_ERROR', 'Validation failed', [
          { field: 'name', message: 'Name is required' },
        ]);

        expect(error.details).toHaveLength(1);
      });
    });

    describe('unauthorized', () => {
      it('should create a 401 error with default message', () => {
        const error = ApiError.unauthorized();

        expect(error.statusCode).toBe(401);
        expect(error.code).toBe('UNAUTHORIZED');
        expect(error.message).toBe('Unauthorized');
      });

      it('should create a 401 error with custom message', () => {
        const error = ApiError.unauthorized('Token expired');

        expect(error.statusCode).toBe(401);
        expect(error.message).toBe('Token expired');
      });
    });

    describe('forbidden', () => {
      it('should create a 403 error with default message', () => {
        const error = ApiError.forbidden();

        expect(error.statusCode).toBe(403);
        expect(error.code).toBe('FORBIDDEN');
        expect(error.message).toBe('Forbidden');
      });

      it('should create a 403 error with custom message', () => {
        const error = ApiError.forbidden('Access denied');

        expect(error.statusCode).toBe(403);
        expect(error.message).toBe('Access denied');
      });
    });

    describe('notFound', () => {
      it('should create a 404 error with default message', () => {
        const error = ApiError.notFound();

        expect(error.statusCode).toBe(404);
        expect(error.code).toBe('NOT_FOUND');
        expect(error.message).toBe('Resource not found');
      });

      it('should create a 404 error with custom message', () => {
        const error = ApiError.notFound('User not found');

        expect(error.statusCode).toBe(404);
        expect(error.message).toBe('User not found');
      });
    });

    describe('conflict', () => {
      it('should create a 409 error', () => {
        const error = ApiError.conflict('Resource already exists');

        expect(error.statusCode).toBe(409);
        expect(error.code).toBe('CONFLICT');
        expect(error.message).toBe('Resource already exists');
      });
    });

    describe('internal', () => {
      it('should create a 500 error with default message', () => {
        const error = ApiError.internal();

        expect(error.statusCode).toBe(500);
        expect(error.code).toBe('INTERNAL_ERROR');
        expect(error.message).toBe('Internal server error');
      });

      it('should create a 500 error with custom message', () => {
        const error = ApiError.internal('Database connection failed');

        expect(error.statusCode).toBe(500);
        expect(error.message).toBe('Database connection failed');
      });
    });
  });

  describe('error name', () => {
    it('should have name set to ApiError', () => {
      const error = new ApiError(400, 'TEST', 'Test error');
      expect(error.name).toBe('ApiError');
    });
  });

  describe('stack trace', () => {
    it('should capture stack trace', () => {
      const error = new ApiError(400, 'TEST', 'Test error');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ApiError');
    });
  });
});
