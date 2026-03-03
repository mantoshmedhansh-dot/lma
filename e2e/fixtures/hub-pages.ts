import { Page, Locator, expect } from "@playwright/test";

/**
 * Page Object Models for Hub Operations Dashboard
 */

export class HubLoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel(/email/i);
    this.passwordInput = page.getByLabel(/password/i);
    this.submitButton = page.getByRole("button", { name: /sign in|log in/i });
    this.errorMessage = page.locator('[data-testid="error-message"]');
  }

  async goto() {
    await this.page.goto("/login");
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}

export class OrdersPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly statusFilter: Locator;
  readonly applyButton: Locator;
  readonly orderTable: Locator;
  readonly orderRows: Locator;
  readonly importButton: Locator;
  readonly newOrderButton: Locator;
  readonly statCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: /orders/i });
    this.searchInput = page.getByPlaceholder(/search/i);
    this.statusFilter = page.locator("select");
    this.applyButton = page.getByRole("button", { name: /apply/i });
    this.orderTable = page.locator("table");
    this.orderRows = page.locator("tbody tr");
    this.importButton = page.getByRole("link", { name: /import csv/i });
    this.newOrderButton = page.getByRole("link", { name: /new order/i });
    this.statCards = page.locator('[class*="stat"]');
  }

  async goto() {
    await this.page.goto("/orders");
  }

  async filterByStatus(status: string) {
    await this.statusFilter.selectOption(status);
    await this.applyButton.click();
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.page.keyboard.press("Enter");
  }

  async clickOrder(orderNumber: string) {
    await this.page
      .getByRole("link", { name: new RegExp(orderNumber) })
      .click();
  }
}

export class RoutesPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly dateFilter: Locator;
  readonly statusFilter: Locator;
  readonly planButton: Locator;
  readonly routeCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: /routes/i });
    this.dateFilter = page.locator('input[type="date"]');
    this.statusFilter = page.locator("select");
    this.planButton = page.getByRole("link", { name: /plan routes/i });
    this.routeCards = page.locator('[class*="rounded-lg"][class*="border"]');
  }

  async goto() {
    await this.page.goto("/routes");
  }

  async filterByDate(date: string) {
    await this.dateFilter.fill(date);
  }

  async filterByStatus(status: string) {
    await this.statusFilter.selectOption(status);
  }

  async clickRoute(routeName: string) {
    await this.page
      .getByRole("link", { name: new RegExp(routeName) })
      .click();
  }
}

export class FleetPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly addVehicleButton: Locator;
  readonly vehicleTable: Locator;
  readonly vehicleRows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: /fleet|vehicles/i });
    this.addVehicleButton = page.getByRole("button", {
      name: /add vehicle/i,
    });
    this.vehicleTable = page.locator("table");
    this.vehicleRows = page.locator("tbody tr");
  }

  async goto() {
    await this.page.goto("/fleet");
  }
}

export class TrackingPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly refreshButton: Locator;
  readonly mapContainer: Locator;
  readonly routeCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: /live tracking/i });
    this.refreshButton = page.getByRole("button", { name: /refresh/i });
    this.mapContainer = page.locator('[class*="map"]').or(
      page.getByText(/live map/i),
    );
    this.routeCards = page.locator('[class*="card"]');
  }

  async goto() {
    await this.page.goto("/tracking");
  }
}

export class ReportsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly refreshButton: Locator;
  readonly startDateInput: Locator;
  readonly endDateInput: Locator;
  readonly statCards: Locator;
  readonly dailyTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: /reports/i });
    this.refreshButton = page.getByRole("button", { name: /refresh/i });
    const dateInputs = page.locator('input[type="date"]');
    this.startDateInput = dateInputs.first();
    this.endDateInput = dateInputs.last();
    this.statCards = page.locator('[class*="stat"]');
    this.dailyTable = page.locator("table");
  }

  async goto() {
    await this.page.goto("/reports");
  }

  async setDateRange(start: string, end: string) {
    await this.startDateInput.fill(start);
    await this.endDateInput.fill(end);
  }
}
