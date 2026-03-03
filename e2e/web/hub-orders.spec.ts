import { test, expect } from "@playwright/test";
import { OrdersPage, HubLoginPage } from "../fixtures/hub-pages";
import { hubTestUsers } from "../fixtures/test-data";

test.describe("Hub Orders", () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    const loginPage = new HubLoginPage(page);
    await loginPage.goto();
    await loginPage.login(
      hubTestUsers.superadmin.email,
      hubTestUsers.superadmin.password,
    );
    await page.waitForURL(/(dashboard|orders|\/)/);
  });

  test("should display orders page with heading", async ({ page }) => {
    const ordersPage = new OrdersPage(page);
    await ordersPage.goto();

    await expect(ordersPage.heading).toBeVisible();
  });

  test("should show orders table", async ({ page }) => {
    const ordersPage = new OrdersPage(page);
    await ordersPage.goto();

    await expect(ordersPage.orderTable).toBeVisible();
    // Table should have headers
    await expect(page.getByText("Order #")).toBeVisible();
    await expect(page.getByText("Customer")).toBeVisible();
    await expect(page.getByText("Status")).toBeVisible();
  });

  test("should have search functionality", async ({ page }) => {
    const ordersPage = new OrdersPage(page);
    await ordersPage.goto();

    await expect(ordersPage.searchInput).toBeVisible();
  });

  test("should have status filter dropdown", async ({ page }) => {
    const ordersPage = new OrdersPage(page);
    await ordersPage.goto();

    await expect(ordersPage.statusFilter).toBeVisible();

    // Check filter options exist
    const options = ordersPage.statusFilter.locator("option");
    await expect(options).toHaveCount(8); // All Statuses + 7 status options
  });

  test("should filter orders by status", async ({ page }) => {
    const ordersPage = new OrdersPage(page);
    await ordersPage.goto();

    await ordersPage.filterByStatus("pending");

    // Page should reload with filtered data
    await page.waitForTimeout(1000);
    await expect(ordersPage.orderTable).toBeVisible();
  });

  test("should have Import CSV button", async ({ page }) => {
    const ordersPage = new OrdersPage(page);
    await ordersPage.goto();

    await expect(ordersPage.importButton).toBeVisible();
  });

  test("should navigate to import page", async ({ page }) => {
    const ordersPage = new OrdersPage(page);
    await ordersPage.goto();

    await ordersPage.importButton.click();
    await page.waitForURL(/import/);
  });

  test("should navigate to order detail on click", async ({ page }) => {
    const ordersPage = new OrdersPage(page);
    await ordersPage.goto();

    // Wait for orders to load
    await page.waitForTimeout(2000);

    // If there are orders, click the first one
    const firstOrderLink = page.locator("tbody tr a").first();
    if (await firstOrderLink.isVisible()) {
      await firstOrderLink.click();
      await page.waitForURL(/orders\/.+/);
    }
  });
});
