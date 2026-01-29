import { test as setup, expect } from '@playwright/test';
import { testUsers } from './fixtures/test-data';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Skip authentication setup in CI or when auth is not needed
  if (process.env.SKIP_AUTH) {
    return;
  }

  // Navigate to login page
  await page.goto('/login');

  // Check if already logged in
  const isLoggedIn = await page.locator('[data-testid="user-menu"]').isVisible().catch(() => false);

  if (!isLoggedIn) {
    // Fill in login form
    await page.getByLabel(/email/i).fill(testUsers.customer.email);
    await page.getByLabel(/password/i).fill(testUsers.customer.password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // Wait for login to complete
    await page.waitForURL(/\/(dashboard|home)?$/);

    // Verify login was successful
    await expect(page.locator('[data-testid="user-menu"]').or(page.locator('nav'))).toBeVisible();
  }

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
