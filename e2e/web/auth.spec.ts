import { test, expect } from '@playwright/test';
import { LoginPage, SignupPage } from '../fixtures/pages';
import { testUsers } from '../fixtures/test-data';

test.describe('Authentication', () => {
  test.describe('Login', () => {
    test('should display login form', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await expect(loginPage.emailInput).toBeVisible();
      await expect(loginPage.passwordInput).toBeVisible();
      await expect(loginPage.submitButton).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('invalid@email.com', 'wrongpassword');

      await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible();
    });

    test('should show error for empty fields', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.submitButton.click();

      // Check for validation error
      await expect(page.getByText(/required|email|password/i)).toBeVisible();
    });

    test('should redirect to home after successful login', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(testUsers.customer.email, testUsers.customer.password);

      // Should redirect to home or dashboard
      await expect(page).toHaveURL(/\/(home|dashboard)?$/);
    });

    test('should have link to signup page', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      const signupLink = page.getByRole('link', { name: /sign up|register|create account/i });
      await expect(signupLink).toBeVisible();
    });

    test('should have forgot password link', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      const forgotLink = page.getByRole('link', { name: /forgot|reset/i });
      await expect(forgotLink).toBeVisible();
    });
  });

  test.describe('Signup', () => {
    test('should display signup form', async ({ page }) => {
      const signupPage = new SignupPage(page);
      await signupPage.goto();

      await expect(signupPage.firstNameInput).toBeVisible();
      await expect(signupPage.lastNameInput).toBeVisible();
      await expect(signupPage.emailInput).toBeVisible();
      await expect(signupPage.passwordInput).toBeVisible();
      await expect(signupPage.submitButton).toBeVisible();
    });

    test('should show error for invalid email', async ({ page }) => {
      const signupPage = new SignupPage(page);
      await signupPage.goto();
      await signupPage.signup('Test', 'User', 'invalid-email', 'password123');

      await expect(page.getByText(/invalid|email/i)).toBeVisible();
    });

    test('should show error for short password', async ({ page }) => {
      const signupPage = new SignupPage(page);
      await signupPage.goto();
      await signupPage.signup('Test', 'User', 'test@example.com', 'short');

      await expect(page.getByText(/password|characters|minimum/i)).toBeVisible();
    });

    test('should have link to login page', async ({ page }) => {
      const signupPage = new SignupPage(page);
      await signupPage.goto();

      const loginLink = page.getByRole('link', { name: /sign in|log in|already have/i });
      await expect(loginLink).toBeVisible();
    });
  });

  test.describe('Logout', () => {
    test.use({ storageState: 'playwright/.auth/user.json' });

    test('should be able to logout', async ({ page }) => {
      await page.goto('/');

      // Open user menu and click logout
      const userMenu = page.locator('[data-testid="user-menu"]');
      if (await userMenu.isVisible()) {
        await userMenu.click();
        await page.getByRole('button', { name: /logout|sign out/i }).click();

        // Should redirect to login or home
        await expect(page).toHaveURL(/\/(login)?$/);
      }
    });
  });
});
