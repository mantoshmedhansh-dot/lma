import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for common pages
 */

export class HomePage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly merchantCards: Locator;
  readonly categoryCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder(/search/i);
    this.merchantCards = page.locator('[data-testid="merchant-card"]');
    this.categoryCards = page.locator('[data-testid="category-card"]');
  }

  async goto() {
    await this.page.goto('/');
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.page.keyboard.press('Enter');
  }

  async selectMerchant(name: string) {
    await this.page.getByRole('link', { name: new RegExp(name, 'i') }).click();
  }
}

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel(/email/i);
    this.passwordInput = page.getByLabel(/password/i);
    this.submitButton = page.getByRole('button', { name: /sign in|log in/i });
    this.errorMessage = page.locator('[data-testid="error-message"]');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectError(message: string) {
    await expect(this.errorMessage).toContainText(message);
  }
}

export class SignupPage {
  readonly page: Page;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.firstNameInput = page.getByLabel(/first name/i);
    this.lastNameInput = page.getByLabel(/last name/i);
    this.emailInput = page.getByLabel(/email/i);
    this.passwordInput = page.getByLabel(/password/i);
    this.submitButton = page.getByRole('button', { name: /sign up|register/i });
  }

  async goto() {
    await this.page.goto('/signup');
  }

  async signup(firstName: string, lastName: string, email: string, password: string) {
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.fill(lastName);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}

export class MerchantPage {
  readonly page: Page;
  readonly merchantName: Locator;
  readonly menuCategories: Locator;
  readonly productCards: Locator;
  readonly addToCartButtons: Locator;
  readonly viewCartButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.merchantName = page.locator('h1');
    this.menuCategories = page.locator('[data-testid="menu-category"]');
    this.productCards = page.locator('[data-testid="product-card"]');
    this.addToCartButtons = page.getByRole('button', { name: /add/i });
    this.viewCartButton = page.getByRole('button', { name: /view cart/i });
  }

  async addProductToCart(productName: string) {
    const productCard = this.page.locator(`[data-testid="product-card"]:has-text("${productName}")`);
    await productCard.getByRole('button', { name: /add/i }).click();
  }

  async goToCart() {
    await this.viewCartButton.click();
  }
}

export class CartPage {
  readonly page: Page;
  readonly cartItems: Locator;
  readonly subtotal: Locator;
  readonly checkoutButton: Locator;
  readonly emptyCartMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cartItems = page.locator('[data-testid="cart-item"]');
    this.subtotal = page.locator('[data-testid="subtotal"]');
    this.checkoutButton = page.getByRole('button', { name: /checkout|proceed/i });
    this.emptyCartMessage = page.getByText(/cart is empty/i);
  }

  async goto() {
    await this.page.goto('/cart');
  }

  async updateQuantity(productName: string, quantity: number) {
    const item = this.page.locator(`[data-testid="cart-item"]:has-text("${productName}")`);
    await item.getByLabel(/quantity/i).fill(String(quantity));
  }

  async removeItem(productName: string) {
    const item = this.page.locator(`[data-testid="cart-item"]:has-text("${productName}")`);
    await item.getByRole('button', { name: /remove/i }).click();
  }

  async proceedToCheckout() {
    await this.checkoutButton.click();
  }
}

export class CheckoutPage {
  readonly page: Page;
  readonly addressSelector: Locator;
  readonly paymentMethodSelector: Locator;
  readonly placeOrderButton: Locator;
  readonly orderSummary: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addressSelector = page.locator('[data-testid="address-selector"]');
    this.paymentMethodSelector = page.locator('[data-testid="payment-method"]');
    this.placeOrderButton = page.getByRole('button', { name: /place order/i });
    this.orderSummary = page.locator('[data-testid="order-summary"]');
  }

  async goto() {
    await this.page.goto('/checkout');
  }

  async selectAddress(label: string) {
    await this.addressSelector.selectOption({ label });
  }

  async selectPaymentMethod(method: string) {
    await this.page.getByLabel(new RegExp(method, 'i')).click();
  }

  async placeOrder() {
    await this.placeOrderButton.click();
  }
}
