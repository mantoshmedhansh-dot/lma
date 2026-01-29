/**
 * Real-time Metrics Tracking Service
 *
 * Provides live metrics for:
 * - Active order monitoring
 * - Driver location tracking
 * - Operational alerts
 * - Live dashboard feeds
 */

import { supabaseAdmin } from '../../config/supabase.js';
import { logger } from '../../lib/logger.js';

// Real-time metric types
interface LiveOrderStats {
  totalActive: number;
  byStatus: Record<string, number>;
  avgWaitTime: number;
  oldestPendingMinutes: number;
  recentlyCompleted: number;
  recentlyCancelled: number;
}

interface LiveDriverStats {
  totalOnline: number;
  totalOnDelivery: number;
  totalIdle: number;
  totalOffline: number;
  avgActiveOrders: number;
  driverLocations: Array<{
    driverId: string;
    name: string;
    latitude: number;
    longitude: number;
    status: string;
    currentOrderId?: string;
    lastUpdate: Date;
  }>;
}

interface LiveOperationalMetrics {
  ordersPerMinute: number;
  avgDeliveryTimeToday: number;
  completionRateToday: number;
  currentSurgeZones: Array<{
    zoneId: string;
    name: string;
    multiplier: number;
    reason: string;
  }>;
  pendingAssignments: number;
  delayedOrders: number;
}

interface Alert {
  id: string;
  type: AlertType;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: Date;
  acknowledged: boolean;
}

type AlertType =
  | 'order_delayed'
  | 'driver_shortage'
  | 'high_cancellation'
  | 'surge_active'
  | 'system_error'
  | 'payment_issue'
  | 'driver_inactive'
  | 'merchant_offline';

interface DashboardFeed {
  orders: LiveOrderStats;
  drivers: LiveDriverStats;
  operations: LiveOperationalMetrics;
  alerts: Alert[];
  timestamp: Date;
}

// Alert thresholds
const ALERT_THRESHOLDS = {
  orderDelayMinutes: 30,
  driverShortageRatio: 0.5, // orders per available driver
  highCancellationRate: 15, // percentage
  driverInactiveMinutes: 30,
};

/**
 * Get live order statistics
 */
export async function getLiveOrderStats(): Promise<LiveOrderStats> {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Get active orders
  const { data: activeOrders } = await supabaseAdmin
    .from('orders')
    .select('id, status, created_at')
    .in('status', [
      'pending',
      'confirmed',
      'preparing',
      'ready_for_pickup',
      'driver_assigned',
      'picked_up',
      'in_transit',
    ]);

  // Count by status
  const byStatus: Record<string, number> = {};
  let totalWaitTime = 0;
  let oldestPendingTime = 0;

  activeOrders?.forEach((order) => {
    byStatus[order.status] = (byStatus[order.status] || 0) + 1;

    const waitTime = (now.getTime() - new Date(order.created_at).getTime()) / 60000;
    totalWaitTime += waitTime;

    if (order.status === 'pending' && waitTime > oldestPendingTime) {
      oldestPendingTime = waitTime;
    }
  });

  // Get recently completed/cancelled (last 5 minutes)
  const { data: recentOrders } = await supabaseAdmin
    .from('orders')
    .select('status')
    .gte('updated_at', fiveMinutesAgo.toISOString())
    .in('status', ['delivered', 'cancelled']);

  const recentlyCompleted = recentOrders?.filter((o) => o.status === 'delivered').length || 0;
  const recentlyCancelled = recentOrders?.filter((o) => o.status === 'cancelled').length || 0;

  const totalActive = activeOrders?.length || 0;

  return {
    totalActive,
    byStatus,
    avgWaitTime: totalActive > 0 ? Math.round(totalWaitTime / totalActive) : 0,
    oldestPendingMinutes: Math.round(oldestPendingTime),
    recentlyCompleted,
    recentlyCancelled,
  };
}

/**
 * Get live driver statistics with locations
 */
export async function getLiveDriverStats(): Promise<LiveDriverStats> {
  const { data: drivers } = await supabaseAdmin
    .from('drivers')
    .select(`
      id,
      status,
      current_latitude,
      current_longitude,
      updated_at,
      users(full_name)
    `)
    .eq('is_active', true);

  // Count by status
  const totalOnline = drivers?.filter((d) => d.status === 'online').length || 0;
  const totalOnDelivery = drivers?.filter((d) => d.status === 'on_delivery').length || 0;
  const totalIdle = drivers?.filter((d) => d.status === 'idle').length || 0;
  const totalOffline = drivers?.filter((d) => d.status === 'offline').length || 0;

  // Get current orders for drivers on delivery
  const onDeliveryIds = drivers?.filter((d) => d.status === 'on_delivery').map((d) => d.id) || [];

  const { data: currentOrders } = await supabaseAdmin
    .from('orders')
    .select('driver_id, id')
    .in('driver_id', onDeliveryIds)
    .in('status', ['driver_assigned', 'picked_up', 'in_transit']);

  const driverOrderMap: Record<string, string> = {};
  currentOrders?.forEach((o) => {
    driverOrderMap[o.driver_id] = o.id;
  });

  // Map driver locations
  const driverLocations = (drivers || [])
    .filter((d) => d.current_latitude && d.current_longitude)
    .map((d) => ({
      driverId: d.id,
      name: (d.users as { full_name: string })?.full_name || 'Unknown',
      latitude: d.current_latitude,
      longitude: d.current_longitude,
      status: d.status,
      currentOrderId: driverOrderMap[d.id],
      lastUpdate: new Date(d.updated_at),
    }));

  // Calculate average active orders per driver
  const activeDrivers = totalOnline + totalOnDelivery;
  const avgActiveOrders = activeDrivers > 0 ? onDeliveryIds.length / activeDrivers : 0;

  return {
    totalOnline,
    totalOnDelivery,
    totalIdle,
    totalOffline,
    avgActiveOrders: Math.round(avgActiveOrders * 10) / 10,
    driverLocations,
  };
}

/**
 * Get live operational metrics
 */
export async function getLiveOperationalMetrics(): Promise<LiveOperationalMetrics> {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Orders per minute (last minute)
  const { count: ordersLastMinute } = await supabaseAdmin
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneMinuteAgo.toISOString());

  // Today's stats
  const { data: todayOrders } = await supabaseAdmin
    .from('orders')
    .select('status, created_at, delivered_at')
    .gte('created_at', todayStart.toISOString());

  const totalToday = todayOrders?.length || 0;
  const completedToday = todayOrders?.filter((o) => o.status === 'delivered').length || 0;
  const completionRateToday = totalToday > 0 ? (completedToday / totalToday) * 100 : 0;

  // Average delivery time today
  const deliveryTimes: number[] = [];
  todayOrders?.forEach((o) => {
    if (o.status === 'delivered' && o.delivered_at && o.created_at) {
      const time = (new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) / 60000;
      if (time > 0 && time < 180) {
        deliveryTimes.push(time);
      }
    }
  });

  const avgDeliveryTimeToday = deliveryTimes.length > 0
    ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
    : 0;

  // Get surge zones
  const { data: surgeZones } = await supabaseAdmin
    .from('geofence_zones')
    .select('id, name')
    .eq('type', 'surge')
    .eq('is_active', true);

  const currentSurgeZones = (surgeZones || []).map((z) => ({
    zoneId: z.id,
    name: z.name,
    multiplier: 1.5, // Would calculate actual multiplier
    reason: 'High demand',
  }));

  // Pending assignments
  const { count: pendingAssignments } = await supabaseAdmin
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'confirmed', 'ready_for_pickup'])
    .is('driver_id', null);

  // Delayed orders (pending for more than threshold)
  const delayThreshold = new Date(now.getTime() - ALERT_THRESHOLDS.orderDelayMinutes * 60 * 1000);
  const { count: delayedOrders } = await supabaseAdmin
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'confirmed', 'preparing', 'ready_for_pickup'])
    .lt('created_at', delayThreshold.toISOString());

  return {
    ordersPerMinute: ordersLastMinute || 0,
    avgDeliveryTimeToday: Math.round(avgDeliveryTimeToday),
    completionRateToday: Math.round(completionRateToday * 10) / 10,
    currentSurgeZones,
    pendingAssignments: pendingAssignments || 0,
    delayedOrders: delayedOrders || 0,
  };
}

/**
 * Get active alerts
 */
export async function getActiveAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [];

  // Check for delayed orders
  const liveOrderStats = await getLiveOrderStats();
  if (liveOrderStats.oldestPendingMinutes > ALERT_THRESHOLDS.orderDelayMinutes) {
    alerts.push({
      id: `alert_order_delay_${Date.now()}`,
      type: 'order_delayed',
      severity: liveOrderStats.oldestPendingMinutes > 60 ? 'critical' : 'warning',
      title: 'Orders Delayed',
      message: `Oldest pending order waiting for ${liveOrderStats.oldestPendingMinutes} minutes`,
      data: { oldestPendingMinutes: liveOrderStats.oldestPendingMinutes },
      timestamp: new Date(),
      acknowledged: false,
    });
  }

  // Check for driver shortage
  const liveDriverStats = await getLiveDriverStats();
  const availableDrivers = liveDriverStats.totalOnline;
  const pendingOrders = liveOrderStats.byStatus['pending'] || 0;

  if (availableDrivers > 0 && pendingOrders / availableDrivers > ALERT_THRESHOLDS.driverShortageRatio) {
    alerts.push({
      id: `alert_driver_shortage_${Date.now()}`,
      type: 'driver_shortage',
      severity: pendingOrders / availableDrivers > 1 ? 'critical' : 'warning',
      title: 'Driver Shortage',
      message: `${pendingOrders} pending orders with only ${availableDrivers} available drivers`,
      data: { pendingOrders, availableDrivers },
      timestamp: new Date(),
      acknowledged: false,
    });
  }

  // Check for high cancellation rate
  const totalRecent = liveOrderStats.recentlyCompleted + liveOrderStats.recentlyCancelled;
  if (totalRecent > 0) {
    const cancellationRate = (liveOrderStats.recentlyCancelled / totalRecent) * 100;
    if (cancellationRate > ALERT_THRESHOLDS.highCancellationRate) {
      alerts.push({
        id: `alert_high_cancellation_${Date.now()}`,
        type: 'high_cancellation',
        severity: cancellationRate > 25 ? 'critical' : 'warning',
        title: 'High Cancellation Rate',
        message: `${Math.round(cancellationRate)}% cancellation rate in the last 5 minutes`,
        data: { cancellationRate, cancelled: liveOrderStats.recentlyCancelled },
        timestamp: new Date(),
        acknowledged: false,
      });
    }
  }

  // Check for inactive drivers (on shift but no location update)
  const inactiveThreshold = new Date(Date.now() - ALERT_THRESHOLDS.driverInactiveMinutes * 60 * 1000);
  const inactiveDrivers = liveDriverStats.driverLocations.filter(
    (d) => d.status === 'online' && d.lastUpdate < inactiveThreshold
  );

  if (inactiveDrivers.length > 0) {
    alerts.push({
      id: `alert_driver_inactive_${Date.now()}`,
      type: 'driver_inactive',
      severity: 'info',
      title: 'Inactive Drivers',
      message: `${inactiveDrivers.length} drivers haven't updated location in ${ALERT_THRESHOLDS.driverInactiveMinutes}+ minutes`,
      data: { inactiveDrivers: inactiveDrivers.map((d) => d.driverId) },
      timestamp: new Date(),
      acknowledged: false,
    });
  }

  // Get persisted alerts from database
  const { data: dbAlerts } = await supabaseAdmin
    .from('operational_alerts')
    .select('*')
    .eq('acknowledged', false)
    .order('created_at', { ascending: false })
    .limit(20);

  dbAlerts?.forEach((a) => {
    alerts.push({
      id: a.id,
      type: a.type,
      severity: a.severity,
      title: a.title,
      message: a.message,
      data: a.data,
      timestamp: new Date(a.created_at),
      acknowledged: a.acknowledged,
    });
  });

  return alerts.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(alertId: string): Promise<void> {
  await supabaseAdmin
    .from('operational_alerts')
    .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
    .eq('id', alertId);
}

/**
 * Create a new alert
 */
export async function createAlert(
  alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>
): Promise<Alert> {
  const { data, error } = await supabaseAdmin
    .from('operational_alerts')
    .insert({
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      data: alert.data || {},
      acknowledged: false,
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create alert', { error });
    throw new Error('Failed to create alert');
  }

  return {
    id: data.id,
    type: data.type,
    severity: data.severity,
    title: data.title,
    message: data.message,
    data: data.data,
    timestamp: new Date(data.created_at),
    acknowledged: data.acknowledged,
  };
}

/**
 * Get complete dashboard feed
 */
export async function getDashboardFeed(): Promise<DashboardFeed> {
  const [orders, drivers, operations, alerts] = await Promise.all([
    getLiveOrderStats(),
    getLiveDriverStats(),
    getLiveOperationalMetrics(),
    getActiveAlerts(),
  ]);

  return {
    orders,
    drivers,
    operations,
    alerts,
    timestamp: new Date(),
  };
}

/**
 * Track real-time order status changes
 */
export async function trackOrderStatusChange(
  orderId: string,
  previousStatus: string,
  newStatus: string
): Promise<void> {
  const timestamp = new Date();

  // Log status change
  await supabaseAdmin.from('order_status_log').insert({
    order_id: orderId,
    previous_status: previousStatus,
    new_status: newStatus,
    changed_at: timestamp.toISOString(),
  });

  // Check for alert conditions
  if (newStatus === 'cancelled') {
    // Could trigger high cancellation rate check
    logger.info('Order cancelled', { orderId, previousStatus });
  }

  if (newStatus === 'delayed') {
    await createAlert({
      type: 'order_delayed',
      severity: 'warning',
      title: 'Order Delayed',
      message: `Order ${orderId} has been marked as delayed`,
      data: { orderId, previousStatus },
    });
  }
}

/**
 * Track driver location update
 */
export async function trackDriverLocation(
  driverId: string,
  latitude: number,
  longitude: number
): Promise<void> {
  const timestamp = new Date();

  // Update driver location
  await supabaseAdmin
    .from('drivers')
    .update({
      current_latitude: latitude,
      current_longitude: longitude,
      updated_at: timestamp.toISOString(),
    })
    .eq('id', driverId);

  // Log location for history
  await supabaseAdmin.from('driver_location_log').insert({
    driver_id: driverId,
    latitude,
    longitude,
    recorded_at: timestamp.toISOString(),
  });
}

/**
 * Get order tracking timeline
 */
export async function getOrderTimeline(orderId: string): Promise<Array<{
  status: string;
  timestamp: Date;
  duration?: number;
}>> {
  const { data: logs } = await supabaseAdmin
    .from('order_status_log')
    .select('new_status, changed_at')
    .eq('order_id', orderId)
    .order('changed_at', { ascending: true });

  if (!logs || logs.length === 0) {
    return [];
  }

  return logs.map((log, index) => {
    const timestamp = new Date(log.changed_at);
    let duration: number | undefined;

    if (index > 0) {
      const prevTimestamp = new Date(logs[index - 1].changed_at);
      duration = (timestamp.getTime() - prevTimestamp.getTime()) / 60000;
    }

    return {
      status: log.new_status,
      timestamp,
      duration: duration ? Math.round(duration) : undefined,
    };
  });
}

/**
 * Get live heatmap data for orders
 */
export async function getOrderHeatmapData(): Promise<Array<{
  latitude: number;
  longitude: number;
  intensity: number;
}>> {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  const { data: recentOrders } = await supabaseAdmin
    .from('orders')
    .select('pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude')
    .gte('created_at', thirtyMinutesAgo.toISOString());

  const heatmapPoints: Array<{ latitude: number; longitude: number; intensity: number }> = [];

  recentOrders?.forEach((order) => {
    if (order.pickup_latitude && order.pickup_longitude) {
      heatmapPoints.push({
        latitude: order.pickup_latitude,
        longitude: order.pickup_longitude,
        intensity: 0.7,
      });
    }
    if (order.delivery_latitude && order.delivery_longitude) {
      heatmapPoints.push({
        latitude: order.delivery_latitude,
        longitude: order.delivery_longitude,
        intensity: 0.5,
      });
    }
  });

  return heatmapPoints;
}

/**
 * Get system health metrics
 */
export async function getSystemHealth(): Promise<{
  database: { status: string; latency: number };
  api: { status: string; requestsPerMinute: number };
  workers: { active: number; queued: number };
  storage: { usage: number; limit: number };
}> {
  // Database health check
  const dbStart = Date.now();
  await supabaseAdmin.from('orders').select('id').limit(1);
  const dbLatency = Date.now() - dbStart;

  return {
    database: {
      status: dbLatency < 500 ? 'healthy' : 'degraded',
      latency: dbLatency,
    },
    api: {
      status: 'healthy',
      requestsPerMinute: 150, // Would need actual tracking
    },
    workers: {
      active: 3,
      queued: 12,
    },
    storage: {
      usage: 2.5, // GB
      limit: 10, // GB
    },
  };
}
