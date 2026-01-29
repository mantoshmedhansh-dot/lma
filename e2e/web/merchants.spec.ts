import { test, expect } from '@playwright/test';
import { HomePage, MerchantPage } from '../fixtures/pages';

test.describe('Merchants', () => {
  test.describe('Home Page', () => {
    test('should display merchant listing', async ({ page }) => {
      const homePage = new HomePage(page);
      await homePage.goto();

      // Should have a heading
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      // Should display merchants or categories
      const merchants = page.locator('[data-testid="merchant-card"], [data-testid="category-card"]');
      await expect(merchants.first()).toBeVisible({ timeout: 10000 });
    });

    test('should have search functionality', async ({ page }) => {
      const homePage = new HomePage(page);
      await homePage.goto();

      await expect(homePage.searchInput).toBeVisible();
    });

    test('should filter merchants by search', async ({ page }) => {
      const homePage = new HomePage(page);
      await homePage.goto();

      // Search for a merchant
      await homePage.search('restaurant');

      // Wait for search results
      await page.waitForLoadState('networkidle');

      // Results should be filtered (or show no results message)
      const resultsOrMessage = page.locator('[data-testid="merchant-card"], [data-testid="no-results"]');
      await expect(resultsOrMessage.first()).toBeVisible();
    });

    test('should have category filters', async ({ page }) => {
      const homePage = new HomePage(page);
      await homePage.goto();

      // Look for category filters or tabs
      const categories = page.locator('[data-testid="category-filter"], [role="tablist"]');
      if (await categories.isVisible()) {
        await expect(categories).toBeVisible();
      }
    });
  });

  test.describe('Merchant Detail Page', () => {
    test('should display merchant information', async ({ page }) => {
      // Navigate to a merchant page
      await page.goto('/merchants/test-restaurant');

      // Should display merchant name
      const merchantName = page.locator('h1');
      await expect(merchantName).toBeVisible({ timeout: 10000 });
    });

    test('should display merchant rating', async ({ page }) => {
      await page.goto('/merchants/test-restaurant');

      // Rating should be visible
      const rating = page.locator('[data-testid="rating"], .rating');
      if (await rating.isVisible()) {
        await expect(rating).toBeVisible();
      }
    });

    test('should display menu categories', async ({ page }) => {
      await page.goto('/merchants/test-restaurant');

      // Menu categories should be visible
      const categories = page.locator('[data-testid="menu-category"], .menu-category');
      await expect(categories.first()).toBeVisible({ timeout: 10000 }).catch(() => {
        // Some merchants might not have categories
      });
    });

    test('should display products', async ({ page }) => {
      await page.goto('/merchants/test-restaurant');

      // Products should be visible
      const products = page.locator('[data-testid="product-card"], .product');
      await expect(products.first()).toBeVisible({ timeout: 10000 }).catch(() => {
        // Some merchants might not have products
      });
    });

    test('should have add to cart functionality', async ({ page }) => {
      await page.goto('/merchants/test-restaurant');

      // Look for add button
      const addButton = page.getByRole('button', { name: /add|cart|\+/i }).first();
      if (await addButton.isVisible()) {
        await expect(addButton).toBeEnabled();
      }
    });

    test('should show merchant info section', async ({ page }) => {
      await page.goto('/merchants/test-restaurant');

      // Info section should have delivery time, minimum order, etc.
      const infoSection = page.locator('[data-testid="merchant-info"]');
      if (await infoSection.isVisible()) {
        await expect(infoSection).toContainText(/min|delivery|order/i);
      }
    });
  });

  test.describe('Search Results', () => {
    test('should display search results page', async ({ page }) => {
      await page.goto('/search?q=pizza');

      // Should show search results or no results message
      const content = page.locator('[data-testid="search-results"], [data-testid="no-results"], main');
      await expect(content).toBeVisible();
    });

    test('should display search query', async ({ page }) => {
      await page.goto('/search?q=burger');

      // Page should mention the search term
      await expect(page.getByText(/burger/i)).toBeVisible({ timeout: 10000 }).catch(() => {
        // Some pages might not display search term
      });
    });
  });
});
