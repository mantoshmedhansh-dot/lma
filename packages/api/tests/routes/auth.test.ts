import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRouter from '../../src/routes/auth.js';
import { createTestApp } from '../helpers.js';
import { mockUser, mockSession } from '../mocks/supabase.js';

// Mock Supabase
const mockSupabase = {
  from: vi.fn(),
  auth: {
    admin: {
      createUser: vi.fn(),
      deleteUser: vi.fn(),
      updateUserById: vi.fn(),
      generateLink: vi.fn(),
      signOut: vi.fn(),
    },
    signInWithPassword: vi.fn(),
    refreshSession: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    getUser: vi.fn(),
  },
};

vi.mock('../../src/config/supabase.js', () => ({
  supabaseAdmin: mockSupabase,
}));

vi.mock('@lma/shared', () => ({
  ERROR_CODES: {
    ALREADY_EXISTS: 'ALREADY_EXISTS',
    INVALID_INPUT: 'INVALID_INPUT',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  },
}));

describe('Auth Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp(authRouter);
  });

  describe('POST /signup', () => {
    const validSignupData = {
      email: 'newuser@example.com',
      password: 'password123',
      first_name: 'New',
      last_name: 'User',
      phone: '+1234567890',
    };

    it('should create a new user successfully', async () => {
      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'new-user-id', email: validSignupData.email } },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      mockSupabase.auth.admin.generateLink.mockResolvedValue({ data: {}, error: null });

      const response = await request(app).post('/signup').send(validSignupData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('message');
      expect(response.body.data.user).toHaveProperty('email', validSignupData.email);
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app).post('/signup').send({
        ...validSignupData,
        email: 'invalid-email',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for short password', async () => {
      const response = await request(app).post('/signup').send({
        ...validSignupData,
        password: 'short',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app).post('/signup').send({
        email: validSignupData.email,
        password: validSignupData.password,
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 409 for existing email', async () => {
      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: null,
        error: { message: 'User already registered' },
      });

      const response = await request(app).post('/signup').send(validSignupData);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ALREADY_EXISTS');
    });
  });

  describe('POST /login', () => {
    const validLoginData = {
      email: mockUser.email,
      password: 'password123',
    };

    it('should login user successfully', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: mockUser.id },
          session: mockSession,
        },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
        update: vi.fn().mockReturnThis(),
      });

      const response = await request(app).post('/login').send(validLoginData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('access_token');
      expect(response.body.data).toHaveProperty('refresh_token');
      expect(response.body.data).toHaveProperty('user');
    });

    it('should return 401 for invalid credentials', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' },
      });

      const response = await request(app).post('/login').send(validLoginData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app).post('/login').send({
        email: 'invalid-email',
        password: 'password123',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for empty password', async () => {
      const response = await request(app).post('/login').send({
        email: validLoginData.email,
        password: '',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /refresh', () => {
    it('should refresh token successfully', async () => {
      const newSession = {
        ...mockSession,
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      };

      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: newSession },
        error: null,
      });

      const response = await request(app).post('/refresh').send({
        refresh_token: mockSession.refresh_token,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('access_token', 'new-access-token');
      expect(response.body.data).toHaveProperty('refresh_token', 'new-refresh-token');
    });

    it('should return 401 for invalid refresh token', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid refresh token' },
      });

      const response = await request(app).post('/refresh').send({
        refresh_token: 'invalid-token',
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app).post('/refresh').send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /forgot-password', () => {
    it('should send password reset email', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null,
      });

      const response = await request(app).post('/forgot-password').send({
        email: mockUser.email,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('message');
    });

    it('should return success even for non-existent email (security)', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null,
      });

      const response = await request(app).post('/forgot-password').send({
        email: 'nonexistent@example.com',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app).post('/forgot-password').send({
        email: 'invalid-email',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
