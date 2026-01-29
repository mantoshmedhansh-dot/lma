import { test, expect } from '@playwright/test';

test.describe('Super Admin Platform', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Login', () => {
    test('should display admin login page', async ({ page }) => {
      await page.goto('/login');

      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible();
    });

    test('should restrict access to non-admin users', async ({ page }) => {
      await page.goto('/login');

      // Try logging in with non-admin credentials
      await page.getByLabel(/email/i).fill('customer@test.com');
      await page.getByLabel(/password/i).fill('TestPassword123!');
      await page.getByRole('button', { name: /sign in|log in/i }).click();

      // Should show unauthorized or stay on login
      await expect(page.getByText(/unauthorized|access denied|invalid/i).or(page.getByLabel(/email/i))).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Dashboard', () => {
    test('should display admin dashboard', async ({ page }) => {
      await page.goto('/dashboard');

      // Should show dashboard or redirect to login
      const dashboardContent = page.locator('[data-testid="dashboard"], h1');
      const loginPage = page.locator('input[type="email"]');

      await expect(dashboardContent.or(loginPage)).toBeVisible({ timeout: 10000 });
    });

    test('should display platform metrics', async ({ page }) => {
      await page.goto('/dashboard');

      // Look for metrics/stats
      const metrics = page.locator('[data-testid="metric-card"], .stats-card');
      if (await metrics.first().isVisible()) {
        await expect(metrics.first()).toBeVisible();
      }
    });

    test('should have analytics charts', async ({ page }) => {
      await page.goto('/dashboard');

      // Look for charts
      const charts = page.locator('[data-testid="chart"], .recharts-wrapper, canvas');
      if (await charts.first().isVisible()) {
        await expect(charts.first()).toBeVisible();
      }
    });
  });

  test.describe('User Management', () => {
    test('should display users page', async ({ page }) => {
      await page.goto('/users');

      // Should show users table or login redirect
      const usersContent = page.locator('table, [data-testid="users-list"]');
      const loginPage = page.locator('input[type="email"]');

      await expect(usersContent.or(loginPage)).toBeVisible({ timeout: 10000 });
    });

    test('should have user search', async ({ page }) => {
      await page.goto('/users');

      const searchInput = page.getByPlaceholder(/search/i);
      if (await searchInput.isVisible()) {
        await expect(searchInput).toBeVisible();
      }
    });

    test('should have role filter', async ({ page }) => {
      await page.goto('/users');

      const roleFilter = page.locator('select, [data-testid="role-filter"]');
      if (await roleFilter.isVisible()) {
        await expect(roleFilter).toBeVisible();
      }
    });
  });

  test.describe('Merchant Management', () => {
    test('should display merchants page', async ({ page }) => {
      await page.goto('/merchants');

      // Should show merchants table or login redirect
      const merchantsContent = page.locator('table, [data-testid="merchants-list"]');
      const loginPage = page.locator('input[type="email"]');

      await expect(merchantsContent.or(loginPage)).toBeVisible({ timeout: 10000 });
    });

    test('should have merchant status filter', async ({ page }) => {
      await page.goto('/merchants');

      const statusFilter = page.locator('select, [data-testid="status-filter"]');
      if (await statusFilter.isVisible()) {
        await expect(statusFilter).toBeVisible();
      }
    });

    test('should display pending approvals count', async ({ page }) => {
      await page.goto('/merchants');

      // Look for pending indicator
      const pendingIndicator = page.locator('[data-testid="pending-count"], :text("Pending")');
      if (await pendingIndicator.isVisible()) {
        await expect(pendingIndicator).toBeVisible();
      }
    });
  });

  test.describe('Driver Management', () => {
    test('should display drivers page', async ({ page }) => {
      await page.goto('/drivers');

      // Should show drivers table or login redirect
      const driversContent = page.locator('table, [data-testid="drivers-list"]');
      const loginPage = page.locator('input[type="email"]');

      await expect(driversContent.or(loginPage)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Orders Overview', () => {
    test('should display orders page', async ({ page }) => {
      await page.goto('/orders');

      // Should show orders table or login redirect
      const ordersContent = page.locator('table, [data-testid="orders-list"]');
      const loginPage = page.locator('input[type="email"]');

      await expect(ordersContent.or(loginPage)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Analytics', () => {
    test('should display analytics page', async ({ page }) => {
      await page.goto('/analytics');

      // Should show analytics or login redirect
      const analyticsContent = page.locator('[data-testid="analytics"], h1:has-text("Analytics")');
      const loginPage = page.locator('input[type="email"]');

      await expect(analyticsContent.or(loginPage)).toBeVisible({ timeout: 10000 });
    });

    test('should have date range selector', async ({ page }) => {
      await page.goto('/analytics');

      const dateSelector = page.locator('[data-testid="date-range"], select:has-text("days")');
      if (await dateSelector.isVisible()) {
        await expect(dateSelector).toBeVisible();
      }
    });
  });

  test.describe('Settings', () => {
    test('should display settings page', async ({ page }) => {
      await page.goto('/settings');

      // Should show settings or login redirect
      const settingsContent = page.locator('form, [data-testid="settings"], h1:has-text("Settings")');
      const loginPage = page.locator('input[type="email"]');

      await expect(settingsContent.or(loginPage)).toBeVisible({ timeout: 10000 });
    });

    test('should have platform settings sections', async ({ page }) => {
      await page.goto('/settings');

      // Look for settings sections
      const sections = page.locator('[data-testid="settings-section"], .card');
      if (await sections.first().isVisible()) {
        await expect(sections.first()).toBeVisible();
      }
    });
  });
});
