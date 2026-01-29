import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';

// Create a test app instance without starting the server
export function createTestApp(routes: express.Router): Express {
  const app = express();

  // Basic middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mount routes
  app.use(routes);

  // Error handling
  app.use((err: Error & { statusCode?: number; code?: string; details?: unknown }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Internal server error',
        details: err.details,
      },
    });
  });

  return app;
}

// Generate random IDs for testing
export function generateTestId(): string {
  return `test-${Math.random().toString(36).substring(2, 15)}`;
}

// Generate test email
export function generateTestEmail(): string {
  return `test-${Date.now()}@example.com`;
}

// Create authorization header
export function createAuthHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

// Common test assertions
export const expectSuccessResponse = (response: { body: { success: boolean } }) => {
  expect(response.body).toHaveProperty('success', true);
  expect(response.body).toHaveProperty('data');
};

export const expectErrorResponse = (
  response: { body: { success: boolean; error?: { code?: string; message?: string } } },
  statusCode: number,
  errorCode?: string
) => {
  expect(response.body).toHaveProperty('success', false);
  expect(response.body).toHaveProperty('error');
  if (errorCode) {
    expect(response.body.error).toHaveProperty('code', errorCode);
  }
};

// Wait helper for async operations
export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
