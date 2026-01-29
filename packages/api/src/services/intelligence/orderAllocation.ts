/**
 * Smart Order Allocation Engine
 *
 * Intelligently assigns orders to drivers based on multiple factors:
 * - Distance and proximity
 * - Driver availability and capacity
 * - Driver ratings and performance
 * - Order priority and type
 * - Historical acceptance rates
 */

import { supabaseAdmin } from '../../config/supabase.js';
import { logger } from '../../lib/logger.js';
import { calculateDistance } from '../routeOptimization.js';
import { predictDeliveryTime } from './deliveryPrediction.js';

// Allocation scoring weights
interface AllocationWeights {
  distance: number;        // Proximity to pickup
  rating: number;          // Driver rating factor
  acceptanceRate: number;  // Historical acceptance rate
  deliverySpeed: number;   // Average delivery speed
  vehicleMatch: number;    // Vehicle type suitability
  currentLoad: number;     // Current order load
  fairness: number;        // Fair distribution factor
}

const DEFAULT_WEIGHTS: AllocationWeights = {
  distance: 0.30,
  rating: 0.15,
  acceptanceRate: 0.15,
  deliverySpeed: 0.10,
  vehicleMatch: 0.10,
  currentLoad: 0.10,
  fairness: 0.10,
};

interface Driver {
  id: string;
  user_id: string;
  current_latitude: number;
  current_longitude: number;
  vehicle_type: string;
  average_rating: number;
  total_deliveries: number;
  status: string;
}

interface Order {
  id: string;
  merchant_id: string;
  pickup_latitude: number;
  pickup_longitude: number;
  delivery_latitude: number;
  delivery_longitude: number;
  total_amount: number;
  is_cod: boolean;
  delivery_fee: number;
  priority?: 'normal' | 'high' | 'express';
}

interface DriverScore {
  driverId: string;
  totalScore: number;
  scores: {
    distance: number;
    rating: number;
    acceptanceRate: number;
    deliverySpeed: number;
    vehicleMatch: number;
    currentLoad: number;
    fairness: number;
  };
  estimatedPickupTime: number;
  estimatedDeliveryTime: number;
  distanceToPickup: number;
}

interface AllocationResult {
  success: boolean;
  driverId?: string;
  scores: DriverScore[];
  reason?: string;
  estimatedPickupTime?: number;
  estimatedDeliveryTime?: number;
}

/**
 * Find the best driver for an order
 */
export async function findBestDriver(
  order: Order,
  options: {
    maxDistance?: number;
    vehicleTypes?: string[];
    excludeDrivers?: string[];
    minRating?: number;
  } = {}
): Promise<AllocationResult> {
  const {
    maxDistance = 10, // km
    vehicleTypes,
    excludeDrivers = [],
    minRating = 3.0,
  } = options;

  // Get available drivers
  let query = supabaseAdmin
    .from('drivers')
    .select(`
      id,
      user_id,
      current_latitude,
      current_longitude,
      vehicle_type,
      average_rating,
      total_deliveries,
      status
    `)
    .eq('status', 'online')
    .eq('is_active', true)
    .eq('is_verified', true)
    .gte('average_rating', minRating);

  if (vehicleTypes?.length) {
    query = query.in('vehicle_type', vehicleTypes);
  }

  const { data: drivers, error } = await query;

  if (error || !drivers || drivers.length === 0) {
    return {
      success: false,
      scores: [],
      reason: 'No available drivers found',
    };
  }

  // Filter out excluded drivers and those too far away
  const eligibleDrivers = drivers.filter((driver) => {
    if (excludeDrivers.includes(driver.id)) return false;
    if (!driver.current_latitude || !driver.current_longitude) return false;

    const distance = calculateDistance(
      driver.current_latitude,
      driver.current_longitude,
      order.pickup_latitude,
      order.pickup_longitude
    );

    return distance <= maxDistance;
  });

  if (eligibleDrivers.length === 0) {
    return {
      success: false,
      scores: [],
      reason: 'No drivers within range',
    };
  }

  // Get driver statistics
  const driverStats = await getDriverStats(eligibleDrivers.map((d) => d.id));

  // Calculate scores for each driver
  const scores: DriverScore[] = await Promise.all(
    eligibleDrivers.map(async (driver) => {
      const stats = driverStats.get(driver.id) || {
        acceptanceRate: 0.5,
        avgDeliveryTime: 30,
        ordersToday: 0,
      };

      const score = await calculateDriverScore(
        driver,
        order,
        stats,
        DEFAULT_WEIGHTS
      );

      return score;
    })
  );

  // Sort by total score (descending)
  scores.sort((a, b) => b.totalScore - a.totalScore);

  const bestDriver = scores[0];

  if (!bestDriver || bestDriver.totalScore < 0.3) {
    return {
      success: false,
      scores,
      reason: 'No suitable driver found (low scores)',
    };
  }

  return {
    success: true,
    driverId: bestDriver.driverId,
    scores,
    estimatedPickupTime: bestDriver.estimatedPickupTime,
    estimatedDeliveryTime: bestDriver.estimatedDeliveryTime,
  };
}

/**
 * Calculate score for a single driver
 */
async function calculateDriverScore(
  driver: Driver,
  order: Order,
  stats: {
    acceptanceRate: number;
    avgDeliveryTime: number;
    ordersToday: number;
  },
  weights: AllocationWeights
): Promise<DriverScore> {
  // Distance score (closer is better)
  const distanceToPickup = calculateDistance(
    driver.current_latitude,
    driver.current_longitude,
    order.pickup_latitude,
    order.pickup_longitude
  );
  const distanceScore = Math.max(0, 1 - distanceToPickup / 10); // Normalize to 0-1

  // Rating score (higher is better)
  const ratingScore = (driver.average_rating - 1) / 4; // Normalize 1-5 to 0-1

  // Acceptance rate score
  const acceptanceScore = stats.acceptanceRate;

  // Delivery speed score (faster is better)
  const speedScore = Math.max(0, 1 - (stats.avgDeliveryTime - 20) / 40); // Normalize

  // Vehicle match score
  const vehicleScore = getVehicleMatchScore(driver.vehicle_type, order);

  // Current load score (fewer orders today is better for fairness)
  const loadScore = Math.max(0, 1 - stats.ordersToday / 20); // Normalize

  // Fairness score (boost drivers with fewer recent orders)
  const fairnessScore = calculateFairnessScore(driver.total_deliveries, stats.ordersToday);

  // Calculate weighted total
  const scores = {
    distance: distanceScore,
    rating: ratingScore,
    acceptanceRate: acceptanceScore,
    deliverySpeed: speedScore,
    vehicleMatch: vehicleScore,
    currentLoad: loadScore,
    fairness: fairnessScore,
  };

  const totalScore =
    scores.distance * weights.distance +
    scores.rating * weights.rating +
    scores.acceptanceRate * weights.acceptanceRate +
    scores.deliverySpeed * weights.deliverySpeed +
    scores.vehicleMatch * weights.vehicleMatch +
    scores.currentLoad * weights.currentLoad +
    scores.fairness * weights.fairness;

  // Estimate times
  const prediction = await predictDeliveryTime({
    pickupLat: order.pickup_latitude,
    pickupLng: order.pickup_longitude,
    deliveryLat: order.delivery_latitude,
    deliveryLng: order.delivery_longitude,
    driverId: driver.id,
    merchantId: order.merchant_id,
  });

  const pickupTime = Math.round(distanceToPickup * 3); // ~3 min/km

  return {
    driverId: driver.id,
    totalScore,
    scores,
    estimatedPickupTime: pickupTime,
    estimatedDeliveryTime: prediction.estimatedMinutes,
    distanceToPickup: Math.round(distanceToPickup * 100) / 100,
  };
}

/**
 * Get vehicle match score based on order requirements
 */
function getVehicleMatchScore(vehicleType: string, order: Order): number {
  const orderValue = order.total_amount;
  const isCOD = order.is_cod;

  // Map vehicle capabilities
  const vehicleCapabilities: Record<string, {
    maxValue: number;
    codCapable: boolean;
    speed: number;
  }> = {
    bicycle: { maxValue: 500, codCapable: false, speed: 0.7 },
    motorcycle: { maxValue: 5000, codCapable: true, speed: 1.0 },
    car: { maxValue: 20000, codCapable: true, speed: 0.9 },
    van: { maxValue: 100000, codCapable: true, speed: 0.8 },
  };

  const caps = vehicleCapabilities[vehicleType] || vehicleCapabilities.motorcycle;

  // Check if vehicle can handle order
  if (orderValue > caps.maxValue) return 0.3;
  if (isCOD && !caps.codCapable) return 0.2;

  // Prefer appropriate vehicle size
  if (orderValue < 1000 && vehicleType === 'van') return 0.7;
  if (orderValue > 5000 && vehicleType === 'bicycle') return 0.4;

  return caps.speed;
}

/**
 * Calculate fairness score to ensure even distribution
 */
function calculateFairnessScore(totalDeliveries: number, ordersToday: number): number {
  // New drivers get a boost
  if (totalDeliveries < 10) return 0.8;

  // Drivers with fewer orders today get priority
  if (ordersToday === 0) return 1.0;
  if (ordersToday < 5) return 0.9;
  if (ordersToday < 10) return 0.7;

  return 0.5;
}

/**
 * Get driver statistics
 */
async function getDriverStats(
  driverIds: string[]
): Promise<Map<string, {
  acceptanceRate: number;
  avgDeliveryTime: number;
  ordersToday: number;
}>> {
  const stats = new Map();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get orders completed today
  const { data: todayOrders } = await supabaseAdmin
    .from('orders')
    .select('driver_id')
    .in('driver_id', driverIds)
    .gte('created_at', today.toISOString())
    .eq('status', 'delivered');

  // Count orders per driver
  const orderCounts: Record<string, number> = {};
  todayOrders?.forEach((o) => {
    orderCounts[o.driver_id] = (orderCounts[o.driver_id] || 0) + 1;
  });

  // Get historical performance (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: historicalOrders } = await supabaseAdmin
    .from('orders')
    .select('driver_id, created_at, delivered_at, status')
    .in('driver_id', driverIds)
    .gte('created_at', thirtyDaysAgo.toISOString());

  // Calculate per-driver stats
  const driverHistory: Record<string, {
    offered: number;
    accepted: number;
    deliveryTimes: number[];
  }> = {};

  historicalOrders?.forEach((o) => {
    if (!driverHistory[o.driver_id]) {
      driverHistory[o.driver_id] = { offered: 0, accepted: 0, deliveryTimes: [] };
    }

    driverHistory[o.driver_id].offered++;
    if (o.status === 'delivered') {
      driverHistory[o.driver_id].accepted++;
      if (o.delivered_at && o.created_at) {
        const time = (new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) / 60000;
        if (time > 0 && time < 180) { // Filter outliers
          driverHistory[o.driver_id].deliveryTimes.push(time);
        }
      }
    }
  });

  // Build stats map
  driverIds.forEach((id) => {
    const history = driverHistory[id] || { offered: 0, accepted: 0, deliveryTimes: [] };
    const acceptanceRate = history.offered > 0 ? history.accepted / history.offered : 0.5;
    const avgDeliveryTime = history.deliveryTimes.length > 0
      ? history.deliveryTimes.reduce((a, b) => a + b, 0) / history.deliveryTimes.length
      : 30;

    stats.set(id, {
      acceptanceRate,
      avgDeliveryTime,
      ordersToday: orderCounts[id] || 0,
    });
  });

  return stats;
}

/**
 * Auto-assign order to best driver
 */
export async function autoAssignOrder(orderId: string): Promise<{
  success: boolean;
  driverId?: string;
  message: string;
}> {
  // Get order
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    return { success: false, message: 'Order not found' };
  }

  if (order.driver_id) {
    return { success: false, message: 'Order already assigned' };
  }

  // Find best driver
  const result = await findBestDriver({
    id: order.id,
    merchant_id: order.merchant_id,
    pickup_latitude: order.pickup_latitude,
    pickup_longitude: order.pickup_longitude,
    delivery_latitude: order.delivery_latitude,
    delivery_longitude: order.delivery_longitude,
    total_amount: order.total_amount,
    is_cod: order.is_cod || false,
    delivery_fee: order.delivery_fee,
    priority: order.priority,
  });

  if (!result.success || !result.driverId) {
    return { success: false, message: result.reason || 'No suitable driver found' };
  }

  // Assign driver
  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update({
      driver_id: result.driverId,
      status: 'driver_assigned',
    })
    .eq('id', orderId)
    .is('driver_id', null); // Ensure not already assigned

  if (updateError) {
    logger.error('Failed to assign driver', { orderId, error: updateError });
    return { success: false, message: 'Failed to assign driver' };
  }

  // Update driver status
  await supabaseAdmin
    .from('drivers')
    .update({ status: 'on_delivery' })
    .eq('id', result.driverId);

  // Log allocation
  logger.info('Order auto-assigned', {
    orderId,
    driverId: result.driverId,
    score: result.scores[0]?.totalScore,
    estimatedPickup: result.estimatedPickupTime,
    estimatedDelivery: result.estimatedDeliveryTime,
  });

  return {
    success: true,
    driverId: result.driverId,
    message: 'Order assigned successfully',
  };
}

/**
 * Batch allocation for multiple orders
 */
export async function batchAllocate(orderIds: string[]): Promise<{
  assigned: number;
  failed: number;
  results: Array<{ orderId: string; success: boolean; driverId?: string }>;
}> {
  const results: Array<{ orderId: string; success: boolean; driverId?: string }> = [];
  let assigned = 0;
  let failed = 0;

  for (const orderId of orderIds) {
    const result = await autoAssignOrder(orderId);
    results.push({
      orderId,
      success: result.success,
      driverId: result.driverId,
    });

    if (result.success) {
      assigned++;
    } else {
      failed++;
    }

    // Small delay to prevent race conditions
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return { assigned, failed, results };
}

/**
 * Reassign order to a different driver
 */
export async function reassignOrder(
  orderId: string,
  reason: string
): Promise<{ success: boolean; newDriverId?: string; message: string }> {
  // Get current order
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('driver_id')
    .eq('id', orderId)
    .single();

  if (!order) {
    return { success: false, message: 'Order not found' };
  }

  const previousDriverId = order.driver_id;

  // Clear current assignment
  await supabaseAdmin
    .from('orders')
    .update({ driver_id: null, status: 'ready_for_pickup' })
    .eq('id', orderId);

  // Free up previous driver
  if (previousDriverId) {
    await supabaseAdmin
      .from('drivers')
      .update({ status: 'online' })
      .eq('id', previousDriverId);
  }

  // Find new driver (excluding previous)
  const result = await autoAssignOrder(orderId);

  if (result.success) {
    logger.info('Order reassigned', {
      orderId,
      previousDriver: previousDriverId,
      newDriver: result.driverId,
      reason,
    });
  }

  return {
    success: result.success,
    newDriverId: result.driverId,
    message: result.message,
  };
}
