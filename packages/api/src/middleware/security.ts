import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../lib/logger.js';
import { ApiError } from '../utils/errors.js';

/**
 * Security headers middleware
 * Adds additional security headers beyond helmet defaults
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );

  // Remove server identification
  res.removeHeader('X-Powered-By');

  next();
}

/**
 * API key validation middleware (for service-to-service communication)
 */
export function validateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    throw ApiError.unauthorized('API key required');
  }

  if (apiKey !== process.env.INTERNAL_API_KEY) {
    logger.warn('Invalid API key attempt', {
      requestId: req.requestId,
      ip: req.ip,
    });
    throw ApiError.unauthorized('Invalid API key');
  }

  next();
}

/**
 * Rate limiter for authentication endpoints
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many login attempts. Please try again in 15 minutes.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use email if available, otherwise IP
    return (req.body?.email || req.ip || 'unknown') as string;
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Auth rate limit exceeded', {
      requestId: req.requestId,
      ip: req.ip,
      email: req.body?.email,
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many login attempts. Please try again in 15 minutes.',
      },
    });
  },
});

/**
 * Rate limiter for password reset
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many password reset attempts. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for order creation
 */
export const orderRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 orders per minute
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many orders. Please wait a moment before trying again.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * IP blocklist middleware
 */
const blockedIPs = new Set<string>();

export function ipBlocklist(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || '';

  if (blockedIPs.has(ip)) {
    logger.warn('Blocked IP attempted access', {
      requestId: req.requestId,
      ip,
    });

    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied',
      },
    });
    return;
  }

  next();
}

export function blockIP(ip: string): void {
  blockedIPs.add(ip);
  logger.info('IP blocked', { ip });
}

export function unblockIP(ip: string): void {
  blockedIPs.delete(ip);
  logger.info('IP unblocked', { ip });
}

/**
 * Request size limiter
 */
export function requestSizeLimit(maxSize: string = '10mb') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const maxBytes = parseSize(maxSize);

    if (contentLength > maxBytes) {
      logger.warn('Request too large', {
        requestId: req.requestId,
        contentLength,
        maxBytes,
      });

      res.status(413).json({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: `Request body too large. Maximum size is ${maxSize}.`,
        },
      });
      return;
    }

    next();
  };
}

function parseSize(size: string): number {
  const units: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.toLowerCase().match(/^(\d+)(b|kb|mb|gb)?$/);
  if (!match) return 10 * 1024 * 1024; // Default 10MB

  const value = parseInt(match[1], 10);
  const unit = match[2] || 'b';

  return value * (units[unit] || 1);
}

/**
 * SQL injection protection (basic pattern detection)
 */
export function sqlInjectionProtection(req: Request, res: Response, next: NextFunction): void {
  const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b.*\b(FROM|INTO|TABLE|DATABASE)\b)/i,
    /(--)|(\/\*)|(\*\/)/,
    /(\bOR\b.*=.*\bOR\b)/i,
    /(1\s*=\s*1)|(1\s*=\s*'1')/,
  ];

  const checkValue = (value: unknown): boolean => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some((pattern) => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(checkValue);
    }
    return false;
  };

  const isSuspicious =
    checkValue(req.body) ||
    checkValue(req.query) ||
    checkValue(req.params);

  if (isSuspicious) {
    logger.warn('Potential SQL injection attempt detected', {
      requestId: req.requestId,
      ip: req.ip,
      path: req.path,
    });

    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'Invalid characters in request',
      },
    });
    return;
  }

  next();
}

/**
 * Brute force protection store
 */
const bruteForceStore: Map<string, { attempts: number; lastAttempt: number; blockedUntil?: number }> = new Map();

/**
 * Brute force protection middleware
 */
export function bruteForceProtection(
  maxAttempts: number = 5,
  blockDurationMs: number = 15 * 60 * 1000
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `brute:${ip}`;
    const now = Date.now();
    const record = bruteForceStore.get(key);

    // Check if blocked
    if (record?.blockedUntil && now < record.blockedUntil) {
      const retryAfter = Math.ceil((record.blockedUntil - now) / 1000);
      logger.warn('Blocked due to brute force', { ip, retryAfter });
      res.status(429).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Too many failed attempts. Account temporarily locked.',
          retryAfter,
        },
      });
      return;
    }

    // Attach helper to track failed attempts
    res.locals.trackFailedAttempt = () => {
      const current = bruteForceStore.get(key) || { attempts: 0, lastAttempt: 0 };

      // Reset if last attempt was too long ago
      if (now - current.lastAttempt > blockDurationMs) {
        current.attempts = 0;
      }

      current.attempts++;
      current.lastAttempt = now;

      if (current.attempts >= maxAttempts) {
        current.blockedUntil = now + blockDurationMs;
        logger.warn('Brute force block applied', { ip, attempts: current.attempts });
      }

      bruteForceStore.set(key, current);
    };

    res.locals.resetFailedAttempts = () => {
      bruteForceStore.delete(key);
    };

    next();
  };
}

/**
 * Request sanitization middleware
 */
export function sanitizeRequest(req: Request, res: Response, next: NextFunction): void {
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query as Record<string, unknown>) as typeof req.query;
  }

  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize params
  if (req.params) {
    req.params = sanitizeObject(req.params) as typeof req.params;
  }

  next();
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Prevent prototype pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? sanitizeObject(item as Record<string, unknown>)
          : typeof item === 'string'
          ? sanitizeString(item)
          : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function sanitizeString(str: string): string {
  return str
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Request validation middleware factory
 */
interface FieldValidator {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'email' | 'phone' | 'uuid';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
}

export function validateRequestBody(schema: Record<string, FieldValidator>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];
    const data = req.body || {};

    for (const [field, validator] of Object.entries(schema)) {
      const value = data[field];

      if (validator.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }

      if (value === undefined || value === null) continue;

      if (validator.type && !checkType(value, validator.type)) {
        errors.push(`${field} must be a valid ${validator.type}`);
        continue;
      }

      if (typeof value === 'string') {
        if (validator.minLength && value.length < validator.minLength) {
          errors.push(`${field} must be at least ${validator.minLength} characters`);
        }
        if (validator.maxLength && value.length > validator.maxLength) {
          errors.push(`${field} must be at most ${validator.maxLength} characters`);
        }
        if (validator.pattern && !validator.pattern.test(value)) {
          errors.push(`${field} has invalid format`);
        }
      }

      if (typeof value === 'number') {
        if (validator.min !== undefined && value < validator.min) {
          errors.push(`${field} must be at least ${validator.min}`);
        }
        if (validator.max !== undefined && value > validator.max) {
          errors.push(`${field} must be at most ${validator.max}`);
        }
      }
    }

    if (errors.length > 0) {
      res.status(400).json({ success: false, errors });
      return;
    }

    next();
  };
}

function checkType(value: unknown, type: string): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'email':
      return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case 'phone':
      return typeof value === 'string' && /^\+?[1-9]\d{6,14}$/.test(value.replace(/[\s-]/g, ''));
    case 'uuid':
      return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    default:
      return true;
  }
}

/**
 * Request timeout middleware
 */
export function requestTimeout(timeoutMs: number = 30000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn('Request timeout', { path: req.path, method: req.method });
        res.status(408).json({ success: false, error: { code: 'TIMEOUT', message: 'Request timeout' } });
      }
    }, timeoutMs);

    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));

    next();
  };
}

/**
 * Request ID middleware
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.headers['x-request-id'] = id;
  (req as any).requestId = id;
  res.set('X-Request-ID', id);
  next();
}

/**
 * Get client IP address
 */
export function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

/**
 * Sensitive data redaction for logging
 */
export function redactSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = [
    'password', 'token', 'secret', 'apikey', 'api_key', 'authorization',
    'creditcard', 'credit_card', 'cvv', 'ssn', 'pan', 'aadhaar', 'otp',
  ];

  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some((field) => lowerKey.includes(field))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveData(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * OTP rate limiter
 */
export const otpRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 OTP requests per hour
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many OTP requests. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return (req.body?.phone || req.ip || 'unknown') as string;
  },
});

/**
 * General API rate limiter
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please slow down.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
