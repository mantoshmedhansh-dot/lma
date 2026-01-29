import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../utils/errors.js';
import { ERROR_CODES, UserRole } from '@lma/shared';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
      };
      accessToken?: string;
    }
  }
}

/**
 * Middleware to authenticate requests using Supabase JWT
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);

    // Verify the JWT with Supabase
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Invalid or expired token');
    }

    // Get user profile from database
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, email, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'User profile not found');
    }

    // Attach user to request
    req.user = {
      id: profile.id,
      email: profile.email,
      role: profile.role as UserRole,
    };
    req.accessToken = token;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication - doesn't fail if no token provided
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  return authenticate(req, res, next);
}

/**
 * Middleware to check user roles
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, ERROR_CODES.FORBIDDEN, 'Insufficient permissions'));
    }

    next();
  };
}

/**
 * Middleware to require customer role
 */
export const requireCustomer = requireRole('customer', 'admin', 'super_admin');

/**
 * Middleware to require driver role
 */
export const requireDriver = requireRole('driver', 'admin', 'super_admin');

/**
 * Middleware to require merchant role
 */
export const requireMerchant = requireRole('merchant', 'admin', 'super_admin');

/**
 * Middleware to require admin role
 */
export const requireAdmin = requireRole('admin', 'super_admin');

/**
 * Middleware to require super admin role
 */
export const requireSuperAdmin = requireRole('super_admin');
