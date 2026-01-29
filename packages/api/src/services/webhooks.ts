/**
 * Webhook Delivery Service
 *
 * Handles reliable webhook delivery with retry logic, signature generation,
 * and delivery tracking.
 */

import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../lib/logger.js';

interface WebhookEndpoint {
  id: string;
  merchant_id: string;
  url: string;
  secret_key: string;
  events: string[];
  is_active: boolean;
  retry_count: number;
  timeout_ms: number;
}

interface WebhookPayload {
  event: string;
  event_id: string;
  timestamp: string;
  data: Record<string, unknown>;
}

interface DeliveryResult {
  success: boolean;
  status_code: number;
  response_time_ms: number;
  error?: string;
}

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [60000, 300000, 900000]; // 1 min, 5 min, 15 min

/**
 * Generate HMAC signature for webhook payload
 */
function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Deliver a single webhook
 */
async function deliverWebhook(
  endpoint: WebhookEndpoint,
  payload: WebhookPayload
): Promise<DeliveryResult> {
  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(payloadString, endpoint.secret_key);

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), endpoint.timeout_ms || 30000);

    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LMA-Signature': signature,
        'X-LMA-Event': payload.event,
        'X-LMA-Event-ID': payload.event_id,
        'X-LMA-Timestamp': payload.timestamp,
        'User-Agent': 'LMA-Webhook/1.0',
      },
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseTime = Date.now() - startTime;

    return {
      success: response.ok,
      status_code: response.status,
      response_time_ms: responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      success: false,
      status_code: 0,
      response_time_ms: responseTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Queue a webhook for delivery
 */
export async function queueWebhook(
  merchantId: string,
  event: string,
  data: Record<string, unknown>
): Promise<number> {
  const eventId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const payload: WebhookPayload = {
    event,
    event_id: eventId,
    timestamp,
    data,
  };

  // Get all active endpoints subscribed to this event
  const { data: endpoints, error } = await supabaseAdmin
    .from('webhook_endpoints')
    .select('*')
    .eq('merchant_id', merchantId)
    .eq('is_active', true)
    .contains('events', [event]);

  if (error || !endpoints || endpoints.length === 0) {
    return 0;
  }

  // Queue deliveries
  const deliveries = endpoints.map((endpoint) => ({
    endpoint_id: endpoint.id,
    event_type: event,
    event_id: eventId,
    payload,
    max_attempts: endpoint.retry_count || MAX_RETRY_ATTEMPTS,
  }));

  await supabaseAdmin.from('webhook_deliveries').insert(deliveries);

  logger.info('Queued webhook deliveries', {
    merchantId,
    event,
    eventId,
    count: deliveries.length,
  });

  // Process deliveries asynchronously
  processDeliveries(endpoints.map((e) => e.id));

  return deliveries.length;
}

/**
 * Process pending webhook deliveries
 */
async function processDeliveries(endpointIds?: string[]): Promise<void> {
  // Get pending deliveries
  let query = supabaseAdmin
    .from('webhook_deliveries')
    .select(`
      *,
      endpoint:webhook_endpoints (*)
    `)
    .eq('status', 'pending')
    .lt('attempts', MAX_RETRY_ATTEMPTS)
    .order('scheduled_at', { ascending: true })
    .limit(100);

  if (endpointIds?.length) {
    query = query.in('endpoint_id', endpointIds);
  }

  const { data: deliveries, error } = await query;

  if (error || !deliveries) {
    return;
  }

  for (const delivery of deliveries) {
    const endpoint = delivery.endpoint as unknown as WebhookEndpoint;
    if (!endpoint || !endpoint.is_active) continue;

    const result = await deliverWebhook(endpoint, delivery.payload as WebhookPayload);

    if (result.success) {
      // Mark as delivered
      await supabaseAdmin.rpc('record_webhook_attempt', {
        p_delivery_id: delivery.id,
        p_status: 'delivered',
        p_response_status: result.status_code,
        p_response_body: null,
        p_response_time_ms: result.response_time_ms,
      });

      logger.info('Webhook delivered', {
        deliveryId: delivery.id,
        endpoint: endpoint.url,
        event: delivery.event_type,
      });
    } else {
      // Check if we should retry
      const attempts = delivery.attempts + 1;
      const newStatus = attempts >= delivery.max_attempts ? 'failed' : 'retrying';

      await supabaseAdmin.rpc('record_webhook_attempt', {
        p_delivery_id: delivery.id,
        p_status: newStatus,
        p_response_status: result.status_code,
        p_response_body: null,
        p_response_time_ms: result.response_time_ms,
        p_error: result.error,
      });

      if (newStatus === 'retrying') {
        // Schedule retry
        const retryDelay = RETRY_DELAYS[Math.min(attempts - 1, RETRY_DELAYS.length - 1)];
        const scheduledAt = new Date(Date.now() + retryDelay).toISOString();

        await supabaseAdmin
          .from('webhook_deliveries')
          .update({ status: 'pending', scheduled_at: scheduledAt })
          .eq('id', delivery.id);
      }

      logger.warn('Webhook delivery failed', {
        deliveryId: delivery.id,
        endpoint: endpoint.url,
        event: delivery.event_type,
        attempts,
        error: result.error,
      });
    }
  }
}

/**
 * Trigger order event webhook
 */
export async function triggerOrderWebhook(
  orderId: string,
  event: string
): Promise<void> {
  // Get order with merchant
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select(`
      *,
      merchant:merchants (id, business_name),
      customer:users!orders_customer_id_fkey (id, first_name, last_name, email),
      driver:drivers (
        id,
        user:users (first_name, last_name)
      ),
      items:order_items (id, product_name, quantity, total_price)
    `)
    .eq('id', orderId)
    .single();

  if (error || !order) {
    logger.error('Failed to get order for webhook', { orderId, error });
    return;
  }

  const data = {
    order_id: order.id,
    order_number: order.order_number,
    status: order.status,
    total_amount: order.total_amount,
    delivery_fee: order.delivery_fee,
    delivery_address: order.delivery_address_snapshot,
    merchant: {
      id: (order.merchant as Record<string, unknown>)?.id,
      name: (order.merchant as Record<string, unknown>)?.business_name,
    },
    customer: {
      name: `${(order.customer as Record<string, unknown>)?.first_name} ${(order.customer as Record<string, unknown>)?.last_name}`,
      email: (order.customer as Record<string, unknown>)?.email,
    },
    driver: order.driver
      ? {
          id: (order.driver as Record<string, unknown>)?.id,
          name: `${((order.driver as Record<string, unknown>)?.user as Record<string, unknown>)?.first_name} ${((order.driver as Record<string, unknown>)?.user as Record<string, unknown>)?.last_name}`,
        }
      : null,
    items: order.items,
    created_at: order.created_at,
    updated_at: order.updated_at,
  };

  await queueWebhook(order.merchant_id, event, data);
}

/**
 * Retry failed webhooks (called by scheduler)
 */
export async function retryFailedWebhooks(): Promise<number> {
  // Get deliveries that need retry
  const { data: deliveries, error } = await supabaseAdmin
    .from('webhook_deliveries')
    .select('id')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .lt('attempts', MAX_RETRY_ATTEMPTS)
    .limit(100);

  if (error || !deliveries) {
    return 0;
  }

  await processDeliveries();
  return deliveries.length;
}

/**
 * Clean up old webhook deliveries
 */
export async function cleanupOldDeliveries(daysToKeep: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const { count, error } = await supabaseAdmin
    .from('webhook_deliveries')
    .delete()
    .lt('created_at', cutoffDate.toISOString())
    .in('status', ['delivered', 'failed']);

  if (error) {
    logger.error('Failed to cleanup webhook deliveries', { error });
    return 0;
  }

  return count || 0;
}
