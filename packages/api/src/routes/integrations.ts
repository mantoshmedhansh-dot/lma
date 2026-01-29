import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate, requireMerchant } from '../middleware/auth.js';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';
import { ApiError } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response.js';
import { logger } from '../lib/logger.js';
import * as shopifyService from '../services/shopify.js';

const router = Router();

// =====================================================
// SHOPIFY INTEGRATION
// =====================================================

const shopifyInstallSchema = z.object({
  shop: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/),
});

/**
 * Initiate Shopify OAuth flow
 * GET /api/v1/integrations/shopify/install
 */
router.get(
  '/shopify/install',
  authenticate,
  requireMerchant,
  validateQuery(shopifyInstallSchema),
  async (req, res, next) => {
    try {
      const { shop } = req.query as { shop: string };

      // Generate state for CSRF protection
      const state = crypto.randomBytes(16).toString('hex');

      // Store state in session/cache (simplified - use Redis in production)
      await supabaseAdmin.from('app_config').upsert({
        key: `shopify_state_${state}`,
        value: {
          merchant_id: req.merchant!.id,
          shop,
          created_at: new Date().toISOString(),
        },
      });

      const authUrl = shopifyService.generateAuthUrl(shop, state);
      res.redirect(authUrl);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Shopify OAuth callback
 * GET /api/v1/integrations/shopify/callback
 */
router.get('/shopify/callback', async (req, res, next) => {
  try {
    const { code, shop, state, hmac } = req.query as {
      code: string;
      shop: string;
      state: string;
      hmac: string;
    };

    if (!code || !shop || !state) {
      throw new ApiError(400, 'INVALID_CALLBACK', 'Missing required parameters');
    }

    // Verify state
    const { data: stateData } = await supabaseAdmin
      .from('app_config')
      .select('value')
      .eq('key', `shopify_state_${state}`)
      .single();

    if (!stateData) {
      throw new ApiError(400, 'INVALID_STATE', 'Invalid or expired state parameter');
    }

    const { merchant_id } = stateData.value as { merchant_id: string };

    // Clean up state
    await supabaseAdmin.from('app_config').delete().eq('key', `shopify_state_${state}`);

    // Exchange code for access token
    const { accessToken, scope } = await shopifyService.exchangeCodeForToken(shop, code);

    // Save store
    const store = await shopifyService.saveStore(merchant_id, shop, accessToken, scope);

    // Get shop details
    const shopDetails = await shopifyService.getShopDetails(store);

    // Update store with details
    await supabaseAdmin
      .from('shopify_stores')
      .update({
        shop_name: shopDetails.name,
        shop_email: shopDetails.email,
        shop_owner: shopDetails.owner,
      })
      .eq('id', store.id);

    // Register webhooks
    const webhookIds = await shopifyService.registerWebhooks(store);
    await supabaseAdmin
      .from('shopify_stores')
      .update({ webhook_ids: webhookIds })
      .eq('id', store.id);

    // Redirect to success page
    const successUrl = `${process.env.WEB_APP_URL}/merchant/integrations/shopify/success?shop=${shop}`;
    res.redirect(successUrl);
  } catch (error) {
    logger.error('Shopify callback error', { error });
    const errorUrl = `${process.env.WEB_APP_URL}/merchant/integrations/shopify/error`;
    res.redirect(errorUrl);
  }
});

/**
 * Shopify webhooks handler
 * POST /api/v1/integrations/shopify/webhooks
 */
router.post('/shopify/webhooks', async (req, res, next) => {
  try {
    const hmac = req.headers['x-shopify-hmac-sha256'] as string;
    const topic = req.headers['x-shopify-topic'] as string;
    const shopDomain = req.headers['x-shopify-shop-domain'] as string;

    // Verify webhook signature
    const rawBody = JSON.stringify(req.body);
    if (!shopifyService.verifyWebhookSignature(rawBody, hmac)) {
      throw new ApiError(401, 'INVALID_SIGNATURE', 'Invalid webhook signature');
    }

    logger.info('Received Shopify webhook', { topic, shop: shopDomain });

    // Get store
    const store = await shopifyService.getStoreByDomain(shopDomain);
    if (!store) {
      logger.warn('Unknown Shopify store', { shop: shopDomain });
      res.status(200).json({ received: true });
      return;
    }

    // Handle webhook based on topic
    switch (topic) {
      case 'orders/create':
        await shopifyService.syncOrderToLMA(store, req.body);
        break;

      case 'orders/updated':
        // Update existing order if needed
        await shopifyService.syncOrderToLMA(store, req.body);
        break;

      case 'orders/cancelled':
        // Handle order cancellation
        const { data: mapping } = await supabaseAdmin
          .from('shopify_order_mapping')
          .select('lma_order_id')
          .eq('shopify_store_id', store.id)
          .eq('shopify_order_id', req.body.id.toString())
          .single();

        if (mapping?.lma_order_id) {
          await supabaseAdmin
            .from('orders')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              cancellation_reason: 'Cancelled in Shopify',
            })
            .eq('id', mapping.lma_order_id);
        }
        break;

      case 'app/uninstalled':
        await shopifyService.handleUninstall(shopDomain);
        break;

      default:
        logger.info('Unhandled Shopify webhook topic', { topic });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Shopify webhook error', { error });
    // Always return 200 to Shopify to prevent retries
    res.status(200).json({ received: true, error: true });
  }
});

/**
 * Get Shopify store status
 * GET /api/v1/integrations/shopify/status
 */
router.get('/shopify/status', authenticate, requireMerchant, async (req, res, next) => {
  try {
    const { data: store } = await supabaseAdmin
      .from('shopify_stores')
      .select('id, shop_domain, shop_name, status, last_sync_at, auto_sync_orders')
      .eq('merchant_id', req.merchant!.id)
      .eq('status', 'active')
      .single();

    sendSuccess(res, {
      connected: !!store,
      store: store || null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Sync orders from Shopify
 * POST /api/v1/integrations/shopify/sync
 */
router.post('/shopify/sync', authenticate, requireMerchant, async (req, res, next) => {
  try {
    const { data: store } = await supabaseAdmin
      .from('shopify_stores')
      .select('*')
      .eq('merchant_id', req.merchant!.id)
      .eq('status', 'active')
      .single();

    if (!store) {
      throw ApiError.notFound('Shopify store not connected');
    }

    // Fetch recent orders
    const orders = await shopifyService.fetchOrders(store, {
      status: 'any',
      limit: 50,
    });

    let synced = 0;
    let failed = 0;

    for (const order of orders) {
      const result = await shopifyService.syncOrderToLMA(store, order);
      if (result) {
        synced++;
      } else {
        failed++;
      }
    }

    // Update last sync time
    await supabaseAdmin
      .from('shopify_stores')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', store.id);

    sendSuccess(res, {
      message: 'Sync completed',
      total: orders.length,
      synced,
      failed,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Disconnect Shopify store
 * DELETE /api/v1/integrations/shopify
 */
router.delete('/shopify', authenticate, requireMerchant, async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from('shopify_stores')
      .update({
        status: 'disconnected',
        access_token: '',
      })
      .eq('merchant_id', req.merchant!.id);

    if (error) {
      throw new ApiError(500, 'DISCONNECT_FAILED', 'Failed to disconnect store');
    }

    sendSuccess(res, { message: 'Shopify store disconnected' });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// 3PL PARTNER INTEGRATION
// =====================================================

/**
 * List available logistics partners
 * GET /api/v1/integrations/logistics/partners
 */
router.get('/logistics/partners', authenticate, async (req, res, next) => {
  try {
    const { data: partners, error } = await supabaseAdmin
      .from('logistics_partners')
      .select('id, name, code, logo_url, supports_cod, supports_express, supports_tracking')
      .eq('is_active', true)
      .order('name');

    if (error) {
      throw new ApiError(500, 'DATABASE_ERROR', error.message);
    }

    sendSuccess(res, partners);
  } catch (error) {
    next(error);
  }
});

/**
 * Get merchant's connected partners
 * GET /api/v1/integrations/logistics/my-partners
 */
router.get('/logistics/my-partners', authenticate, requireMerchant, async (req, res, next) => {
  try {
    const { data: connections, error } = await supabaseAdmin
      .from('merchant_logistics_partners')
      .select(`
        id,
        is_default,
        priority,
        auto_assign,
        status,
        last_used_at,
        partner:logistics_partners (
          id,
          name,
          code,
          logo_url,
          supports_cod,
          supports_express
        )
      `)
      .eq('merchant_id', req.merchant!.id)
      .order('priority', { ascending: false });

    if (error) {
      throw new ApiError(500, 'DATABASE_ERROR', error.message);
    }

    sendSuccess(res, connections);
  } catch (error) {
    next(error);
  }
});

const connectPartnerSchema = z.object({
  partner_id: z.string().uuid(),
  credentials: z.record(z.string()),
  is_default: z.boolean().optional(),
});

/**
 * Connect a logistics partner
 * POST /api/v1/integrations/logistics/connect
 */
router.post(
  '/logistics/connect',
  authenticate,
  requireMerchant,
  validateBody(connectPartnerSchema),
  async (req, res, next) => {
    try {
      const { partner_id, credentials, is_default } = req.body;

      // Check if partner exists
      const { data: partner } = await supabaseAdmin
        .from('logistics_partners')
        .select('id, name')
        .eq('id', partner_id)
        .eq('is_active', true)
        .single();

      if (!partner) {
        throw ApiError.notFound('Logistics partner not found');
      }

      // Check if already connected
      const { data: existing } = await supabaseAdmin
        .from('merchant_logistics_partners')
        .select('id')
        .eq('merchant_id', req.merchant!.id)
        .eq('partner_id', partner_id)
        .single();

      if (existing) {
        throw new ApiError(400, 'ALREADY_CONNECTED', 'Partner already connected');
      }

      // If setting as default, unset other defaults
      if (is_default) {
        await supabaseAdmin
          .from('merchant_logistics_partners')
          .update({ is_default: false })
          .eq('merchant_id', req.merchant!.id);
      }

      // Create connection
      const { data: connection, error } = await supabaseAdmin
        .from('merchant_logistics_partners')
        .insert({
          merchant_id: req.merchant!.id,
          partner_id,
          credentials, // Should be encrypted in production
          is_default: is_default || false,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        throw new ApiError(500, 'CONNECTION_FAILED', 'Failed to connect partner');
      }

      sendCreated(res, {
        message: `Connected to ${partner.name}`,
        connection_id: connection.id,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Disconnect a logistics partner
 * DELETE /api/v1/integrations/logistics/:connectionId
 */
router.delete(
  '/logistics/:connectionId',
  authenticate,
  requireMerchant,
  async (req, res, next) => {
    try {
      const { connectionId } = req.params;

      const { error } = await supabaseAdmin
        .from('merchant_logistics_partners')
        .delete()
        .eq('id', connectionId)
        .eq('merchant_id', req.merchant!.id);

      if (error) {
        throw new ApiError(500, 'DISCONNECT_FAILED', 'Failed to disconnect partner');
      }

      sendSuccess(res, { message: 'Partner disconnected' });
    } catch (error) {
      next(error);
    }
  }
);

// =====================================================
// WEBHOOK MANAGEMENT
// =====================================================

const webhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  description: z.string().optional(),
});

/**
 * List webhook endpoints
 * GET /api/v1/integrations/webhooks
 */
router.get('/webhooks', authenticate, requireMerchant, async (req, res, next) => {
  try {
    const { data: endpoints, error } = await supabaseAdmin
      .from('webhook_endpoints')
      .select('id, url, events, is_active, total_deliveries, total_failures, last_delivery_at')
      .eq('merchant_id', req.merchant!.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new ApiError(500, 'DATABASE_ERROR', error.message);
    }

    sendSuccess(res, endpoints);
  } catch (error) {
    next(error);
  }
});

/**
 * Create webhook endpoint
 * POST /api/v1/integrations/webhooks
 */
router.post(
  '/webhooks',
  authenticate,
  requireMerchant,
  validateBody(webhookSchema),
  async (req, res, next) => {
    try {
      const { url, events, description } = req.body;

      // Generate secret key
      const secretKey = crypto.randomBytes(32).toString('hex');

      const { data: endpoint, error } = await supabaseAdmin
        .from('webhook_endpoints')
        .insert({
          merchant_id: req.merchant!.id,
          url,
          events,
          description,
          secret_key: secretKey,
        })
        .select('id, url, events, secret_key')
        .single();

      if (error) {
        throw new ApiError(500, 'CREATE_FAILED', 'Failed to create webhook');
      }

      sendCreated(res, {
        ...endpoint,
        message: 'Webhook created. Save the secret key - it won\'t be shown again.',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update webhook endpoint
 * PATCH /api/v1/integrations/webhooks/:id
 */
router.patch(
  '/webhooks/:id',
  authenticate,
  requireMerchant,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { url, events, is_active, description } = req.body;

      const updateData: Record<string, unknown> = {};
      if (url !== undefined) updateData.url = url;
      if (events !== undefined) updateData.events = events;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (description !== undefined) updateData.description = description;

      const { error } = await supabaseAdmin
        .from('webhook_endpoints')
        .update(updateData)
        .eq('id', id)
        .eq('merchant_id', req.merchant!.id);

      if (error) {
        throw new ApiError(500, 'UPDATE_FAILED', 'Failed to update webhook');
      }

      sendSuccess(res, { message: 'Webhook updated' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Delete webhook endpoint
 * DELETE /api/v1/integrations/webhooks/:id
 */
router.delete(
  '/webhooks/:id',
  authenticate,
  requireMerchant,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const { error } = await supabaseAdmin
        .from('webhook_endpoints')
        .delete()
        .eq('id', id)
        .eq('merchant_id', req.merchant!.id);

      if (error) {
        throw new ApiError(500, 'DELETE_FAILED', 'Failed to delete webhook');
      }

      sendSuccess(res, { message: 'Webhook deleted' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get webhook delivery logs
 * GET /api/v1/integrations/webhooks/:id/deliveries
 */
router.get(
  '/webhooks/:id/deliveries',
  authenticate,
  requireMerchant,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      const { data: deliveries, count, error } = await supabaseAdmin
        .from('webhook_deliveries')
        .select('*', { count: 'exact' })
        .eq('endpoint_id', id)
        .order('created_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1);

      if (error) {
        throw new ApiError(500, 'DATABASE_ERROR', error.message);
      }

      sendPaginated(res, deliveries || [], {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Test webhook endpoint
 * POST /api/v1/integrations/webhooks/:id/test
 */
router.post(
  '/webhooks/:id/test',
  authenticate,
  requireMerchant,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      // Get endpoint
      const { data: endpoint, error: fetchError } = await supabaseAdmin
        .from('webhook_endpoints')
        .select('*')
        .eq('id', id)
        .eq('merchant_id', req.merchant!.id)
        .single();

      if (fetchError || !endpoint) {
        throw ApiError.notFound('Webhook endpoint not found');
      }

      // Send test webhook
      const testPayload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test webhook from LMA',
        },
      };

      const signature = crypto
        .createHmac('sha256', endpoint.secret_key)
        .update(JSON.stringify(testPayload))
        .digest('hex');

      const startTime = Date.now();
      let responseStatus = 0;
      let responseBody = '';
      let success = false;

      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-LMA-Signature': signature,
            'X-LMA-Event': 'test',
          },
          body: JSON.stringify(testPayload),
        });

        responseStatus = response.status;
        responseBody = await response.text();
        success = response.ok;
      } catch (error) {
        responseBody = error instanceof Error ? error.message : 'Request failed';
      }

      const responseTime = Date.now() - startTime;

      sendSuccess(res, {
        success,
        response_status: responseStatus,
        response_time_ms: responseTime,
        response_body: responseBody.substring(0, 500),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get available webhook events
 * GET /api/v1/integrations/webhooks/events
 */
router.get('/webhooks/events', authenticate, async (req, res, next) => {
  try {
    const events = [
      { name: 'order.created', description: 'When a new order is placed' },
      { name: 'order.confirmed', description: 'When merchant confirms an order' },
      { name: 'order.ready', description: 'When order is ready for pickup' },
      { name: 'order.picked_up', description: 'When driver picks up the order' },
      { name: 'order.delivered', description: 'When order is delivered' },
      { name: 'order.cancelled', description: 'When order is cancelled' },
      { name: 'driver.assigned', description: 'When driver is assigned to order' },
      { name: 'driver.location', description: 'Driver location updates' },
      { name: 'payment.completed', description: 'When payment is completed' },
      { name: 'payment.failed', description: 'When payment fails' },
      { name: 'review.created', description: 'When customer leaves a review' },
    ];

    sendSuccess(res, events);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// ONDC INTEGRATION
// =====================================================

// Import ONDC service dynamically to avoid circular deps
import * as ondcService from '../services/ondc.js';

/**
 * ONDC Protocol Endpoints (BPP - Logistics Provider)
 */

/**
 * Handle ONDC search request
 * POST /api/v1/integrations/ondc/search
 */
router.post('/ondc/search', async (req, res, next) => {
  try {
    const { context, message } = req.body;

    logger.info('ONDC search request', { transactionId: context.transaction_id });

    const response = await ondcService.handleSearch(context, message);

    // Send async callback
    if (context.bap_uri) {
      fetch(`${context.bap_uri}/on_search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response),
      }).catch((err) => logger.error('ONDC callback failed', { err }));
    }

    res.json({
      message: { ack: { status: 'ACK' } },
    });
  } catch (error) {
    logger.error('ONDC search error', { error });
    res.json({
      message: { ack: { status: 'NACK' } },
      error: { type: 'CONTEXT-ERROR', code: '500', message: 'Internal error' },
    });
  }
});

/**
 * Handle ONDC select request
 * POST /api/v1/integrations/ondc/select
 */
router.post('/ondc/select', async (req, res, next) => {
  try {
    const { context, message } = req.body;

    logger.info('ONDC select request', { transactionId: context.transaction_id });

    const response = await ondcService.handleSelect(context, message);

    if (context.bap_uri) {
      fetch(`${context.bap_uri}/on_select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response),
      }).catch((err) => logger.error('ONDC callback failed', { err }));
    }

    res.json({
      message: { ack: { status: 'ACK' } },
    });
  } catch (error) {
    logger.error('ONDC select error', { error });
    res.json({
      message: { ack: { status: 'NACK' } },
      error: { type: 'CONTEXT-ERROR', code: '500', message: 'Internal error' },
    });
  }
});

/**
 * Handle ONDC init request
 * POST /api/v1/integrations/ondc/init
 */
router.post('/ondc/init', async (req, res, next) => {
  try {
    const { context, message } = req.body;

    logger.info('ONDC init request', { transactionId: context.transaction_id });

    const response = await ondcService.handleInit(context, message);

    if (context.bap_uri) {
      fetch(`${context.bap_uri}/on_init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response),
      }).catch((err) => logger.error('ONDC callback failed', { err }));
    }

    res.json({
      message: { ack: { status: 'ACK' } },
    });
  } catch (error) {
    logger.error('ONDC init error', { error });
    res.json({
      message: { ack: { status: 'NACK' } },
      error: { type: 'CONTEXT-ERROR', code: '500', message: 'Internal error' },
    });
  }
});

/**
 * Handle ONDC confirm request
 * POST /api/v1/integrations/ondc/confirm
 */
router.post('/ondc/confirm', async (req, res, next) => {
  try {
    const { context, message } = req.body;

    logger.info('ONDC confirm request', { transactionId: context.transaction_id });

    const response = await ondcService.handleConfirm(context, message);

    if (context.bap_uri) {
      fetch(`${context.bap_uri}/on_confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response),
      }).catch((err) => logger.error('ONDC callback failed', { err }));
    }

    res.json({
      message: { ack: { status: 'ACK' } },
    });
  } catch (error) {
    logger.error('ONDC confirm error', { error });
    res.json({
      message: { ack: { status: 'NACK' } },
      error: { type: 'CONTEXT-ERROR', code: '500', message: 'Internal error' },
    });
  }
});

/**
 * Handle ONDC status request
 * POST /api/v1/integrations/ondc/status
 */
router.post('/ondc/status', async (req, res, next) => {
  try {
    const { context, message } = req.body;

    logger.info('ONDC status request', {
      transactionId: context.transaction_id,
      orderId: message.order_id,
    });

    const response = await ondcService.handleStatus(context, message);

    if (context.bap_uri) {
      fetch(`${context.bap_uri}/on_status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response),
      }).catch((err) => logger.error('ONDC callback failed', { err }));
    }

    res.json({
      message: { ack: { status: 'ACK' } },
    });
  } catch (error) {
    logger.error('ONDC status error', { error });
    res.json({
      message: { ack: { status: 'NACK' } },
      error: { type: 'CONTEXT-ERROR', code: '500', message: 'Internal error' },
    });
  }
});

/**
 * Get ONDC participant status
 * GET /api/v1/integrations/ondc/status
 */
router.get('/ondc/status', authenticate, requireMerchant, async (req, res, next) => {
  try {
    const { data: participant } = await supabaseAdmin
      .from('ondc_participants')
      .select('*')
      .eq('merchant_id', req.merchant!.id)
      .single();

    sendSuccess(res, {
      registered: !!participant,
      participant: participant
        ? {
            subscriber_id: participant.subscriber_id,
            participant_type: participant.participant_type,
            domain: participant.domain,
            is_active: participant.is_active,
            registry_status: participant.registry_status,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Register as ONDC participant
 * POST /api/v1/integrations/ondc/register
 */
router.post('/ondc/register', authenticate, requireMerchant, async (req, res, next) => {
  try {
    const { participant_type, domain } = req.body;

    // Generate keypair for signing and encryption
    const signingKeyPair = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const encryptionKeyPair = crypto.generateKeyPairSync('x25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const subscriberId = `lma.${req.merchant!.id.substring(0, 8)}.ondc.org`;
    const subscriberUrl = `${process.env.API_URL}/api/v1/integrations/ondc`;

    const { data: participant, error } = await supabaseAdmin
      .from('ondc_participants')
      .insert({
        merchant_id: req.merchant!.id,
        subscriber_id: subscriberId,
        subscriber_url: subscriberUrl,
        participant_type: participant_type || 'logistics',
        domain: domain || 'ONDC:LOG10',
        signing_public_key: signingKeyPair.publicKey,
        encryption_public_key: encryptionKeyPair.publicKey,
        registry_status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw new ApiError(500, 'REGISTRATION_FAILED', 'Failed to register ONDC participant');
    }

    sendCreated(res, {
      message: 'ONDC registration initiated',
      subscriber_id: subscriberId,
      next_steps: [
        'Complete KYC verification on ONDC portal',
        'Submit signing and encryption public keys',
        'Wait for ONDC approval',
      ],
    });
  } catch (error) {
    next(error);
  }
});

export default router;
