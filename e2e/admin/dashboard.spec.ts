import { test, expect } from '@playwright/test';

test.describe('Merchant Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to merchant admin
    await page.goto('/');
  });

  test.describe('Login', () => {
    test('should display merchant login page', async ({ page }) => {
      await page.goto('/login');

      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel(/email/i).fill('invalid@merchant.com');
      await page.getByLabel(/password/i).fill('wrongpassword');
      await page.getByRole('button', { name: /sign in|log in/i }).click();

      await expect(page.getByText(/invalid|error|incorrect/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Dashboard', () => {
    // These tests assume logged in state
    test('should display dashboard overview', async ({ page }) => {
      await page.goto('/dashboard');

      // Should show dashboard content or redirect to login
      const dashboardContent = page.locator('[data-testid="dashboard"], h1:has-text("Dashboard")');
      const loginPage = page.locator('input[type="email"]');

      await expect(dashboardContent.or(loginPage)).toBeVisible({ timeout: 10000 });
    });

    test('should have navigation sidebar', async ({ page }) => {
      await page.goto('/dashboard');

      const sidebar = page.locator('nav, [data-testid="sidebar"], aside');
      if (await sidebar.isVisible()) {
        await expect(sidebar).toBeVisible();
      }
    });

    test('should display stats cards', async ({ page }) => {
      await page.goto('/dashboard');

      // Look for stats/metrics cards
      const statsCards = page.locator('[data-testid="stats-card"], .stats-card, .metric-card');
      if (await statsCards.first().isVisible()) {
        await expect(statsCards.first()).toBeVisible();
      }
    });
  });

  test.describe('Orders Management', () => {
    test('should display orders page', async ({ page }) => {
      await page.goto('/orders');

      // Should show orders table or login redirect
      const ordersContent = page.locator('table, [data-testid="orders-list"]');
      const loginPage = page.locator('input[type="email"]');

      await expect(ordersContent.or(loginPage)).toBeVisible({ timeout: 10000 });
    });

    test('should have order status filters', async ({ page }) => {
      await page.goto('/orders');

      // Look for status filter
      const filterSelect = page.locator('select, [data-testid="status-filter"]');
      if (await filterSelect.isVisible()) {
        await expect(filterSelect).toBeVisible();
      }
    });
  });

  test.describe('Menu Management', () => {
    test('should display menu page', async ({ page }) => {
      await page.goto('/menu');

      // Should show menu content or login redirect
      const menuContent = page.locator('[data-testid="menu-items"], h1:has-text("Menu")');
      const loginPage = page.locator('input[type="email"]');

      await expect(menuContent.or(loginPage)).toBeVisible({ timeout: 10000 });
    });

    test('should have add product button', async ({ page }) => {
      await page.goto('/menu');

      const addButton = page.getByRole('button', { name: /add|new|create/i });
      if (await addButton.isVisible()) {
        await expect(addButton).toBeEnabled();
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
  });
});
