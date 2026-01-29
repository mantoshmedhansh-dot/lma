import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for LMA E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // Customer Web App Tests
    {
      name: 'web-chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3000',
      },
      dependencies: ['setup'],
    },
    {
      name: 'web-firefox',
      use: {
        ...devices['Desktop Firefox'],
        baseURL: 'http://localhost:3000',
      },
      dependencies: ['setup'],
    },
    {
      name: 'web-webkit',
      use: {
        ...devices['Desktop Safari'],
        baseURL: 'http://localhost:3000',
      },
      dependencies: ['setup'],
    },

    // Merchant Admin Tests
    {
      name: 'admin-chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3001',
      },
      dependencies: ['setup'],
      testMatch: /admin\/.*/,
    },

    // Super Admin Tests
    {
      name: 'superadmin-chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3002',
      },
      dependencies: ['setup'],
      testMatch: /superadmin\/.*/,
    },

    // Mobile viewport tests
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        baseURL: 'http://localhost:3000',
      },
      dependencies: ['setup'],
      testMatch: /mobile\/.*/,
    },
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
        baseURL: 'http://localhost:3000',
      },
      dependencies: ['setup'],
      testMatch: /mobile\/.*/,
    },
  ],

  /* Run local dev servers before starting the tests */
  webServer: [
    {
      command: 'pnpm dev:web',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: 'pnpm dev:admin',
      url: 'http://localhost:3001',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: 'pnpm dev:api',
      url: 'http://localhost:4000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});
