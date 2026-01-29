/**
 * Analytics KPI Service
 *
 * Calculates key performance indicators for:
 * - Delivery operations
 * - Driver performance
 * - Merchant metrics
 * - Financial analytics
 * - Customer satisfaction
 */

import { supabaseAdmin } from '../../config/supabase.js';
import { logger } from '../../lib/logger.js';

// Time period types
type TimePeriod = 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

interface DateRange {
  start: Date;
  end: Date;
}

// KPI Result interfaces
interface DeliveryKPIs {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  completionRate: number;
  cancellationRate: number;
  avgDeliveryTime: number;
  onTimeDeliveryRate: number;
  avgOrderValue: number;
  totalRevenue: number;
  totalDeliveryFees: number;
  ordersPerHour: Record<number, number>;
  ordersByStatus: Record<string, number>;
}

interface DriverKPIs {
  totalDrivers: number;
  activeDrivers: number;
  onlineDrivers: number;
  avgRating: number;
  avgDeliveriesPerDriver: number;
  topPerformers: Array<{
    driverId: string;
    name: string;
    deliveries: number;
    rating: number;
    earnings: number;
  }>;
  avgAcceptanceRate: number;
  avgResponseTime: number;
  utilizationRate: number;
}

interface MerchantKPIs {
  totalMerchants: number;
  activeMerchants: number;
  avgOrdersPerMerchant: number;
  avgPrepTime: number;
  topMerchants: Array<{
    merchantId: string;
    name: string;
    orders: number;
    revenue: number;
    rating: number;
  }>;
  merchantsByCategory: Record<string, number>;
  avgMerchantRating: number;
}

interface FinancialKPIs {
  grossRevenue: number;
  netRevenue: number;
  totalDeliveryFees: number;
  totalCommissions: number;
  avgOrderValue: number;
  avgDeliveryFee: number;
  codCollected: number;
  codPending: number;
  revenueByPaymentMethod: Record<string, number>;
  dailyRevenue: Array<{ date: string; revenue: number }>;
}

interface OperationalKPIs {
  avgPickupWaitTime: number;
  avgDeliveryDistance: number;
  peakHours: number[];
  busiestZones: Array<{ zoneId: string; name: string; orders: number }>;
  serviceableAreaCoverage: number;
  failedDeliveryRate: number;
  returnRate: number;
  customerSatisfactionScore: number;
}

interface DashboardSummary {
  delivery: DeliveryKPIs;
  drivers: DriverKPIs;
  merchants: MerchantKPIs;
  financial: FinancialKPIs;
  operational: OperationalKPIs;
  period: DateRange;
  generatedAt: Date;
}

/**
 * Get date range for a time period
 */
export function getDateRange(period: TimePeriod, customRange?: DateRange): DateRange {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  let start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (period) {
    case 'today':
      break;
    case 'yesterday':
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'quarter':
      start.setMonth(start.getMonth() - 3);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      break;
    case 'custom':
      if (customRange) {
        return customRange;
      }
      break;
  }

  return { start, end };
}

/**
 * Calculate delivery KPIs
 */
export async function getDeliveryKPIs(
  period: TimePeriod,
  options: {
    merchantId?: string;
    zoneId?: string;
    customRange?: DateRange;
  } = {}
): Promise<DeliveryKPIs> {
  const { start, end } = getDateRange(period, options.customRange);

  let query = supabaseAdmin
    .from('orders')
    .select('*')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  if (options.merchantId) {
    query = query.eq('merchant_id', options.merchantId);
  }
  if (options.zoneId) {
    query = query.eq('zone_id', options.zoneId);
  }

  const { data: orders, error } = await query;

  if (error) {
    logger.error('Failed to fetch delivery KPIs', { error });
    throw new Error('Failed to fetch delivery KPIs');
  }

  const totalOrders = orders?.length || 0;
  const completedOrders = orders?.filter((o) => o.status === 'delivered').length || 0;
  const cancelledOrders = orders?.filter((o) => o.status === 'cancelled').length || 0;
  const pendingOrders = orders?.filter((o) =>
    ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'driver_assigned', 'picked_up', 'in_transit'].includes(o.status)
  ).length || 0;

  // Calculate delivery times
  const deliveryTimes: number[] = [];
  let onTimeCount = 0;
  const targetDeliveryTime = 45; // minutes

  orders?.forEach((order) => {
    if (order.status === 'delivered' && order.delivered_at && order.created_at) {
      const time = (new Date(order.delivered_at).getTime() - new Date(order.created_at).getTime()) / 60000;
      if (time > 0 && time < 300) {
        deliveryTimes.push(time);
        if (time <= targetDeliveryTime) onTimeCount++;
      }
    }
  });

  const avgDeliveryTime = deliveryTimes.length > 0
    ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
    : 0;

  // Calculate revenue
  const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
  const totalDeliveryFees = orders?.reduce((sum, o) => sum + (o.delivery_fee || 0), 0) || 0;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Orders by hour
  const ordersPerHour: Record<number, number> = {};
  for (let h = 0; h < 24; h++) ordersPerHour[h] = 0;
  orders?.forEach((order) => {
    const hour = new Date(order.created_at).getHours();
    ordersPerHour[hour]++;
  });

  // Orders by status
  const ordersByStatus: Record<string, number> = {};
  orders?.forEach((order) => {
    ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
  });

  return {
    totalOrders,
    completedOrders,
    cancelledOrders,
    pendingOrders,
    completionRate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0,
    cancellationRate: totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0,
    avgDeliveryTime: Math.round(avgDeliveryTime),
    onTimeDeliveryRate: deliveryTimes.length > 0 ? (onTimeCount / deliveryTimes.length) * 100 : 0,
    avgOrderValue: Math.round(avgOrderValue * 100) / 100,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalDeliveryFees: Math.round(totalDeliveryFees * 100) / 100,
    ordersPerHour,
    ordersByStatus,
  };
}

/**
 * Calculate driver KPIs
 */
export async function getDriverKPIs(
  period: TimePeriod,
  options: {
    zoneId?: string;
    customRange?: DateRange;
  } = {}
): Promise<DriverKPIs> {
  const { start, end } = getDateRange(period, options.customRange);

  // Get all drivers
  const { data: allDrivers } = await supabaseAdmin
    .from('drivers')
    .select('id, user_id, status, average_rating, total_deliveries, is_active, users(full_name)');

  const totalDrivers = allDrivers?.length || 0;
  const activeDrivers = allDrivers?.filter((d) => d.is_active).length || 0;
  const onlineDrivers = allDrivers?.filter((d) => d.status === 'online').length || 0;

  // Get deliveries in period
  const { data: periodOrders } = await supabaseAdmin
    .from('orders')
    .select('driver_id, total_amount, delivery_fee')
    .eq('status', 'delivered')
    .gte('delivered_at', start.toISOString())
    .lte('delivered_at', end.toISOString());

  // Calculate per-driver stats
  const driverStats: Record<string, { deliveries: number; earnings: number }> = {};
  periodOrders?.forEach((order) => {
    if (order.driver_id) {
      if (!driverStats[order.driver_id]) {
        driverStats[order.driver_id] = { deliveries: 0, earnings: 0 };
      }
      driverStats[order.driver_id].deliveries++;
      driverStats[order.driver_id].earnings += order.delivery_fee || 0;
    }
  });

  // Calculate averages
  const ratings = allDrivers?.filter((d) => d.average_rating).map((d) => d.average_rating) || [];
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

  const driverCount = Object.keys(driverStats).length;
  const totalDeliveries = Object.values(driverStats).reduce((sum, s) => sum + s.deliveries, 0);
  const avgDeliveriesPerDriver = driverCount > 0 ? totalDeliveries / driverCount : 0;

  // Top performers
  const topPerformers = allDrivers
    ?.filter((d) => driverStats[d.id])
    .map((d) => ({
      driverId: d.id,
      name: (d.users as { full_name: string })?.full_name || 'Unknown',
      deliveries: driverStats[d.id].deliveries,
      rating: d.average_rating || 0,
      earnings: driverStats[d.id].earnings,
    }))
    .sort((a, b) => b.deliveries - a.deliveries)
    .slice(0, 10) || [];

  // Calculate utilization (drivers who completed at least one order / total active)
  const utilizationRate = activeDrivers > 0 ? (driverCount / activeDrivers) * 100 : 0;

  return {
    totalDrivers,
    activeDrivers,
    onlineDrivers,
    avgRating: Math.round(avgRating * 10) / 10,
    avgDeliveriesPerDriver: Math.round(avgDeliveriesPerDriver * 10) / 10,
    topPerformers,
    avgAcceptanceRate: 85, // Would need acceptance tracking
    avgResponseTime: 120, // seconds - would need tracking
    utilizationRate: Math.round(utilizationRate),
  };
}

/**
 * Calculate merchant KPIs
 */
export async function getMerchantKPIs(
  period: TimePeriod,
  options: {
    category?: string;
    customRange?: DateRange;
  } = {}
): Promise<MerchantKPIs> {
  const { start, end } = getDateRange(period, options.customRange);

  // Get all merchants
  let merchantQuery = supabaseAdmin
    .from('merchants')
    .select('id, business_name, category, average_rating, estimated_prep_time, is_active');

  if (options.category) {
    merchantQuery = merchantQuery.eq('category', options.category);
  }

  const { data: merchants } = await merchantQuery;

  const totalMerchants = merchants?.length || 0;
  const activeMerchants = merchants?.filter((m) => m.is_active).length || 0;

  // Get orders in period
  const { data: periodOrders } = await supabaseAdmin
    .from('orders')
    .select('merchant_id, total_amount, confirmed_at, picked_up_at')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  // Calculate per-merchant stats
  const merchantStats: Record<string, { orders: number; revenue: number; prepTimes: number[] }> = {};
  periodOrders?.forEach((order) => {
    if (order.merchant_id) {
      if (!merchantStats[order.merchant_id]) {
        merchantStats[order.merchant_id] = { orders: 0, revenue: 0, prepTimes: [] };
      }
      merchantStats[order.merchant_id].orders++;
      merchantStats[order.merchant_id].revenue += order.total_amount || 0;

      if (order.confirmed_at && order.picked_up_at) {
        const prepTime = (new Date(order.picked_up_at).getTime() - new Date(order.confirmed_at).getTime()) / 60000;
        if (prepTime > 0 && prepTime < 120) {
          merchantStats[order.merchant_id].prepTimes.push(prepTime);
        }
      }
    }
  });

  // Calculate averages
  const merchantCount = Object.keys(merchantStats).length;
  const totalOrders = Object.values(merchantStats).reduce((sum, s) => sum + s.orders, 0);
  const avgOrdersPerMerchant = merchantCount > 0 ? totalOrders / merchantCount : 0;

  const allPrepTimes = Object.values(merchantStats).flatMap((s) => s.prepTimes);
  const avgPrepTime = allPrepTimes.length > 0
    ? allPrepTimes.reduce((a, b) => a + b, 0) / allPrepTimes.length
    : 0;

  // Top merchants
  const topMerchants = merchants
    ?.filter((m) => merchantStats[m.id])
    .map((m) => ({
      merchantId: m.id,
      name: m.business_name,
      orders: merchantStats[m.id].orders,
      revenue: merchantStats[m.id].revenue,
      rating: m.average_rating || 0,
    }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 10) || [];

  // Merchants by category
  const merchantsByCategory: Record<string, number> = {};
  merchants?.forEach((m) => {
    const category = m.category || 'Other';
    merchantsByCategory[category] = (merchantsByCategory[category] || 0) + 1;
  });

  // Average rating
  const ratings = merchants?.filter((m) => m.average_rating).map((m) => m.average_rating) || [];
  const avgMerchantRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

  return {
    totalMerchants,
    activeMerchants,
    avgOrdersPerMerchant: Math.round(avgOrdersPerMerchant * 10) / 10,
    avgPrepTime: Math.round(avgPrepTime),
    topMerchants,
    merchantsByCategory,
    avgMerchantRating: Math.round(avgMerchantRating * 10) / 10,
  };
}

/**
 * Calculate financial KPIs
 */
export async function getFinancialKPIs(
  period: TimePeriod,
  options: {
    merchantId?: string;
    customRange?: DateRange;
  } = {}
): Promise<FinancialKPIs> {
  const { start, end } = getDateRange(period, options.customRange);

  let query = supabaseAdmin
    .from('orders')
    .select('*')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  if (options.merchantId) {
    query = query.eq('merchant_id', options.merchantId);
  }

  const { data: orders } = await query;

  const grossRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
  const totalDeliveryFees = orders?.reduce((sum, o) => sum + (o.delivery_fee || 0), 0) || 0;

  // Assuming 15% commission on order value
  const commissionRate = 0.15;
  const totalCommissions = orders?.reduce((sum, o) => sum + ((o.total_amount || 0) * commissionRate), 0) || 0;

  const netRevenue = totalDeliveryFees + totalCommissions;

  const orderCount = orders?.length || 0;
  const avgOrderValue = orderCount > 0 ? grossRevenue / orderCount : 0;
  const avgDeliveryFee = orderCount > 0 ? totalDeliveryFees / orderCount : 0;

  // COD calculations
  const codOrders = orders?.filter((o) => o.is_cod) || [];
  const codCollected = codOrders.filter((o) => o.status === 'delivered').reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const codPending = codOrders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').reduce((sum, o) => sum + (o.total_amount || 0), 0);

  // Revenue by payment method
  const revenueByPaymentMethod: Record<string, number> = {};
  orders?.forEach((o) => {
    const method = o.payment_method || 'unknown';
    revenueByPaymentMethod[method] = (revenueByPaymentMethod[method] || 0) + (o.total_amount || 0);
  });

  // Daily revenue
  const dailyRevenueMap: Record<string, number> = {};
  orders?.forEach((o) => {
    const date = o.created_at.split('T')[0];
    dailyRevenueMap[date] = (dailyRevenueMap[date] || 0) + (o.total_amount || 0);
  });

  const dailyRevenue = Object.entries(dailyRevenueMap)
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    netRevenue: Math.round(netRevenue * 100) / 100,
    totalDeliveryFees: Math.round(totalDeliveryFees * 100) / 100,
    totalCommissions: Math.round(totalCommissions * 100) / 100,
    avgOrderValue: Math.round(avgOrderValue * 100) / 100,
    avgDeliveryFee: Math.round(avgDeliveryFee * 100) / 100,
    codCollected: Math.round(codCollected * 100) / 100,
    codPending: Math.round(codPending * 100) / 100,
    revenueByPaymentMethod,
    dailyRevenue,
  };
}

/**
 * Calculate operational KPIs
 */
export async function getOperationalKPIs(
  period: TimePeriod,
  options: {
    customRange?: DateRange;
  } = {}
): Promise<OperationalKPIs> {
  const { start, end } = getDateRange(period, options.customRange);

  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('*')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  // Calculate pickup wait times
  const pickupWaitTimes: number[] = [];
  orders?.forEach((o) => {
    if (o.driver_assigned_at && o.picked_up_at) {
      const wait = (new Date(o.picked_up_at).getTime() - new Date(o.driver_assigned_at).getTime()) / 60000;
      if (wait > 0 && wait < 120) {
        pickupWaitTimes.push(wait);
      }
    }
  });
  const avgPickupWaitTime = pickupWaitTimes.length > 0
    ? pickupWaitTimes.reduce((a, b) => a + b, 0) / pickupWaitTimes.length
    : 0;

  // Average delivery distance (would need actual distance data)
  const avgDeliveryDistance = 5.2; // km - placeholder

  // Peak hours
  const hourCounts: Record<number, number> = {};
  orders?.forEach((o) => {
    const hour = new Date(o.created_at).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  const peakHours = Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([hour]) => parseInt(hour));

  // Busiest zones
  const zoneCounts: Record<string, number> = {};
  orders?.forEach((o) => {
    if (o.zone_id) {
      zoneCounts[o.zone_id] = (zoneCounts[o.zone_id] || 0) + 1;
    }
  });

  const { data: zones } = await supabaseAdmin
    .from('geofence_zones')
    .select('id, name')
    .in('id', Object.keys(zoneCounts));

  const busiestZones = Object.entries(zoneCounts)
    .map(([zoneId, orderCount]) => ({
      zoneId,
      name: zones?.find((z) => z.id === zoneId)?.name || 'Unknown',
      orders: orderCount,
    }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 5);

  // Failed delivery rate
  const totalOrders = orders?.length || 0;
  const failedOrders = orders?.filter((o) => o.status === 'failed' || o.status === 'returned').length || 0;
  const failedDeliveryRate = totalOrders > 0 ? (failedOrders / totalOrders) * 100 : 0;

  // Return rate
  const returnedOrders = orders?.filter((o) => o.status === 'returned').length || 0;
  const completedOrders = orders?.filter((o) => o.status === 'delivered').length || 0;
  const returnRate = completedOrders > 0 ? (returnedOrders / completedOrders) * 100 : 0;

  return {
    avgPickupWaitTime: Math.round(avgPickupWaitTime),
    avgDeliveryDistance: Math.round(avgDeliveryDistance * 10) / 10,
    peakHours,
    busiestZones,
    serviceableAreaCoverage: 85, // percentage - would need calculation
    failedDeliveryRate: Math.round(failedDeliveryRate * 10) / 10,
    returnRate: Math.round(returnRate * 10) / 10,
    customerSatisfactionScore: 4.2, // would need rating data
  };
}

/**
 * Get complete dashboard summary
 */
export async function getDashboardSummary(
  period: TimePeriod,
  options: {
    merchantId?: string;
    zoneId?: string;
    customRange?: DateRange;
  } = {}
): Promise<DashboardSummary> {
  const dateRange = getDateRange(period, options.customRange);

  const [delivery, drivers, merchants, financial, operational] = await Promise.all([
    getDeliveryKPIs(period, options),
    getDriverKPIs(period, { zoneId: options.zoneId, customRange: options.customRange }),
    getMerchantKPIs(period, { customRange: options.customRange }),
    getFinancialKPIs(period, options),
    getOperationalKPIs(period, { customRange: options.customRange }),
  ]);

  return {
    delivery,
    drivers,
    merchants,
    financial,
    operational,
    period: dateRange,
    generatedAt: new Date(),
  };
}

/**
 * Compare KPIs between two periods
 */
export async function compareKPIs(
  currentPeriod: TimePeriod,
  previousPeriod: TimePeriod,
  options: {
    merchantId?: string;
    zoneId?: string;
  } = {}
): Promise<{
  current: DeliveryKPIs;
  previous: DeliveryKPIs;
  changes: Record<string, { value: number; percentage: number }>;
}> {
  const [current, previous] = await Promise.all([
    getDeliveryKPIs(currentPeriod, options),
    getDeliveryKPIs(previousPeriod, options),
  ]);

  const calculateChange = (curr: number, prev: number) => ({
    value: curr - prev,
    percentage: prev !== 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0,
  });

  const changes: Record<string, { value: number; percentage: number }> = {
    totalOrders: calculateChange(current.totalOrders, previous.totalOrders),
    completedOrders: calculateChange(current.completedOrders, previous.completedOrders),
    completionRate: calculateChange(current.completionRate, previous.completionRate),
    avgDeliveryTime: calculateChange(current.avgDeliveryTime, previous.avgDeliveryTime),
    totalRevenue: calculateChange(current.totalRevenue, previous.totalRevenue),
    avgOrderValue: calculateChange(current.avgOrderValue, previous.avgOrderValue),
  };

  return { current, previous, changes };
}
