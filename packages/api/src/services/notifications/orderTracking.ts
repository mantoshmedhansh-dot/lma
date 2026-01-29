/**
 * Real-time Order Tracking Service
 *
 * Provides live tracking capabilities for customers:
 * - Driver location updates
 * - ETA calculations
 * - Status change notifications
 * - Delivery progress visualization
 */

import { supabaseAdmin } from '../../config/supabase.js';
import { logger } from '../../lib/logger.js';
import { calculateDistance } from '../routeOptimization.js';
import { sendNotification, NotificationRecipient } from './notificationService.js';

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface TrackingUpdate {
  orderId: string;
  status: string;
  driverLocation?: Coordinate;
  estimatedArrival?: Date;
  distanceRemaining?: number;
  currentStep: TrackingStep;
  steps: TrackingStep[];
  lastUpdated: Date;
}

interface TrackingStep {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'completed';
  timestamp?: Date;
  description?: string;
}

interface OrderTrackingDetails {
  orderId: string;
  orderNumber: string;
  status: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    deliveryAddress: string;
    deliveryLocation: Coordinate;
  };
  merchant: {
    id: string;
    name: string;
    phone: string;
    pickupAddress: string;
    pickupLocation: Coordinate;
  };
  driver?: {
    id: string;
    name: string;
    phone: string;
    vehicleType: string;
    vehicleNumber: string;
    rating: number;
    currentLocation?: Coordinate;
  };
  timeline: TrackingStep[];
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  createdAt: Date;
}

// Status to step mapping
const STATUS_STEPS: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  preparing: 2,
  ready_for_pickup: 3,
  driver_assigned: 4,
  picked_up: 5,
  in_transit: 6,
  delivered: 7,
};

const STEP_DEFINITIONS: TrackingStep[] = [
  { id: 'order_placed', name: 'Order Placed', status: 'pending', description: 'Order received' },
  { id: 'order_confirmed', name: 'Confirmed', status: 'pending', description: 'Restaurant confirmed' },
  { id: 'preparing', name: 'Preparing', status: 'pending', description: 'Food being prepared' },
  { id: 'ready', name: 'Ready', status: 'pending', description: 'Ready for pickup' },
  { id: 'driver_assigned', name: 'Driver Assigned', status: 'pending', description: 'Driver on the way to restaurant' },
  { id: 'picked_up', name: 'Picked Up', status: 'pending', description: 'Order picked up' },
  { id: 'on_the_way', name: 'On the Way', status: 'pending', description: 'Heading to you' },
  { id: 'delivered', name: 'Delivered', status: 'pending', description: 'Order delivered' },
];

/**
 * Get order tracking details
 */
export async function getOrderTracking(orderId: string): Promise<OrderTrackingDetails | null> {
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select(`
      *,
      users!orders_customer_id_fkey(id, full_name, phone),
      merchants(id, business_name, phone, address, latitude, longitude),
      drivers(
        id,
        user_id,
        vehicle_type,
        vehicle_number,
        average_rating,
        current_latitude,
        current_longitude,
        users(full_name, phone)
      )
    `)
    .eq('id', orderId)
    .single();

  if (error || !order) {
    logger.error('Failed to get order tracking', { orderId, error });
    return null;
  }

  // Build timeline
  const currentStepIndex = STATUS_STEPS[order.status] || 0;
  const timeline = STEP_DEFINITIONS.map((step, index) => ({
    ...step,
    status: index < currentStepIndex ? 'completed' as const :
            index === currentStepIndex ? 'active' as const : 'pending' as const,
    timestamp: getStepTimestamp(order, index),
  }));

  const tracking: OrderTrackingDetails = {
    orderId: order.id,
    orderNumber: order.order_number || order.id.slice(-8).toUpperCase(),
    status: order.status,
    customer: {
      id: order.customer_id,
      name: order.users?.full_name || 'Customer',
      phone: order.users?.phone || '',
      deliveryAddress: order.delivery_address,
      deliveryLocation: {
        latitude: order.delivery_latitude,
        longitude: order.delivery_longitude,
      },
    },
    merchant: {
      id: order.merchant_id,
      name: order.merchants?.business_name || 'Restaurant',
      phone: order.merchants?.phone || '',
      pickupAddress: order.merchants?.address || '',
      pickupLocation: {
        latitude: order.pickup_latitude || order.merchants?.latitude,
        longitude: order.pickup_longitude || order.merchants?.longitude,
      },
    },
    timeline,
    estimatedDelivery: order.estimated_delivery ? new Date(order.estimated_delivery) : undefined,
    actualDelivery: order.delivered_at ? new Date(order.delivered_at) : undefined,
    createdAt: new Date(order.created_at),
  };

  // Add driver info if assigned
  if (order.drivers) {
    tracking.driver = {
      id: order.drivers.id,
      name: order.drivers.users?.full_name || 'Driver',
      phone: order.drivers.users?.phone || '',
      vehicleType: order.drivers.vehicle_type,
      vehicleNumber: order.drivers.vehicle_number,
      rating: order.drivers.average_rating || 0,
    };

    if (order.drivers.current_latitude && order.drivers.current_longitude) {
      tracking.driver.currentLocation = {
        latitude: order.drivers.current_latitude,
        longitude: order.drivers.current_longitude,
      };
    }
  }

  return tracking;
}

/**
 * Get live tracking update
 */
export async function getLiveTrackingUpdate(orderId: string): Promise<TrackingUpdate | null> {
  const tracking = await getOrderTracking(orderId);
  if (!tracking) return null;

  const currentStepIndex = STATUS_STEPS[tracking.status] || 0;
  const currentStep = tracking.timeline[currentStepIndex];

  let distanceRemaining: number | undefined;
  let estimatedArrival: Date | undefined;

  // Calculate distance and ETA if driver is assigned and has location
  if (tracking.driver?.currentLocation) {
    const driverLocation = tracking.driver.currentLocation;

    // Determine destination based on status
    let destination: Coordinate;
    if (['driver_assigned'].includes(tracking.status)) {
      // Driver heading to restaurant
      destination = tracking.merchant.pickupLocation;
    } else {
      // Driver heading to customer
      destination = tracking.customer.deliveryLocation;
    }

    distanceRemaining = calculateDistance(
      driverLocation.latitude,
      driverLocation.longitude,
      destination.latitude,
      destination.longitude
    );

    // Estimate arrival (assuming ~25 km/h average speed in city)
    const avgSpeed = 25; // km/h
    const etaMinutes = (distanceRemaining / avgSpeed) * 60;
    estimatedArrival = new Date(Date.now() + etaMinutes * 60 * 1000);
  }

  return {
    orderId,
    status: tracking.status,
    driverLocation: tracking.driver?.currentLocation,
    estimatedArrival,
    distanceRemaining: distanceRemaining ? Math.round(distanceRemaining * 100) / 100 : undefined,
    currentStep,
    steps: tracking.timeline,
    lastUpdated: new Date(),
  };
}

/**
 * Update driver location and notify customer
 */
export async function updateDriverLocation(
  driverId: string,
  location: Coordinate
): Promise<void> {
  // Update driver location in database
  await supabaseAdmin
    .from('drivers')
    .update({
      current_latitude: location.latitude,
      current_longitude: location.longitude,
      updated_at: new Date().toISOString(),
    })
    .eq('id', driverId);

  // Get active orders for this driver
  const { data: activeOrders } = await supabaseAdmin
    .from('orders')
    .select('id, customer_id, delivery_latitude, delivery_longitude, status')
    .eq('driver_id', driverId)
    .in('status', ['driver_assigned', 'picked_up', 'in_transit']);

  if (!activeOrders || activeOrders.length === 0) return;

  // Check for proximity-based notifications
  for (const order of activeOrders) {
    if (order.status === 'in_transit') {
      const distanceToCustomer = calculateDistance(
        location.latitude,
        location.longitude,
        order.delivery_latitude,
        order.delivery_longitude
      );

      // Notify when driver is within 500m
      if (distanceToCustomer <= 0.5) {
        await notifyDriverNearby(order.id, order.customer_id);
      }
    }
  }

  // Store location in history
  await supabaseAdmin.from('driver_location_log').insert({
    driver_id: driverId,
    latitude: location.latitude,
    longitude: location.longitude,
    recorded_at: new Date().toISOString(),
  });
}

/**
 * Notify customer that driver is nearby
 */
async function notifyDriverNearby(orderId: string, customerId: string): Promise<void> {
  // Check if already notified
  const cacheKey = `driver_nearby_${orderId}`;
  const { data: existingNotif } = await supabaseAdmin
    .from('notification_history')
    .select('id')
    .eq('type', 'driver_nearby')
    .contains('data', { orderId })
    .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Last 10 mins
    .limit(1);

  if (existingNotif && existingNotif.length > 0) return;

  // Get customer details
  const { data: customer } = await supabaseAdmin
    .from('users')
    .select('id, full_name, phone, email')
    .eq('id', customerId)
    .single();

  if (!customer) return;

  // Get driver details
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('drivers(users(full_name))')
    .eq('id', orderId)
    .single();

  const driverName = (order?.drivers as { users: { full_name: string } })?.users?.full_name || 'Your driver';

  // Get device tokens
  const { data: devices } = await supabaseAdmin
    .from('user_devices')
    .select('token, platform')
    .eq('user_id', customerId)
    .eq('is_active', true);

  const recipient: NotificationRecipient = {
    userId: customerId,
    email: customer.email,
    phone: customer.phone,
    deviceTokens: devices?.map((d) => ({ token: d.token, platform: d.platform })),
  };

  await sendNotification(recipient, {
    type: 'driver_nearby',
    title: 'Driver Nearby',
    body: `${driverName} is almost there. Please be ready to receive your order.`,
    data: { orderId },
    priority: 'high',
  });
}

/**
 * Update order status and send notification
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: string,
  additionalData?: Record<string, unknown>
): Promise<void> {
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select(`
      *,
      users!orders_customer_id_fkey(id, full_name, phone, email),
      merchants(business_name),
      drivers(users(full_name))
    `)
    .eq('id', orderId)
    .single();

  if (!order) {
    logger.error('Order not found for status update', { orderId });
    return;
  }

  const previousStatus = order.status;

  // Update order status
  const updateData: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  // Set timestamps for specific statuses
  switch (newStatus) {
    case 'confirmed':
      updateData.confirmed_at = new Date().toISOString();
      break;
    case 'picked_up':
      updateData.picked_up_at = new Date().toISOString();
      break;
    case 'delivered':
      updateData.delivered_at = new Date().toISOString();
      break;
    case 'cancelled':
      updateData.cancelled_at = new Date().toISOString();
      break;
  }

  await supabaseAdmin
    .from('orders')
    .update(updateData)
    .eq('id', orderId);

  // Log status change
  await supabaseAdmin.from('order_status_log').insert({
    order_id: orderId,
    previous_status: previousStatus,
    new_status: newStatus,
    changed_at: new Date().toISOString(),
  });

  // Send notification to customer
  const { data: devices } = await supabaseAdmin
    .from('user_devices')
    .select('token, platform')
    .eq('user_id', order.customer_id)
    .eq('is_active', true);

  const recipient: NotificationRecipient = {
    userId: order.customer_id,
    email: order.users?.email,
    phone: order.users?.phone,
    deviceTokens: devices?.map((d) => ({ token: d.token, platform: d.platform })),
  };

  const notificationType = getNotificationType(newStatus);
  const { title, body } = getStatusNotificationContent(
    newStatus,
    order.order_number || orderId.slice(-8),
    order.merchants?.business_name,
    (order.drivers as { users: { full_name: string } })?.users?.full_name,
    additionalData?.reason as string | undefined
  );

  await sendNotification(recipient, {
    type: notificationType,
    title,
    body,
    data: {
      orderId,
      status: newStatus,
      ...additionalData,
    },
    priority: ['cancelled', 'delivered'].includes(newStatus) ? 'high' : 'normal',
  });

  logger.info('Order status updated', {
    orderId,
    previousStatus,
    newStatus,
  });
}

/**
 * Get driver's current delivery route
 */
export async function getDriverRoute(driverId: string): Promise<{
  currentOrder?: {
    orderId: string;
    status: string;
    pickup: Coordinate & { address: string };
    delivery: Coordinate & { address: string };
  };
  upcomingOrders: Array<{
    orderId: string;
    pickup: Coordinate & { address: string };
    delivery: Coordinate & { address: string };
  }>;
  driverLocation?: Coordinate;
}> {
  // Get driver's current location
  const { data: driver } = await supabaseAdmin
    .from('drivers')
    .select('current_latitude, current_longitude')
    .eq('id', driverId)
    .single();

  // Get active orders
  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select(`
      id,
      status,
      pickup_latitude,
      pickup_longitude,
      delivery_latitude,
      delivery_longitude,
      delivery_address,
      merchants(address)
    `)
    .eq('driver_id', driverId)
    .in('status', ['driver_assigned', 'picked_up', 'in_transit'])
    .order('created_at', { ascending: true });

  const result: {
    currentOrder?: {
      orderId: string;
      status: string;
      pickup: Coordinate & { address: string };
      delivery: Coordinate & { address: string };
    };
    upcomingOrders: Array<{
      orderId: string;
      pickup: Coordinate & { address: string };
      delivery: Coordinate & { address: string };
    }>;
    driverLocation?: Coordinate;
  } = {
    upcomingOrders: [],
  };

  if (driver?.current_latitude && driver?.current_longitude) {
    result.driverLocation = {
      latitude: driver.current_latitude,
      longitude: driver.current_longitude,
    };
  }

  if (!orders || orders.length === 0) return result;

  // First order is current
  const [current, ...upcoming] = orders;

  result.currentOrder = {
    orderId: current.id,
    status: current.status,
    pickup: {
      latitude: current.pickup_latitude,
      longitude: current.pickup_longitude,
      address: (current.merchants as { address: string })?.address || '',
    },
    delivery: {
      latitude: current.delivery_latitude,
      longitude: current.delivery_longitude,
      address: current.delivery_address,
    },
  };

  result.upcomingOrders = upcoming.map((o) => ({
    orderId: o.id,
    pickup: {
      latitude: o.pickup_latitude,
      longitude: o.pickup_longitude,
      address: (o.merchants as { address: string })?.address || '',
    },
    delivery: {
      latitude: o.delivery_latitude,
      longitude: o.delivery_longitude,
      address: o.delivery_address,
    },
  }));

  return result;
}

/**
 * Generate shareable tracking link
 */
export async function generateTrackingLink(orderId: string): Promise<string> {
  // Generate a short token for the tracking link
  const token = generateTrackingToken();

  await supabaseAdmin.from('tracking_tokens').insert({
    order_id: orderId,
    token,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
  });

  const baseUrl = process.env.APP_URL || 'https://lma.app';
  return `${baseUrl}/track/${token}`;
}

/**
 * Get order from tracking token
 */
export async function getOrderFromTrackingToken(token: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('tracking_tokens')
    .select('order_id')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single();

  return data?.order_id || null;
}

// Helper functions

function getStepTimestamp(order: Record<string, unknown>, stepIndex: number): Date | undefined {
  const timestamps: (string | null | undefined)[] = [
    order.created_at as string,
    order.confirmed_at as string | null,
    order.confirmed_at as string | null, // preparing uses confirmed
    order.ready_at as string | null,
    order.driver_assigned_at as string | null,
    order.picked_up_at as string | null,
    order.picked_up_at as string | null, // in_transit uses picked_up
    order.delivered_at as string | null,
  ];

  const timestamp = timestamps[stepIndex];
  return timestamp ? new Date(timestamp) : undefined;
}

function getNotificationType(status: string): 'order_confirmed' | 'order_preparing' | 'order_ready' | 'driver_assigned' | 'order_picked_up' | 'order_in_transit' | 'order_delivered' | 'order_cancelled' {
  const typeMap: Record<string, 'order_confirmed' | 'order_preparing' | 'order_ready' | 'driver_assigned' | 'order_picked_up' | 'order_in_transit' | 'order_delivered' | 'order_cancelled'> = {
    confirmed: 'order_confirmed',
    preparing: 'order_preparing',
    ready_for_pickup: 'order_ready',
    driver_assigned: 'driver_assigned',
    picked_up: 'order_picked_up',
    in_transit: 'order_in_transit',
    delivered: 'order_delivered',
    cancelled: 'order_cancelled',
  };

  return typeMap[status] || 'order_confirmed';
}

function getStatusNotificationContent(
  status: string,
  orderNumber: string,
  merchantName?: string,
  driverName?: string,
  reason?: string
): { title: string; body: string } {
  const content: Record<string, { title: string; body: string }> = {
    confirmed: {
      title: 'Order Confirmed!',
      body: `${merchantName || 'The restaurant'} has confirmed your order #${orderNumber}.`,
    },
    preparing: {
      title: 'Preparing Your Order',
      body: `${merchantName || 'The restaurant'} is preparing your order #${orderNumber}.`,
    },
    ready_for_pickup: {
      title: 'Order Ready!',
      body: `Your order #${orderNumber} is ready. A driver will pick it up soon.`,
    },
    driver_assigned: {
      title: 'Driver Assigned',
      body: `${driverName || 'A driver'} is assigned to deliver your order #${orderNumber}.`,
    },
    picked_up: {
      title: 'Order Picked Up',
      body: `${driverName || 'Your driver'} has picked up your order from ${merchantName || 'the restaurant'}.`,
    },
    in_transit: {
      title: 'On the Way!',
      body: `Your order #${orderNumber} is on the way. Track it live in the app!`,
    },
    delivered: {
      title: 'Order Delivered!',
      body: `Your order #${orderNumber} has been delivered. Enjoy your meal!`,
    },
    cancelled: {
      title: 'Order Cancelled',
      body: `Your order #${orderNumber} has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
    },
  };

  return content[status] || { title: 'Order Update', body: `Your order #${orderNumber} status: ${status}` };
}

function generateTrackingToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export type { TrackingUpdate, OrderTrackingDetails, TrackingStep };
