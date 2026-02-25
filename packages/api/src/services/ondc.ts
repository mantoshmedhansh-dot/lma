/**
 * ONDC (Open Network for Digital Commerce) Integration Service
 *
 * Implements ONDC protocol for logistics services in India.
 * Supports both Buyer App (BAP) and Seller App (BPP) roles.
 *
 * Reference: https://ondc.org/protocol-specs/
 */

import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../lib/logger.js';

// ONDC Protocol Version
const ONDC_PROTOCOL_VERSION = '1.2.0';

// ONDC Domains
export const ONDC_DOMAINS = {
  RETAIL: 'ONDC:RET10',
  LOGISTICS: 'ONDC:LOG10',
  FOOD_DELIVERY: 'ONDC:RET11',
} as const;

// ONDC Actions
export const ONDC_ACTIONS = {
  SEARCH: 'search',
  ON_SEARCH: 'on_search',
  SELECT: 'select',
  ON_SELECT: 'on_select',
  INIT: 'init',
  ON_INIT: 'on_init',
  CONFIRM: 'confirm',
  ON_CONFIRM: 'on_confirm',
  STATUS: 'status',
  ON_STATUS: 'on_status',
  TRACK: 'track',
  ON_TRACK: 'on_track',
  CANCEL: 'cancel',
  ON_CANCEL: 'on_cancel',
  UPDATE: 'update',
  ON_UPDATE: 'on_update',
  SUPPORT: 'support',
  ON_SUPPORT: 'on_support',
} as const;

// ONDC Order States
export const ONDC_ORDER_STATES = {
  CREATED: 'Created',
  ACCEPTED: 'Accepted',
  IN_PROGRESS: 'In-progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
} as const;

// ONDC Fulfillment States for Logistics
export const ONDC_FULFILLMENT_STATES = {
  PENDING: 'Pending',
  SEARCHING_AGENT: 'Searching-for-Agent',
  AGENT_ASSIGNED: 'Agent-assigned',
  AT_PICKUP: 'At-pickup',
  PICKED_UP: 'Picked-up',
  IN_TRANSIT: 'In-transit',
  AT_DESTINATION: 'At-destination',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RTO_INITIATED: 'RTO-Initiated',
  RTO_DELIVERED: 'RTO-Delivered',
} as const;

interface ONDCContext {
  domain: string;
  action: string;
  country: string;
  city: string;
  core_version: string;
  bap_id: string;
  bap_uri: string;
  bpp_id?: string;
  bpp_uri?: string;
  transaction_id: string;
  message_id: string;
  timestamp: string;
  ttl?: string;
}

interface ONDCMessage {
  context: ONDCContext;
  message: Record<string, unknown>;
}

interface ONDCParticipant {
  id: string;
  merchant_id: string | null;
  subscriber_id: string;
  subscriber_url: string;
  participant_type: string;
  domain: string;
  signing_public_key: string;
  encryption_public_key: string;
  is_active: boolean;
}

// Environment config
function getONDCConfig() {
  return {
    subscriberId: process.env.ONDC_SUBSCRIBER_ID || '',
    subscriberUrl: process.env.ONDC_SUBSCRIBER_URL || '',
    registryUrl: process.env.ONDC_REGISTRY_URL || 'https://registry.ondc.org/ondc',
    gatewayUrl: process.env.ONDC_GATEWAY_URL || 'https://gateway.ondc.org',
    signingPrivateKey: process.env.ONDC_SIGNING_PRIVATE_KEY || '',
    encryptionPrivateKey: process.env.ONDC_ENCRYPTION_PRIVATE_KEY || '',
    signingPublicKey: process.env.ONDC_SIGNING_PUBLIC_KEY || '',
    encryptionPublicKey: process.env.ONDC_ENCRYPTION_PUBLIC_KEY || '',
    cityCode: process.env.ONDC_CITY_CODE || 'std:011', // Delhi
  };
}

/**
 * Generate ONDC context
 */
export function createContext(
  action: string,
  options: {
    domain?: string;
    transactionId?: string;
    messageId?: string;
    bapId?: string;
    bapUri?: string;
    bppId?: string;
    bppUri?: string;
  } = {}
): ONDCContext {
  const config = getONDCConfig();

  return {
    domain: options.domain || ONDC_DOMAINS.LOGISTICS,
    action,
    country: 'IND',
    city: config.cityCode,
    core_version: ONDC_PROTOCOL_VERSION,
    bap_id: options.bapId || config.subscriberId,
    bap_uri: options.bapUri || config.subscriberUrl,
    bpp_id: options.bppId,
    bpp_uri: options.bppUri,
    transaction_id: options.transactionId || crypto.randomUUID(),
    message_id: options.messageId || crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ttl: 'PT30S',
  };
}

/**
 * Sign ONDC request
 */
function signRequest(body: string): string {
  const config = getONDCConfig();

  // Create Blake2b-512 hash
  const hash = crypto.createHash('blake2b512').update(body).digest('base64');

  // Create signature header
  const created = Math.floor(Date.now() / 1000);
  const expires = created + 300; // 5 minutes

  const signatureInput = `(created): ${created}\n(expires): ${expires}\ndigest: BLAKE-512=${hash}`;

  const signature = crypto
    .createSign('RSA-SHA256')
    .update(signatureInput)
    .sign(config.signingPrivateKey, 'base64');

  return `Signature keyId="${config.subscriberId}|ed25519|${config.signingPublicKey}",algorithm="ed25519",created="${created}",expires="${expires}",headers="(created) (expires) digest",signature="${signature}"`;
}

/**
 * Verify ONDC request signature
 */
export function verifySignature(
  body: string,
  authHeader: string,
  publicKey: string
): boolean {
  try {
    // Parse authorization header
    const params = new Map<string, string>();
    authHeader
      .replace('Signature ', '')
      .split(',')
      .forEach((pair) => {
        const [key, value] = pair.split('=');
        params.set(key, value.replace(/"/g, ''));
      });

    const signature = params.get('signature');
    const created = params.get('created');
    const expires = params.get('expires');

    if (!signature || !created || !expires) {
      return false;
    }

    // Check expiry
    if (parseInt(expires) < Math.floor(Date.now() / 1000)) {
      return false;
    }

    // Create hash
    const hash = crypto.createHash('blake2b512').update(body).digest('base64');

    // Reconstruct signature input
    const signatureInput = `(created): ${created}\n(expires): ${expires}\ndigest: BLAKE-512=${hash}`;

    // Verify signature
    return crypto
      .createVerify('RSA-SHA256')
      .update(signatureInput)
      .verify(publicKey, signature, 'base64');
  } catch (error) {
    logger.error('ONDC signature verification failed', { error });
    return false;
  }
}

/**
 * Send ONDC request
 */
async function sendONDCRequest(
  url: string,
  message: ONDCMessage
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const body = JSON.stringify(message);
  const authorization = signRequest(body);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      body,
    });

    const data = await response.json();

    // Log transaction
    await logTransaction(message.context, message.message, data);

    if (!response.ok) {
      return { success: false, error: data.error?.message || 'Request failed' };
    }

    return { success: true, data };
  } catch (error) {
    logger.error('ONDC request failed', { url, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Request failed',
    };
  }
}

/**
 * Log ONDC transaction
 */
async function logTransaction(
  context: ONDCContext,
  request: Record<string, unknown>,
  response?: unknown
): Promise<void> {
  try {
    // Get participant
    const { data: participant } = await supabaseAdmin
      .from('ondc_participants')
      .select('id')
      .eq('subscriber_id', context.bap_id)
      .single();

    if (participant) {
      await supabaseAdmin.from('ondc_transactions').insert({
        participant_id: participant.id,
        transaction_id: context.transaction_id,
        message_id: context.message_id,
        action: context.action,
        domain: context.domain,
        bap_id: context.bap_id,
        bpp_id: context.bpp_id,
        request_payload: request,
        response_payload: response,
        request_at: context.timestamp,
        response_at: response ? new Date().toISOString() : null,
        status: response ? 'completed' : 'pending',
      });
    }
  } catch (error) {
    logger.error('Failed to log ONDC transaction', { error });
  }
}

// =====================================================
// LOGISTICS PROVIDER (BPP) METHODS
// =====================================================

/**
 * Handle search request - return available logistics services
 */
export async function handleSearch(
  context: ONDCContext,
  message: {
    intent: {
      fulfillment: {
        type: string;
        start: { location: { gps: string } };
        end: { location: { gps: string } };
      };
      payment?: { type: string };
      category?: { id: string };
    };
  }
): Promise<ONDCMessage> {
  const { fulfillment } = message.intent;

  // Parse pickup and delivery locations
  const [pickupLat, pickupLng] = fulfillment.start.location.gps.split(',').map(Number);
  const [deliveryLat, deliveryLng] = fulfillment.end.location.gps.split(',').map(Number);

  // Calculate distance and estimate
  const distance = calculateDistance(pickupLat, pickupLng, deliveryLat, deliveryLng);
  const estimatedTime = Math.ceil(distance * 3); // ~3 min per km

  // Build catalog of services
  const catalog = {
    'bpp/descriptor': {
      name: 'LMA Logistics',
      short_desc: 'Last Mile Delivery Services',
      long_desc: 'Fast and reliable last mile delivery services',
      images: ['https://lma.com/logo.png'],
    },
    'bpp/providers': [
      {
        id: 'lma-standard',
        descriptor: {
          name: 'LMA Standard Delivery',
          short_desc: 'Standard delivery service',
        },
        categories: [
          { id: 'Immediate Delivery', descriptor: { name: 'Immediate Delivery' } },
          { id: 'Same Day Delivery', descriptor: { name: 'Same Day Delivery' } },
        ],
        items: [
          {
            id: 'standard-delivery',
            descriptor: {
              name: 'Standard Delivery',
              short_desc: 'Delivery within 45-60 minutes',
              code: 'P2P',
            },
            category_id: 'Immediate Delivery',
            price: {
              currency: 'INR',
              value: calculateDeliveryPrice(distance).toString(),
            },
            fulfillment_id: 'f1',
            time: {
              label: 'TAT',
              duration: `PT${estimatedTime}M`,
            },
          },
          {
            id: 'express-delivery',
            descriptor: {
              name: 'Express Delivery',
              short_desc: 'Delivery within 30 minutes',
              code: 'P2P',
            },
            category_id: 'Immediate Delivery',
            price: {
              currency: 'INR',
              value: (calculateDeliveryPrice(distance) * 1.5).toString(),
            },
            fulfillment_id: 'f2',
            time: {
              label: 'TAT',
              duration: `PT${Math.ceil(estimatedTime * 0.6)}M`,
            },
          },
        ],
        fulfillments: [
          {
            id: 'f1',
            type: 'Delivery',
            tracking: true,
          },
          {
            id: 'f2',
            type: 'Delivery',
            tracking: true,
          },
        ],
      },
    ],
  };

  const config = getONDCConfig();

  return {
    context: {
      ...context,
      action: ONDC_ACTIONS.ON_SEARCH,
      bpp_id: config.subscriberId,
      bpp_uri: config.subscriberUrl,
      message_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
    message: { catalog },
  };
}

/**
 * Handle select request - confirm service selection
 */
export async function handleSelect(
  context: ONDCContext,
  message: {
    order: {
      items: Array<{ id: string; quantity: { count: number } }>;
      fulfillment: {
        id: string;
        start: { location: { gps: string; address: Record<string, string> } };
        end: { location: { gps: string; address: Record<string, string> } };
      };
    };
  }
): Promise<ONDCMessage> {
  const { order } = message;
  const item = order.items[0];

  // Calculate quote
  const [pickupLat, pickupLng] = order.fulfillment.start.location.gps.split(',').map(Number);
  const [deliveryLat, deliveryLng] = order.fulfillment.end.location.gps.split(',').map(Number);
  const distance = calculateDistance(pickupLat, pickupLng, deliveryLat, deliveryLng);

  const basePrice = calculateDeliveryPrice(distance);
  const isExpress = item.id === 'express-delivery';
  const price = isExpress ? basePrice * 1.5 : basePrice;

  const config = getONDCConfig();

  return {
    context: {
      ...context,
      action: ONDC_ACTIONS.ON_SELECT,
      bpp_id: config.subscriberId,
      bpp_uri: config.subscriberUrl,
      message_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
    message: {
      order: {
        provider: { id: 'lma-standard' },
        items: order.items,
        fulfillment: {
          ...order.fulfillment,
          tracking: true,
          state: { descriptor: { code: ONDC_FULFILLMENT_STATES.PENDING } },
        },
        quote: {
          price: { currency: 'INR', value: price.toString() },
          breakup: [
            {
              title: 'Delivery Charges',
              price: { currency: 'INR', value: price.toString() },
            },
          ],
          ttl: 'PT15M',
        },
      },
    },
  };
}

/**
 * Handle init request - initialize order
 */
export async function handleInit(
  context: ONDCContext,
  message: {
    order: {
      items: Array<{ id: string }>;
      fulfillment: {
        id: string;
        start: Record<string, unknown>;
        end: Record<string, unknown>;
      };
      billing: Record<string, unknown>;
      payment: { type: string };
    };
  }
): Promise<ONDCMessage> {
  const config = getONDCConfig();

  return {
    context: {
      ...context,
      action: ONDC_ACTIONS.ON_INIT,
      bpp_id: config.subscriberId,
      bpp_uri: config.subscriberUrl,
      message_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
    message: {
      order: {
        provider: { id: 'lma-standard' },
        items: message.order.items,
        fulfillment: {
          ...message.order.fulfillment,
          tracking: true,
          state: { descriptor: { code: ONDC_FULFILLMENT_STATES.PENDING } },
        },
        billing: message.order.billing,
        payment: {
          ...message.order.payment,
          status: 'NOT-PAID',
          collected_by: 'BAP',
        },
        cancellation_terms: [
          {
            fulfillment_state: { descriptor: { code: ONDC_FULFILLMENT_STATES.PENDING } },
            cancellation_fee: { percentage: '0' },
          },
          {
            fulfillment_state: { descriptor: { code: ONDC_FULFILLMENT_STATES.AGENT_ASSIGNED } },
            cancellation_fee: { percentage: '25' },
          },
          {
            fulfillment_state: { descriptor: { code: ONDC_FULFILLMENT_STATES.PICKED_UP } },
            cancellation_fee: { percentage: '50' },
          },
        ],
      },
    },
  };
}

/**
 * Handle confirm request - confirm order
 */
export async function handleConfirm(
  context: ONDCContext,
  message: {
    order: {
      id?: string;
      items: Array<{ id: string }>;
      fulfillment: Record<string, unknown>;
      billing: Record<string, unknown>;
      payment: Record<string, unknown>;
    };
  }
): Promise<ONDCMessage> {
  const orderId = message.order.id || `ONDC-${Date.now()}`;

  // Create LMA order from ONDC order
  const lmaOrderId = await createLMAOrderFromONDC(context, message.order);

  const config = getONDCConfig();

  return {
    context: {
      ...context,
      action: ONDC_ACTIONS.ON_CONFIRM,
      bpp_id: config.subscriberId,
      bpp_uri: config.subscriberUrl,
      message_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
    message: {
      order: {
        id: orderId,
        state: ONDC_ORDER_STATES.ACCEPTED,
        provider: { id: 'lma-standard' },
        items: message.order.items,
        fulfillment: {
          ...message.order.fulfillment,
          state: { descriptor: { code: ONDC_FULFILLMENT_STATES.SEARCHING_AGENT } },
          tracking: true,
        },
        billing: message.order.billing,
        payment: {
          ...message.order.payment,
          status: 'PAID',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
  };
}

/**
 * Handle status request
 */
export async function handleStatus(
  context: ONDCContext,
  message: { order_id: string }
): Promise<ONDCMessage> {
  // Get order mapping
  const { data: mapping } = await supabaseAdmin
    .from('ondc_order_mapping')
    .select('lma_order_id, ondc_status')
    .eq('ondc_order_id', message.order_id)
    .single();

  let fulfillmentState: string = ONDC_FULFILLMENT_STATES.PENDING;
  let orderState: string = ONDC_ORDER_STATES.CREATED;

  if (mapping?.lma_order_id) {
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('status')
      .eq('id', mapping.lma_order_id)
      .single();

    if (order) {
      fulfillmentState = mapLMAStatusToONDC(order.status);
      orderState = getONDCOrderState(order.status);
    }
  }

  const config = getONDCConfig();

  return {
    context: {
      ...context,
      action: ONDC_ACTIONS.ON_STATUS,
      bpp_id: config.subscriberId,
      bpp_uri: config.subscriberUrl,
      message_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
    message: {
      order: {
        id: message.order_id,
        state: orderState,
        fulfillment: {
          state: { descriptor: { code: fulfillmentState } },
        },
        updated_at: new Date().toISOString(),
      },
    },
  };
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Calculate distance between two points (Haversine)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate delivery price based on distance
 */
function calculateDeliveryPrice(distance: number): number {
  const basePrice = 30;
  const perKmRate = 8;
  return Math.round(basePrice + distance * perKmRate);
}

/**
 * Map LMA order status to ONDC fulfillment state
 */
function mapLMAStatusToONDC(status: string): string {
  const mapping: Record<string, string> = {
    pending: ONDC_FULFILLMENT_STATES.PENDING,
    confirmed: ONDC_FULFILLMENT_STATES.SEARCHING_AGENT,
    preparing: ONDC_FULFILLMENT_STATES.SEARCHING_AGENT,
    ready_for_pickup: ONDC_FULFILLMENT_STATES.SEARCHING_AGENT,
    driver_assigned: ONDC_FULFILLMENT_STATES.AGENT_ASSIGNED,
    picked_up: ONDC_FULFILLMENT_STATES.PICKED_UP,
    in_transit: ONDC_FULFILLMENT_STATES.IN_TRANSIT,
    arrived: ONDC_FULFILLMENT_STATES.AT_DESTINATION,
    delivered: ONDC_FULFILLMENT_STATES.DELIVERED,
    cancelled: ONDC_FULFILLMENT_STATES.CANCELLED,
  };
  return mapping[status] || ONDC_FULFILLMENT_STATES.PENDING;
}

/**
 * Get ONDC order state from LMA status
 */
function getONDCOrderState(status: string): string {
  if (status === 'cancelled') return ONDC_ORDER_STATES.CANCELLED;
  if (status === 'delivered') return ONDC_ORDER_STATES.COMPLETED;
  if (['pending', 'confirmed'].includes(status)) return ONDC_ORDER_STATES.CREATED;
  return ONDC_ORDER_STATES.IN_PROGRESS;
}

/**
 * Create LMA order from ONDC order
 */
async function createLMAOrderFromONDC(
  context: ONDCContext,
  ondcOrder: Record<string, unknown>
): Promise<string | null> {
  try {
    // Get participant
    const { data: participant } = await supabaseAdmin
      .from('ondc_participants')
      .select('merchant_id')
      .eq('subscriber_id', context.bpp_id)
      .single();

    if (!participant?.merchant_id) {
      logger.error('No merchant found for ONDC participant');
      return null;
    }

    // Create order (simplified - would need full mapping)
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .insert({
        merchant_id: participant.merchant_id,
        customer_id: participant.merchant_id, // Placeholder
        status: 'pending',
        delivery_address_snapshot: (ondcOrder.fulfillment as Record<string, unknown>)?.end || {},
        pickup_address_snapshot: (ondcOrder.fulfillment as Record<string, unknown>)?.start || {},
        subtotal: 0,
        delivery_fee: 0,
        total_amount: 0,
        customer_notes: `ONDC Order: ${context.transaction_id}`,
      })
      .select()
      .single();

    if (error || !order) {
      logger.error('Failed to create LMA order from ONDC', { error });
      return null;
    }

    // Create mapping
    await supabaseAdmin.from('ondc_order_mapping').insert({
      participant_id: participant.merchant_id,
      ondc_order_id: (ondcOrder.id as string) || context.transaction_id,
      lma_order_id: order.id,
      transaction_id: context.transaction_id,
      ondc_status: ONDC_ORDER_STATES.ACCEPTED,
    });

    return order.id;
  } catch (error) {
    logger.error('Failed to create LMA order from ONDC', { error });
    return null;
  }
}

/**
 * Send status update to BAP
 */
export async function sendStatusUpdate(
  orderId: string,
  status: string
): Promise<void> {
  // Get order mapping
  const { data: mapping } = await supabaseAdmin
    .from('ondc_order_mapping')
    .select(`
      ondc_order_id,
      transaction_id,
      participant:ondc_participants (
        subscriber_id,
        subscriber_url
      )
    `)
    .eq('lma_order_id', orderId)
    .single();

  if (!mapping) return;

  const fulfillmentState = mapLMAStatusToONDC(status);
  const orderState = getONDCOrderState(status);
  const config = getONDCConfig();

  const message: ONDCMessage = {
    context: createContext(ONDC_ACTIONS.ON_STATUS, {
      transactionId: mapping.transaction_id,
      bapId: (mapping.participant as any)?.subscriber_id,
      bapUri: (mapping.participant as any)?.subscriber_url,
      bppId: config.subscriberId,
      bppUri: config.subscriberUrl,
    }),
    message: {
      order: {
        id: mapping.ondc_order_id,
        state: orderState,
        fulfillment: {
          state: { descriptor: { code: fulfillmentState } },
        },
        updated_at: new Date().toISOString(),
      },
    },
  };

  await sendONDCRequest(
    `${(mapping.participant as any)?.subscriber_url}/on_status`,
    message
  );
}
