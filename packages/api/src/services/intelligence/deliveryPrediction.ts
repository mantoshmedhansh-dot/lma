/**
 * Delivery Time Prediction Service
 *
 * Uses machine learning-inspired algorithms to predict delivery times
 * based on historical data, traffic patterns, distance, and other factors.
 */

import { supabaseAdmin } from '../../config/supabase.js';
import { logger } from '../../lib/logger.js';
import { calculateDistance } from '../routeOptimization.js';

// Feature weights learned from historical data (simplified ML model)
interface ModelWeights {
  baseTime: number;
  distanceWeight: number;
  trafficWeight: number;
  timeOfDayWeight: number;
  dayOfWeekWeight: number;
  weatherWeight: number;
  merchantPrepWeight: number;
  driverRatingWeight: number;
}

// Default model weights (would be trained on historical data)
const DEFAULT_WEIGHTS: ModelWeights = {
  baseTime: 10, // Base time in minutes
  distanceWeight: 3.5, // Minutes per km
  trafficWeight: 1.0, // Traffic multiplier
  timeOfDayWeight: 1.0, // Time of day adjustment
  dayOfWeekWeight: 1.0, // Day of week adjustment
  weatherWeight: 1.0, // Weather adjustment
  merchantPrepWeight: 1.0, // Merchant prep time factor
  driverRatingWeight: 0.95, // Higher rating = faster delivery
};

// Traffic patterns by hour (0-23)
const TRAFFIC_PATTERNS: Record<number, number> = {
  0: 0.7, 1: 0.6, 2: 0.6, 3: 0.6, 4: 0.7, 5: 0.8,
  6: 1.0, 7: 1.3, 8: 1.5, 9: 1.4, 10: 1.2, 11: 1.1,
  12: 1.3, 13: 1.2, 14: 1.1, 15: 1.2, 16: 1.3, 17: 1.5,
  18: 1.6, 19: 1.5, 20: 1.3, 21: 1.1, 22: 0.9, 23: 0.8,
};

// Day of week patterns (0 = Sunday)
const DAY_PATTERNS: Record<number, number> = {
  0: 1.1, // Sunday
  1: 1.0, // Monday
  2: 1.0, // Tuesday
  3: 1.0, // Wednesday
  4: 1.05, // Thursday
  5: 1.15, // Friday
  6: 1.2, // Saturday
};

interface PredictionInput {
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
  merchantId?: string;
  driverId?: string;
  scheduledTime?: Date;
  orderValue?: number;
  itemCount?: number;
}

interface PredictionResult {
  estimatedMinutes: number;
  confidence: number;
  breakdown: {
    travelTime: number;
    prepTime: number;
    pickupTime: number;
    deliveryTime: number;
    bufferTime: number;
  };
  factors: {
    distance: number;
    traffic: number;
    timeOfDay: string;
    dayOfWeek: string;
  };
  range: {
    min: number;
    max: number;
  };
}

/**
 * Predict delivery time using ML-inspired algorithm
 */
export async function predictDeliveryTime(
  input: PredictionInput
): Promise<PredictionResult> {
  const weights = await getModelWeights();
  const now = input.scheduledTime || new Date();

  // Calculate base distance
  const distance = calculateDistance(
    input.pickupLat,
    input.pickupLng,
    input.deliveryLat,
    input.deliveryLng
  );

  // Get traffic factor
  const hour = now.getHours();
  const trafficFactor = TRAFFIC_PATTERNS[hour] || 1.0;

  // Get day of week factor
  const dayOfWeek = now.getDay();
  const dayFactor = DAY_PATTERNS[dayOfWeek] || 1.0;

  // Get merchant-specific prep time
  let merchantPrepTime = 15; // Default prep time
  if (input.merchantId) {
    const { data: merchant } = await supabaseAdmin
      .from('merchants')
      .select('estimated_prep_time')
      .eq('id', input.merchantId)
      .single();
    if (merchant?.estimated_prep_time) {
      merchantPrepTime = merchant.estimated_prep_time;
    }
  }

  // Get driver efficiency factor
  let driverFactor = 1.0;
  if (input.driverId) {
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('average_rating, total_deliveries')
      .eq('id', input.driverId)
      .single();
    if (driver?.average_rating && driver.total_deliveries > 10) {
      // Better rated drivers are slightly faster
      driverFactor = 1.0 - (driver.average_rating - 3) * 0.05;
    }
  }

  // Calculate travel time
  const baseTravelTime = distance * weights.distanceWeight;
  const adjustedTravelTime = baseTravelTime * trafficFactor * dayFactor * driverFactor;

  // Calculate total time components
  const travelTime = Math.round(adjustedTravelTime);
  const prepTime = Math.round(merchantPrepTime * weights.merchantPrepWeight);
  const pickupTime = 5; // Fixed pickup buffer
  const deliveryTime = 5; // Fixed delivery buffer
  const bufferTime = Math.round(distance * 0.5); // Dynamic buffer based on distance

  const totalMinutes = travelTime + prepTime + pickupTime + deliveryTime + bufferTime;

  // Calculate confidence based on data availability
  let confidence = 0.7; // Base confidence
  if (input.merchantId) confidence += 0.1;
  if (input.driverId) confidence += 0.1;
  if (distance < 10) confidence += 0.05; // More confident for shorter distances

  // Calculate range (±15-25% based on confidence)
  const variancePercent = 0.25 - (confidence * 0.1);
  const minTime = Math.round(totalMinutes * (1 - variancePercent));
  const maxTime = Math.round(totalMinutes * (1 + variancePercent));

  return {
    estimatedMinutes: totalMinutes,
    confidence: Math.min(confidence, 0.95),
    breakdown: {
      travelTime,
      prepTime,
      pickupTime,
      deliveryTime,
      bufferTime,
    },
    factors: {
      distance: Math.round(distance * 100) / 100,
      traffic: trafficFactor,
      timeOfDay: getTimeOfDayLabel(hour),
      dayOfWeek: getDayLabel(dayOfWeek),
    },
    range: {
      min: minTime,
      max: maxTime,
    },
  };
}

/**
 * Get historical delivery data for model training
 */
export async function getHistoricalData(
  options: {
    merchantId?: string;
    daysBack?: number;
    limit?: number;
  } = {}
): Promise<Array<{
  distance: number;
  actualTime: number;
  hour: number;
  dayOfWeek: number;
  prepTime: number;
}>> {
  const { merchantId, daysBack = 30, limit = 1000 } = options;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  let query = supabaseAdmin
    .from('orders')
    .select(`
      pickup_latitude,
      pickup_longitude,
      delivery_latitude,
      delivery_longitude,
      created_at,
      confirmed_at,
      picked_up_at,
      delivered_at
    `)
    .eq('status', 'delivered')
    .gte('created_at', startDate.toISOString())
    .not('delivered_at', 'is', null)
    .limit(limit);

  if (merchantId) {
    query = query.eq('merchant_id', merchantId);
  }

  const { data: orders, error } = await query;

  if (error || !orders) {
    logger.error('Failed to fetch historical data', { error });
    return [];
  }

  return orders
    .filter((o) => o.delivered_at && o.created_at)
    .map((order) => {
      const distance = calculateDistance(
        order.pickup_latitude,
        order.pickup_longitude,
        order.delivery_latitude,
        order.delivery_longitude
      );

      const createdAt = new Date(order.created_at);
      const deliveredAt = new Date(order.delivered_at);
      const actualTime = (deliveredAt.getTime() - createdAt.getTime()) / 60000;

      let prepTime = 15;
      if (order.confirmed_at && order.picked_up_at) {
        prepTime = (new Date(order.picked_up_at).getTime() - new Date(order.confirmed_at).getTime()) / 60000;
      }

      return {
        distance,
        actualTime,
        hour: createdAt.getHours(),
        dayOfWeek: createdAt.getDay(),
        prepTime,
      };
    });
}

/**
 * Train/update model weights based on historical data
 */
export async function updateModelWeights(merchantId?: string): Promise<ModelWeights> {
  const historicalData = await getHistoricalData({ merchantId, daysBack: 90 });

  if (historicalData.length < 50) {
    logger.info('Insufficient data for training, using defaults', {
      dataPoints: historicalData.length,
    });
    return DEFAULT_WEIGHTS;
  }

  // Simple linear regression to find optimal distance weight
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  const n = historicalData.length;

  for (const point of historicalData) {
    sumX += point.distance;
    sumY += point.actualTime;
    sumXY += point.distance * point.actualTime;
    sumX2 += point.distance * point.distance;
  }

  const distanceWeight = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const baseTime = (sumY - distanceWeight * sumX) / n;

  // Calculate traffic patterns from data
  const hourlyTimes: Record<number, number[]> = {};
  for (const point of historicalData) {
    if (!hourlyTimes[point.hour]) hourlyTimes[point.hour] = [];
    hourlyTimes[point.hour].push(point.actualTime / point.distance);
  }

  // Store updated weights
  const newWeights: ModelWeights = {
    ...DEFAULT_WEIGHTS,
    baseTime: Math.max(5, Math.min(20, baseTime)),
    distanceWeight: Math.max(2, Math.min(6, distanceWeight)),
  };

  // Save to database
  const key = merchantId ? `model_weights_${merchantId}` : 'model_weights_global';
  await supabaseAdmin.from('app_config').upsert({
    key,
    value: newWeights,
    updated_at: new Date().toISOString(),
  });

  logger.info('Updated model weights', {
    merchantId,
    dataPoints: n,
    weights: newWeights,
  });

  return newWeights;
}

/**
 * Get model weights from database or use defaults
 */
async function getModelWeights(merchantId?: string): Promise<ModelWeights> {
  // Try merchant-specific weights first
  if (merchantId) {
    const { data: merchantWeights } = await supabaseAdmin
      .from('app_config')
      .select('value')
      .eq('key', `model_weights_${merchantId}`)
      .single();

    if (merchantWeights?.value) {
      return merchantWeights.value as ModelWeights;
    }
  }

  // Try global weights
  const { data: globalWeights } = await supabaseAdmin
    .from('app_config')
    .select('value')
    .eq('key', 'model_weights_global')
    .single();

  if (globalWeights?.value) {
    return globalWeights.value as ModelWeights;
  }

  return DEFAULT_WEIGHTS;
}

/**
 * Calculate prediction accuracy
 */
export async function calculateAccuracy(
  merchantId?: string,
  daysBack: number = 7
): Promise<{
  meanAbsoluteError: number;
  meanPercentageError: number;
  within10Percent: number;
  within20Percent: number;
  sampleSize: number;
}> {
  const historicalData = await getHistoricalData({ merchantId, daysBack });

  if (historicalData.length === 0) {
    return {
      meanAbsoluteError: 0,
      meanPercentageError: 0,
      within10Percent: 0,
      within20Percent: 0,
      sampleSize: 0,
    };
  }

  let totalAbsError = 0;
  let totalPctError = 0;
  let within10 = 0;
  let within20 = 0;

  for (const point of historicalData) {
    // Simulate prediction
    const predicted = DEFAULT_WEIGHTS.baseTime +
      point.distance * DEFAULT_WEIGHTS.distanceWeight *
      TRAFFIC_PATTERNS[point.hour] *
      DAY_PATTERNS[point.dayOfWeek];

    const absError = Math.abs(predicted - point.actualTime);
    const pctError = absError / point.actualTime;

    totalAbsError += absError;
    totalPctError += pctError;

    if (pctError <= 0.1) within10++;
    if (pctError <= 0.2) within20++;
  }

  const n = historicalData.length;

  return {
    meanAbsoluteError: Math.round(totalAbsError / n * 10) / 10,
    meanPercentageError: Math.round(totalPctError / n * 1000) / 10,
    within10Percent: Math.round(within10 / n * 1000) / 10,
    within20Percent: Math.round(within20 / n * 1000) / 10,
    sampleSize: n,
  };
}

// Helper functions
function getTimeOfDayLabel(hour: number): string {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function getDayLabel(day: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[day];
}
