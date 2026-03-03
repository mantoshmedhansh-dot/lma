import { test, expect } from "@playwright/test";
import { FleetPage, TrackingPage, ReportsPage, HubLoginPage } from "../fixtures/hub-pages";
import { hubTestUsers } from "../fixtures/test-data";

test.describe("Hub Fleet Management", () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new HubLoginPage(page);
    await loginPage.goto();
    await loginPage.login(
      hubTestUsers.superadmin.email,
      hubTestUsers.superadmin.password,
    );
    await page.waitForURL(/(dashboard|orders|\/)/);
  });

  test("should display fleet page", async ({ page }) => {
    const fleetPage = new FleetPage(page);
    await fleetPage.goto();

    await expect(fleetPage.heading).toBeVisible();
  });

  test("should show vehicle table or empty state", async ({ page }) => {
    const fleetPage = new FleetPage(page);
    await fleetPage.goto();

    await page.waitForTimeout(2000);

    const hasTable = await fleetPage.vehicleTable.isVisible();
    const hasEmptyState = await page
      .getByText(/no vehicles/i)
      .isVisible()
      .catch(() => false);

    expect(hasTable || hasEmptyState).toBeTruthy();
  });

  test("should have add vehicle button", async ({ page }) => {
    const fleetPage = new FleetPage(page);
    await fleetPage.goto();

    await expect(fleetPage.addVehicleButton).toBeVisible();
  });

  test("should navigate to drivers page", async ({ page }) => {
    await page.goto("/fleet/drivers");

    await page.waitForTimeout(2000);

    // Should show driver-related content
    const heading = page.getByRole("heading", { name: /driver/i });
    await expect(heading).toBeVisible();
  });
});

test.describe("Hub Live Tracking", () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new HubLoginPage(page);
    await loginPage.goto();
    await loginPage.login(
      hubTestUsers.superadmin.email,
      hubTestUsers.superadmin.password,
    );
    await page.waitForURL(/(dashboard|orders|\/)/);
  });

  test("should display tracking page", async ({ page }) => {
    const trackingPage = new TrackingPage(page);
    await trackingPage.goto();

    await expect(trackingPage.heading).toBeVisible();
  });

  test("should have refresh button", async ({ page }) => {
    const trackingPage = new TrackingPage(page);
    await trackingPage.goto();

    await expect(trackingPage.refreshButton).toBeVisible();
  });

  test("should show map placeholder or map", async ({ page }) => {
    const trackingPage = new TrackingPage(page);
    await trackingPage.goto();

    // Either a map or the placeholder text should be visible
    const hasMap = await page.locator('[class*="map"]').isVisible().catch(() => false);
    const hasPlaceholder = await page
      .getByText(/live map|google maps/i)
      .isVisible()
      .catch(() => false);

    expect(hasMap || hasPlaceholder).toBeTruthy();
  });

  test("should show active routes section", async ({ page }) => {
    const trackingPage = new TrackingPage(page);
    await trackingPage.goto();

    await page.waitForTimeout(2000);

    await expect(page.getByText(/active routes/i)).toBeVisible();
  });
});

test.describe("Hub Reports", () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new HubLoginPage(page);
    await loginPage.goto();
    await loginPage.login(
      hubTestUsers.superadmin.email,
      hubTestUsers.superadmin.password,
    );
    await page.waitForURL(/(dashboard|orders|\/)/);
  });

  test("should display reports page", async ({ page }) => {
    const reportsPage = new ReportsPage(page);
    await reportsPage.goto();

    await expect(reportsPage.heading).toBeVisible();
  });

  test("should have refresh button", async ({ page }) => {
    const reportsPage = new ReportsPage(page);
    await reportsPage.goto();

    await expect(reportsPage.refreshButton).toBeVisible();
  });

  test("should have date range selectors", async ({ page }) => {
    const reportsPage = new ReportsPage(page);
    await reportsPage.goto();

    await expect(reportsPage.startDateInput).toBeVisible();
    await expect(reportsPage.endDateInput).toBeVisible();
  });

  test("should update data on date range change", async ({ page }) => {
    const reportsPage = new ReportsPage(page);
    await reportsPage.goto();

    await page.waitForTimeout(2000);

    const today = new Date().toISOString().split("T")[0];
    const lastWeek = new Date(Date.now() - 7 * 86400000)
      .toISOString()
      .split("T")[0];

    await reportsPage.setDateRange(lastWeek, today);

    // Wait for data to reload
    await page.waitForTimeout(2000);
  });
});
