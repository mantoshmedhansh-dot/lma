import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { ApiError } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';
import { ERROR_CODES } from '@lma/shared';

const router = Router();

// Validation schemas
const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * Sign up a new user
 * POST /api/v1/auth/signup
 */
router.post('/signup', validateBody(signUpSchema), async (req, res, next) => {
  try {
    const { email, password, first_name, last_name, phone } = req.body;

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        throw new ApiError(409, ERROR_CODES.ALREADY_EXISTS, 'Email already registered');
      }
      throw new ApiError(400, ERROR_CODES.INVALID_INPUT, authError.message);
    }

    // Create user profile
    const { error: profileError } = await supabaseAdmin.from('users').insert({
      id: authData.user.id,
      email,
      first_name,
      last_name,
      phone,
      role: 'customer',
    });

    if (profileError) {
      // Cleanup auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new ApiError(500, ERROR_CODES.INTERNAL_ERROR, 'Failed to create user profile');
    }

    // Send verification email
    await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
    });

    sendSuccess(res, {
      message: 'Account created successfully. Please verify your email.',
      user: {
        id: authData.user.id,
        email,
        first_name,
        last_name,
      },
    }, 201);
  } catch (error) {
    next(error);
  }
});

/**
 * Login user
 * POST /api/v1/auth/login
 */
router.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new ApiError(401, ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email or password');
    }

    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id, email, first_name, last_name, role, avatar_url')
      .eq('id', data.user.id)
      .single();

    // Update last login
    await supabaseAdmin
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.user.id);

    sendSuccess(res, {
      user: profile,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Refresh access token
 * POST /api/v1/auth/refresh
 */
router.post('/refresh', validateBody(refreshTokenSchema), async (req, res, next) => {
  try {
    const { refresh_token } = req.body;

    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token,
    });

    if (error || !data.session) {
      throw new ApiError(401, ERROR_CODES.TOKEN_EXPIRED, 'Invalid or expired refresh token');
    }

    sendSuccess(res, {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Logout user
 * POST /api/v1/auth/logout
 */
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await supabaseAdmin.auth.admin.signOut(req.accessToken!);
    sendSuccess(res, { message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * Get current user
 * GET /api/v1/auth/me
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', req.user!.id)
      .single();

    if (error || !profile) {
      throw ApiError.notFound('User not found');
    }

    sendSuccess(res, profile);
  } catch (error) {
    next(error);
  }
});

/**
 * Request password reset
 * POST /api/v1/auth/forgot-password
 */
router.post('/forgot-password', validateBody(forgotPasswordSchema), async (req, res, next) => {
  try {
    const { email } = req.body;

    await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.WEB_URL}/reset-password`,
    });

    // Always return success to prevent email enumeration
    sendSuccess(res, {
      message: 'If an account exists with this email, a password reset link has been sent.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Reset password with token
 * POST /api/v1/auth/reset-password
 */
router.post('/reset-password', authenticate, validateBody(resetPasswordSchema), async (req, res, next) => {
  try {
    const { password } = req.body;

    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user!.id, {
      password,
    });

    if (error) {
      throw new ApiError(400, ERROR_CODES.INVALID_INPUT, error.message);
    }

    sendSuccess(res, { message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
