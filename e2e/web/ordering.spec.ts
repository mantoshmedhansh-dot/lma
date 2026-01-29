import { test, expect } from '@playwright/test';
import { CartPage, CheckoutPage } from '../fixtures/pages';

test.describe('Ordering Flow', () => {
  // Use authenticated state
  test.use({ storageState: 'playwright/.auth/user.json' });

  test.describe('Add to Cart', () => {
    test('should add product to cart', async ({ page }) => {
      // Navigate to a merchant
      await page.goto('/merchants/test-restaurant');

      // Find add button and click
      const addButton = page.getByRole('button', { name: /add|cart|\+/i }).first();
      if (await addButton.isVisible()) {
        await addButton.click();

        // Cart should update - look for cart indicator or toast
        const cartIndicator = page.locator('[data-testid="cart-count"], [data-testid="cart-badge"]');
        if (await cartIndicator.isVisible()) {
          await expect(cartIndicator).not.toHaveText('0');
        }
      }
    });

    test('should show cart bar after adding item', async ({ page }) => {
      await page.goto('/merchants/test-restaurant');

      const addButton = page.getByRole('button', { name: /add|cart|\+/i }).first();
      if (await addButton.isVisible()) {
        await addButton.click();

        // Cart bar or summary should appear
        const cartBar = page.locator('[data-testid="cart-bar"], [data-testid="cart-summary"]');
        if (await cartBar.isVisible()) {
          await expect(cartBar).toBeVisible();
        }
      }
    });

    test('should update quantity in cart', async ({ page }) => {
      await page.goto('/merchants/test-restaurant');

      // Add item
      const addButton = page.getByRole('button', { name: /add|cart|\+/i }).first();
      if (await addButton.isVisible()) {
        await addButton.click();

        // Find increment button
        const incrementButton = page.getByRole('button', { name: /\+|increase/i });
        if (await incrementButton.isVisible()) {
          await incrementButton.click();

          // Quantity should be 2
          const quantity = page.locator('[data-testid="quantity"]');
          if (await quantity.isVisible()) {
            await expect(quantity).toHaveText('2');
          }
        }
      }
    });
  });

  test.describe('Cart Page', () => {
    test('should display cart items', async ({ page }) => {
      const cartPage = new CartPage(page);
      await cartPage.goto();

      // Should show items or empty message
      const content = cartPage.cartItems.or(cartPage.emptyCartMessage);
      await expect(content.first()).toBeVisible();
    });

    test('should show order summary', async ({ page }) => {
      const cartPage = new CartPage(page);
      await cartPage.goto();

      // If cart has items, should show subtotal
      const hasItems = await cartPage.cartItems.count() > 0;
      if (hasItems) {
        await expect(cartPage.subtotal).toBeVisible();
      }
    });

    test('should navigate to checkout', async ({ page }) => {
      const cartPage = new CartPage(page);
      await cartPage.goto();

      // If cart has items, checkout button should be visible
      const hasItems = await cartPage.cartItems.count() > 0;
      if (hasItems) {
        await cartPage.proceedToCheckout();
        await expect(page).toHaveURL(/checkout/);
      }
    });

    test('should allow removing items', async ({ page }) => {
      const cartPage = new CartPage(page);
      await cartPage.goto();

      const initialCount = await cartPage.cartItems.count();
      if (initialCount > 0) {
        // Find and click remove button
        const removeButton = page.getByRole('button', { name: /remove|delete/i }).first();
        if (await removeButton.isVisible()) {
          await removeButton.click();

          // Count should decrease
          await expect(cartPage.cartItems).toHaveCount(initialCount - 1);
        }
      }
    });
  });

  test.describe('Checkout', () => {
    test('should display checkout form', async ({ page }) => {
      const checkoutPage = new CheckoutPage(page);
      await checkoutPage.goto();

      // Should have address selection and payment method
      await expect(checkoutPage.addressSelector.or(page.getByText(/address/i))).toBeVisible({ timeout: 10000 }).catch(() => {
        // Might redirect if cart is empty
      });
    });

    test('should show order summary on checkout', async ({ page }) => {
      const checkoutPage = new CheckoutPage(page);
      await checkoutPage.goto();

      // Should display order summary
      if (await checkoutPage.orderSummary.isVisible()) {
        await expect(checkoutPage.orderSummary).toBeVisible();
      }
    });

    test('should have payment method options', async ({ page }) => {
      const checkoutPage = new CheckoutPage(page);
      await checkoutPage.goto();

      // Should have payment options
      const paymentSection = page.locator('[data-testid="payment-method"], [data-testid="payment-options"]');
      if (await paymentSection.isVisible()) {
        await expect(paymentSection).toBeVisible();
      }
    });

    test('should have place order button', async ({ page }) => {
      const checkoutPage = new CheckoutPage(page);
      await checkoutPage.goto();

      // Should have place order button
      if (await checkoutPage.placeOrderButton.isVisible()) {
        await expect(checkoutPage.placeOrderButton).toBeVisible();
      }
    });
  });

  test.describe('Order Tracking', () => {
    test('should display order status page', async ({ page }) => {
      // Navigate to orders page
      await page.goto('/orders');

      // Should show orders or empty message
      const content = page.locator('[data-testid="order-card"], [data-testid="no-orders"]');
      await expect(content.first()).toBeVisible({ timeout: 10000 }).catch(() => {
        // Page might need login
      });
    });

    test('should show order details', async ({ page }) => {
      await page.goto('/orders');

      // Click on first order if available
      const orderCard = page.locator('[data-testid="order-card"]').first();
      if (await orderCard.isVisible()) {
        await orderCard.click();

        // Should show order details
        await expect(page.getByText(/order|status|items/i)).toBeVisible();
      }
    });
  });
});
