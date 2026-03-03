/**
 * Test data fixtures for E2E tests
 */

export const testUsers = {
  customer: {
    email: "e2e-customer@test.com",
    password: "TestPassword123!",
    firstName: "Test",
    lastName: "Customer",
  },
  merchant: {
    email: "e2e-merchant@test.com",
    password: "TestPassword123!",
    businessName: "E2E Test Restaurant",
  },
  admin: {
    email: "e2e-admin@test.com",
    password: "TestPassword123!",
  },
};

export const testMerchant = {
  name: "Test Restaurant",
  slug: "test-restaurant",
  type: "restaurant",
  city: "Mumbai",
};

export const testProduct = {
  name: "Test Product",
  price: 250,
  description: "A delicious test product",
};

export const testAddress = {
  label: "Home",
  addressLine1: "123 Test Street",
  city: "Mumbai",
  state: "Maharashtra",
  postalCode: "400001",
  country: "India",
};

/**
 * Hub Operations test data
 */
export const hubTestUsers = {
  superadmin: {
    email: "themanagingdirector@aquapurite.com",
    password: "Admin@123",
  },
  hubManager: {
    email: "e2e-hubmanager@test.com",
    password: "TestPassword123!",
  },
};

export const testOrder = {
  orderNumber: "TEST-001",
  customerName: "Test Customer",
  customerPhone: "+919876543210",
  deliveryAddress: "123 Test Street, Mumbai, MH 400001",
  productDescription: "Water Purifier RO System",
  totalWeightKg: 12.5,
  priority: "normal",
  source: "manual",
};

export const testVehicle = {
  vehicleNumber: "MH-01-AB-1234",
  vehicleType: "van",
  capacityKg: 500,
};
