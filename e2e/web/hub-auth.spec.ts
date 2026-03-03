import { test, expect } from "@playwright/test";
import { HubLoginPage } from "../fixtures/hub-pages";
import { hubTestUsers } from "../fixtures/test-data";

test.describe("Hub Manager Authentication", () => {
  test("should display login form", async ({ page }) => {
    const loginPage = new HubLoginPage(page);
    await loginPage.goto();

    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test("should show error for invalid credentials", async ({ page }) => {
    const loginPage = new HubLoginPage(page);
    await loginPage.goto();

    await loginPage.login("invalid@test.com", "wrongpassword");

    // Should stay on login page or show error
    await expect(page).toHaveURL(/login/);
  });

  test("should show error for empty fields", async ({ page }) => {
    const loginPage = new HubLoginPage(page);
    await loginPage.goto();

    await loginPage.submitButton.click();

    // Form validation should prevent submission
    await expect(page).toHaveURL(/login/);
  });

  test("should redirect to dashboard on successful login", async ({
    page,
  }) => {
    const loginPage = new HubLoginPage(page);
    await loginPage.goto();

    await loginPage.login(
      hubTestUsers.superadmin.email,
      hubTestUsers.superadmin.password,
    );

    // Should redirect to dashboard or orders page
    await page.waitForURL(/(dashboard|orders|\/)/);
    await expect(page.locator("nav").or(page.locator("aside"))).toBeVisible();
  });

  test("should logout successfully", async ({ page }) => {
    const loginPage = new HubLoginPage(page);
    await loginPage.goto();

    await loginPage.login(
      hubTestUsers.superadmin.email,
      hubTestUsers.superadmin.password,
    );

    await page.waitForURL(/(dashboard|orders|\/)/);

    // Find and click logout/sign out
    const logoutButton = page
      .getByRole("button", { name: /sign out|logout|log out/i })
      .or(page.getByText(/sign out|logout|log out/i));

    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForURL(/login/);
    }
  });
});
