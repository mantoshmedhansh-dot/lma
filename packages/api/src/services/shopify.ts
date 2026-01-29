/**
 * Shopify Integration Service
 *
 * Handles OAuth authentication, order sync, and fulfillment updates
 * with Shopify stores.
 */

import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../lib/logger.js';

const SHOPIFY_API_VERSION = '2024-01';

interface ShopifyConfig {
  apiKey: string;
  apiSecret: string;
  scopes: string[];
  hostName: string;
}

interface ShopifyStore {
  id: string;
  merchant_id: string;
  shop_domain: string;
  access_token: string;
  status: string;
}

interface ShopifyOrder {
  id: number;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
  };
  shipping_address: {
    first_name: string;
    last_name: string;
    address1: string;
    address2: string;
    city: string;
    province: string;
    country: string;
    zip: string;
    phone: string;
    latitude: number;
    longitude: number;
  };
  line_items: Array<{
    id: number;
    title: string;
    quantity: number;
    price: string;
    sku: string;
    variant_id: number;
    product_id: number;
  }>;
  note: string;
  tags: string;
}

// Get Shopify config from environment
function getShopifyConfig(): ShopifyConfig {
  return {
    apiKey: process.env.SHOPIFY_API_KEY || '',
    apiSecret: process.env.SHOPIFY_API_SECRET || '',
    scopes: [
      'read_orders',
      'write_orders',
      'read_products',
      'read_fulfillments',
      'write_fulfillments',
      'read_shipping',
    ],
    hostName: process.env.SHOPIFY_APP_HOST || 'api.lma.com',
  };
}

/**
 * Generate OAuth authorization URL
 */
export function generateAuthUrl(shop: string, state: string): string {
  const config = getShopifyConfig();
  const redirectUri = `https://${config.hostName}/api/v1/integrations/shopify/callback`;

  const params = new URLSearchParams({
    client_id: config.apiKey,
    scope: config.scopes.join(','),
    redirect_uri: redirectUri,
    state,
  });

  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  shop: string,
  code: string
): Promise<{ accessToken: string; scope: string }> {
  const config = getShopifyConfig();

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.apiKey,
      client_secret: config.apiSecret,
      code,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('Shopify token exchange failed', { shop, error });
    throw new Error('Failed to exchange authorization code');
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    scope: data.scope,
  };
}

/**
 * Verify Shopify webhook signature
 */
export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  const config = getShopifyConfig();
  const hmac = crypto
    .createHmac('sha256', config.apiSecret)
    .update(body, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
}

/**
 * Make authenticated request to Shopify API
 */
async function shopifyRequest<T>(
  store: ShopifyStore,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `https://${store.shop_domain}/admin/api/${SHOPIFY_API_VERSION}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': store.access_token,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('Shopify API error', {
      shop: store.shop_domain,
      endpoint,
      status: response.status,
      error,
    });
    throw new Error(`Shopify API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Get shop details
 */
export async function getShopDetails(store: ShopifyStore): Promise<{
  name: string;
  email: string;
  owner: string;
}> {
  const data = await shopifyRequest<{ shop: Record<string, string> }>(store, '/shop.json');
  return {
    name: data.shop.name,
    email: data.shop.email,
    owner: data.shop.shop_owner,
  };
}

/**
 * Register webhooks for a store
 */
export async function registerWebhooks(store: ShopifyStore): Promise<Record<string, string>> {
  const config = getShopifyConfig();
  const webhookTopics = [
    'orders/create',
    'orders/updated',
    'orders/cancelled',
    'app/uninstalled',
  ];

  const webhookIds: Record<string, string> = {};

  for (const topic of webhookTopics) {
    try {
      const data = await shopifyRequest<{ webhook: { id: number } }>(store, '/webhooks.json', {
        method: 'POST',
        body: JSON.stringify({
          webhook: {
            topic,
            address: `https://${config.hostName}/api/v1/integrations/shopify/webhooks`,
            format: 'json',
          },
        }),
      });
      webhookIds[topic] = data.webhook.id.toString();
      logger.info('Registered Shopify webhook', { shop: store.shop_domain, topic });
    } catch (error) {
      logger.error('Failed to register webhook', { shop: store.shop_domain, topic, error });
    }
  }

  return webhookIds;
}

/**
 * Fetch orders from Shopify
 */
export async function fetchOrders(
  store: ShopifyStore,
  options: {
    status?: string;
    createdAtMin?: string;
    limit?: number;
  } = {}
): Promise<ShopifyOrder[]> {
  const params = new URLSearchParams();
  if (options.status) params.append('status', options.status);
  if (options.createdAtMin) params.append('created_at_min', options.createdAtMin);
  params.append('limit', (options.limit || 50).toString());

  const data = await shopifyRequest<{ orders: ShopifyOrder[] }>(
    store,
    `/orders.json?${params.toString()}`
  );
  return data.orders;
}

/**
 * Sync a Shopify order to LMA
 */
export async function syncOrderToLMA(
  store: ShopifyStore,
  shopifyOrder: ShopifyOrder
): Promise<string | null> {
  try {
    // Check if order already exists
    const { data: existing } = await supabaseAdmin
      .from('shopify_order_mapping')
      .select('lma_order_id')
      .eq('shopify_store_id', store.id)
      .eq('shopify_order_id', shopifyOrder.id.toString())
      .single();

    if (existing?.lma_order_id) {
      logger.info('Order already synced', {
        shopifyOrderId: shopifyOrder.id,
        lmaOrderId: existing.lma_order_id,
      });
      return existing.lma_order_id;
    }

    // Get merchant details
    const { data: merchant } = await supabaseAdmin
      .from('merchants')
      .select('id, user_id')
      .eq('id', store.merchant_id)
      .single();

    if (!merchant) {
      throw new Error('Merchant not found');
    }

    // Create delivery address snapshot
    const addressSnapshot = {
      address_line_1: shopifyOrder.shipping_address.address1,
      address_line_2: shopifyOrder.shipping_address.address2,
      city: shopifyOrder.shipping_address.city,
      state: shopifyOrder.shipping_address.province,
      postal_code: shopifyOrder.shipping_address.zip,
      country: shopifyOrder.shipping_address.country,
    };

    // Create order in LMA
    const { data: lmaOrder, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_id: merchant.user_id, // Will be updated when customer is identified
        merchant_id: store.merchant_id,
        status: 'pending',
        delivery_address_snapshot: addressSnapshot,
        delivery_latitude: shopifyOrder.shipping_address.latitude,
        delivery_longitude: shopifyOrder.shipping_address.longitude,
        pickup_address_snapshot: {}, // Will be filled from merchant
        subtotal: parseFloat(shopifyOrder.subtotal_price),
        delivery_fee: 0, // Will be calculated
        tax_amount: parseFloat(shopifyOrder.total_tax),
        total_amount: parseFloat(shopifyOrder.total_price),
        customer_notes: shopifyOrder.note,
        payment_method_type: shopifyOrder.financial_status === 'paid' ? 'online' : 'cod',
      })
      .select()
      .single();

    if (orderError || !lmaOrder) {
      throw new Error(`Failed to create order: ${orderError?.message}`);
    }

    // Create order items
    for (const item of shopifyOrder.line_items) {
      await supabaseAdmin.from('order_items').insert({
        order_id: lmaOrder.id,
        product_id: null, // External product
        product_name: item.title,
        unit_price: parseFloat(item.price),
        quantity: item.quantity,
        total_price: parseFloat(item.price) * item.quantity,
      });
    }

    // Create mapping record
    await supabaseAdmin.from('shopify_order_mapping').insert({
      shopify_store_id: store.id,
      shopify_order_id: shopifyOrder.id.toString(),
      shopify_order_number: shopifyOrder.name,
      lma_order_id: lmaOrder.id,
      fulfillment_status: shopifyOrder.fulfillment_status,
    });

    logger.info('Synced Shopify order to LMA', {
      shopifyOrderId: shopifyOrder.id,
      lmaOrderId: lmaOrder.id,
    });

    return lmaOrder.id;
  } catch (error) {
    logger.error('Failed to sync Shopify order', {
      shopifyOrderId: shopifyOrder.id,
      error,
    });
    return null;
  }
}

/**
 * Update fulfillment in Shopify
 */
export async function updateFulfillment(
  store: ShopifyStore,
  shopifyOrderId: string,
  fulfillmentData: {
    trackingNumber?: string;
    trackingUrl?: string;
    trackingCompany?: string;
    lineItems?: Array<{ id: number; quantity: number }>;
  }
): Promise<boolean> {
  try {
    // Get order fulfillment orders (locations)
    const orderData = await shopifyRequest<{
      order: { fulfillment_orders: Array<{ id: number }> };
    }>(store, `/orders/${shopifyOrderId}.json?fields=fulfillment_orders`);

    if (!orderData.order.fulfillment_orders?.length) {
      logger.warn('No fulfillment orders found', { shopifyOrderId });
      return false;
    }

    const fulfillmentOrderId = orderData.order.fulfillment_orders[0].id;

    // Create fulfillment
    await shopifyRequest(store, '/fulfillments.json', {
      method: 'POST',
      body: JSON.stringify({
        fulfillment: {
          line_items_by_fulfillment_order: [
            {
              fulfillment_order_id: fulfillmentOrderId,
            },
          ],
          tracking_info: {
            number: fulfillmentData.trackingNumber,
            url: fulfillmentData.trackingUrl,
            company: fulfillmentData.trackingCompany || 'LMA Delivery',
          },
          notify_customer: true,
        },
      }),
    });

    logger.info('Updated Shopify fulfillment', { shopifyOrderId });
    return true;
  } catch (error) {
    logger.error('Failed to update Shopify fulfillment', {
      shopifyOrderId,
      error,
    });
    return false;
  }
}

/**
 * Sync fulfillment status from LMA to Shopify
 */
export async function syncFulfillmentToShopify(orderId: string): Promise<void> {
  // Get order mapping
  const { data: mapping } = await supabaseAdmin
    .from('shopify_order_mapping')
    .select(`
      shopify_order_id,
      shopify_store:shopify_stores (
        id,
        merchant_id,
        shop_domain,
        access_token,
        status
      )
    `)
    .eq('lma_order_id', orderId)
    .single();

  if (!mapping || !mapping.shopify_store) {
    return;
  }

  const store = mapping.shopify_store as unknown as ShopifyStore;
  if (store.status !== 'active') {
    return;
  }

  // Get LMA order status
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('status, order_number')
    .eq('id', orderId)
    .single();

  if (!order || order.status !== 'delivered') {
    return;
  }

  // Update fulfillment in Shopify
  await updateFulfillment(store, mapping.shopify_order_id, {
    trackingCompany: 'LMA Delivery',
    trackingNumber: order.order_number,
  });

  // Update mapping
  await supabaseAdmin
    .from('shopify_order_mapping')
    .update({
      fulfillment_status: 'fulfilled',
      last_synced_at: new Date().toISOString(),
    })
    .eq('lma_order_id', orderId);
}

/**
 * Handle store uninstall
 */
export async function handleUninstall(shopDomain: string): Promise<void> {
  await supabaseAdmin
    .from('shopify_stores')
    .update({
      status: 'disconnected',
      uninstalled_at: new Date().toISOString(),
      access_token: '', // Clear token
    })
    .eq('shop_domain', shopDomain);

  logger.info('Shopify store uninstalled', { shop: shopDomain });
}

/**
 * Get store by domain
 */
export async function getStoreByDomain(shopDomain: string): Promise<ShopifyStore | null> {
  const { data } = await supabaseAdmin
    .from('shopify_stores')
    .select('*')
    .eq('shop_domain', shopDomain)
    .single();

  return data as ShopifyStore | null;
}

/**
 * Save or update store
 */
export async function saveStore(
  merchantId: string,
  shopDomain: string,
  accessToken: string,
  scope: string
): Promise<ShopifyStore> {
  // Check if store exists
  const existing = await getStoreByDomain(shopDomain);

  if (existing) {
    // Update existing store
    const { data } = await supabaseAdmin
      .from('shopify_stores')
      .update({
        merchant_id: merchantId,
        access_token: accessToken,
        scope,
        status: 'active',
        installed_at: new Date().toISOString(),
        uninstalled_at: null,
      })
      .eq('id', existing.id)
      .select()
      .single();

    return data as ShopifyStore;
  }

  // Create new store
  const { data } = await supabaseAdmin
    .from('shopify_stores')
    .insert({
      merchant_id: merchantId,
      shop_domain: shopDomain,
      access_token: accessToken,
      scope,
      status: 'active',
    })
    .select()
    .single();

  return data as ShopifyStore;
}
