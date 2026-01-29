import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../lib/logger.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
      logger: typeof logger;
    }
  }
}

/**
 * Request logging middleware
 * Adds request ID, timing, and structured logging
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Generate unique request ID
  req.requestId = req.headers['x-request-id'] as string || randomUUID();
  req.startTime = Date.now();

  // Create child logger with request context
  req.logger = logger.child({ requestId: req.requestId }) as typeof logger;

  // Set request ID in response headers
  res.setHeader('X-Request-ID', req.requestId);

  // Log request start (only in debug mode)
  logger.debug(`Request started: ${req.method} ${req.path}`, {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.socket.remoteAddress,
  });

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;

    logger.request(req.method, req.path, res.statusCode, duration, {
      requestId: req.requestId,
      userId: (req as Request & { user?: { id: string } }).user?.id,
      contentLength: res.get('content-length'),
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.socket.remoteAddress,
    });
  });

  next();
}

/**
 * Sanitize sensitive data from logs
 */
export function sanitizeForLogging(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'key',
    'authorization',
    'cookie',
    'credit_card',
    'cvv',
    'ssn',
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Audit logging middleware for sensitive operations
 */
export function auditLog(action: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        logger.audit(action, {
          requestId: req.requestId,
          userId: (req as Request & { user?: { id: string } }).user?.id,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          ip: req.ip || req.socket.remoteAddress,
        });
      }
    });

    next();
  };
}
