import { test, expect } from "@playwright/test";
import { RoutesPage, HubLoginPage } from "../fixtures/hub-pages";
import { hubTestUsers } from "../fixtures/test-data";

test.describe("Hub Routes", () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new HubLoginPage(page);
    await loginPage.goto();
    await loginPage.login(
      hubTestUsers.superadmin.email,
      hubTestUsers.superadmin.password,
    );
    await page.waitForURL(/(dashboard|orders|\/)/);
  });

  test("should display routes page with heading", async ({ page }) => {
    const routesPage = new RoutesPage(page);
    await routesPage.goto();

    await expect(routesPage.heading).toBeVisible();
  });

  test("should have date filter", async ({ page }) => {
    const routesPage = new RoutesPage(page);
    await routesPage.goto();

    await expect(routesPage.dateFilter).toBeVisible();
  });

  test("should have status filter", async ({ page }) => {
    const routesPage = new RoutesPage(page);
    await routesPage.goto();

    await expect(routesPage.statusFilter).toBeVisible();
  });

  test("should have Plan Routes button", async ({ page }) => {
    const routesPage = new RoutesPage(page);
    await routesPage.goto();

    await expect(routesPage.planButton).toBeVisible();
  });

  test("should navigate to route planning page", async ({ page }) => {
    const routesPage = new RoutesPage(page);
    await routesPage.goto();

    await routesPage.planButton.click();
    await page.waitForURL(/routes\/plan/);
  });

  test("should filter routes by date", async ({ page }) => {
    const routesPage = new RoutesPage(page);
    await routesPage.goto();

    const today = new Date().toISOString().split("T")[0];
    await routesPage.filterByDate(today);

    // Wait for data to reload
    await page.waitForTimeout(1000);
  });

  test("should filter routes by status", async ({ page }) => {
    const routesPage = new RoutesPage(page);
    await routesPage.goto();

    await routesPage.filterByStatus("planned");

    // Wait for data to reload
    await page.waitForTimeout(1000);
  });

  test("should show empty state or route cards", async ({ page }) => {
    const routesPage = new RoutesPage(page);
    await routesPage.goto();

    // Wait for load
    await page.waitForTimeout(2000);

    // Either route cards or empty state should be visible
    const hasRoutes = await routesPage.routeCards.first().isVisible();
    const hasEmptyState = await page.getByText(/no routes/i).isVisible();

    expect(hasRoutes || hasEmptyState).toBeTruthy();
  });
});
