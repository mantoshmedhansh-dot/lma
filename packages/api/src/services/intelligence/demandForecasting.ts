/**
 * Demand Forecasting Service
 *
 * Predicts future order demand using historical patterns to help with:
 * - Driver capacity planning
 * - Surge pricing decisions
 * - Merchant preparation optimization
 * - Resource allocation
 */

import { supabaseAdmin } from '../../config/supabase.js';
import { logger } from '../../lib/logger.js';

// Forecasting model types
interface ForecastInput {
  zoneId?: string;
  merchantId?: string;
  targetDate: Date;
  targetHour: number;
}

interface ForecastResult {
  predictedOrders: number;
  predictedDriversNeeded: number;
  confidence: number;
  factors: {
    dayOfWeek: string;
    isWeekend: boolean;
    isHoliday: boolean;
    historicalAvg: number;
    trend: number;
    seasonality: number;
  };
  range: {
    min: number;
    max: number;
  };
}

interface DemandPattern {
  hourlyPattern: Record<number, number>;
  weeklyPattern: Record<number, number>;
  monthlyPattern: Record<number, number>;
  avgOrdersPerHour: number;
  peakHours: number[];
  lowHours: number[];
}

interface HistoricalDataPoint {
  date: Date;
  hour: number;
  orderCount: number;
  dayOfWeek: number;
  isWeekend: boolean;
  isHoliday: boolean;
  weatherCondition?: string;
  specialEvent?: string;
}

// Known holidays (India-focused, can be extended)
const HOLIDAYS_2024: string[] = [
  '2024-01-26', // Republic Day
  '2024-03-25', // Holi
  '2024-04-14', // Ambedkar Jayanti
  '2024-08-15', // Independence Day
  '2024-10-02', // Gandhi Jayanti
  '2024-10-31', // Diwali
  '2024-11-01', // Diwali
  '2024-12-25', // Christmas
];

/**
 * Generate demand forecast for a specific time
 */
export async function forecastDemand(input: ForecastInput): Promise<ForecastResult> {
  const { zoneId, merchantId, targetDate, targetHour } = input;

  // Get historical data
  const historicalData = await getHistoricalDemand({
    zoneId,
    merchantId,
    daysBack: 90, // 3 months of data
  });

  if (historicalData.length < 14) {
    // Insufficient data, return default forecast
    return getDefaultForecast(targetDate, targetHour);
  }

  // Analyze patterns
  const pattern = analyzePatterns(historicalData);

  // Get day-specific factors
  const dayOfWeek = targetDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isHoliday = checkHoliday(targetDate);

  // Calculate base prediction
  const hourlyFactor = pattern.hourlyPattern[targetHour] || 1.0;
  const weeklyFactor = pattern.weeklyPattern[dayOfWeek] || 1.0;

  // Calculate trend (simple moving average comparison)
  const recentAvg = calculateRecentAverage(historicalData, 7);
  const olderAvg = calculateRecentAverage(historicalData, 30, 7);
  const trend = olderAvg > 0 ? recentAvg / olderAvg : 1.0;

  // Seasonality adjustment (month-based)
  const month = targetDate.getMonth();
  const seasonalityFactor = pattern.monthlyPattern[month] || 1.0;

  // Apply holiday adjustment
  const holidayMultiplier = isHoliday ? 0.7 : 1.0; // Lower demand on holidays

  // Calculate prediction
  let predictedOrders = Math.round(
    pattern.avgOrdersPerHour *
    hourlyFactor *
    weeklyFactor *
    trend *
    seasonalityFactor *
    holidayMultiplier
  );

  // Ensure non-negative
  predictedOrders = Math.max(0, predictedOrders);

  // Calculate drivers needed (assuming 3 orders per driver per hour)
  const ordersPerDriverPerHour = 3;
  const predictedDriversNeeded = Math.ceil(predictedOrders / ordersPerDriverPerHour);

  // Calculate confidence based on data quality
  let confidence = 0.6; // Base confidence
  if (historicalData.length >= 30) confidence += 0.1;
  if (historicalData.length >= 60) confidence += 0.1;
  if (!isHoliday) confidence += 0.05;
  if (trend > 0.8 && trend < 1.2) confidence += 0.05; // Stable trend

  // Calculate range
  const variance = calculateVariance(historicalData, targetHour, dayOfWeek);
  const minOrders = Math.max(0, Math.round(predictedOrders - variance));
  const maxOrders = Math.round(predictedOrders + variance);

  return {
    predictedOrders,
    predictedDriversNeeded,
    confidence: Math.min(confidence, 0.95),
    factors: {
      dayOfWeek: getDayName(dayOfWeek),
      isWeekend,
      isHoliday,
      historicalAvg: Math.round(pattern.avgOrdersPerHour * 10) / 10,
      trend: Math.round(trend * 100) / 100,
      seasonality: Math.round(seasonalityFactor * 100) / 100,
    },
    range: {
      min: minOrders,
      max: maxOrders,
    },
  };
}

/**
 * Generate forecasts for an entire day
 */
export async function forecastDay(
  targetDate: Date,
  options: {
    zoneId?: string;
    merchantId?: string;
  } = {}
): Promise<ForecastResult[]> {
  const forecasts: ForecastResult[] = [];

  for (let hour = 0; hour < 24; hour++) {
    const forecast = await forecastDemand({
      ...options,
      targetDate,
      targetHour: hour,
    });
    forecasts.push(forecast);
  }

  return forecasts;
}

/**
 * Generate forecasts for the next 7 days
 */
export async function forecastWeek(options: {
  zoneId?: string;
  merchantId?: string;
  startDate?: Date;
} = {}): Promise<Map<string, ForecastResult[]>> {
  const results = new Map<string, ForecastResult[]>();
  const startDate = options.startDate || new Date();

  for (let day = 0; day < 7; day++) {
    const targetDate = new Date(startDate);
    targetDate.setDate(targetDate.getDate() + day);

    const dayKey = targetDate.toISOString().split('T')[0];
    const dayForecasts = await forecastDay(targetDate, {
      zoneId: options.zoneId,
      merchantId: options.merchantId,
    });

    results.set(dayKey, dayForecasts);
  }

  return results;
}

/**
 * Save forecasts to database for capacity planning
 */
export async function saveForecast(
  forecast: ForecastResult,
  input: ForecastInput
): Promise<void> {
  const { zoneId, merchantId, targetDate, targetHour } = input;

  await supabaseAdmin.from('demand_forecasts').upsert({
    zone_id: zoneId,
    merchant_id: merchantId,
    forecast_date: targetDate.toISOString().split('T')[0],
    hour: targetHour,
    predicted_orders: forecast.predictedOrders,
    predicted_drivers_needed: forecast.predictedDriversNeeded,
    confidence: forecast.confidence,
    model_version: 'v1.0',
  }, {
    onConflict: 'zone_id,merchant_id,forecast_date,hour',
  });
}

/**
 * Generate and save forecasts for the next week
 */
export async function generateWeeklyForecasts(options: {
  zoneId?: string;
  merchantId?: string;
} = {}): Promise<{
  totalForecasts: number;
  avgDailyOrders: number;
  peakDay: string;
  peakHour: number;
}> {
  const weekForecasts = await forecastWeek(options);

  let totalForecasts = 0;
  let totalOrders = 0;
  let peakOrders = 0;
  let peakDay = '';
  let peakHour = 0;

  for (const [day, dayForecasts] of weekForecasts) {
    let dayTotal = 0;

    for (let hour = 0; hour < dayForecasts.length; hour++) {
      const forecast = dayForecasts[hour];

      // Save forecast
      await saveForecast(forecast, {
        ...options,
        targetDate: new Date(day),
        targetHour: hour,
      });

      dayTotal += forecast.predictedOrders;
      totalForecasts++;

      if (forecast.predictedOrders > peakOrders) {
        peakOrders = forecast.predictedOrders;
        peakDay = day;
        peakHour = hour;
      }
    }

    totalOrders += dayTotal;
  }

  logger.info('Weekly forecasts generated', {
    totalForecasts,
    avgDailyOrders: Math.round(totalOrders / 7),
    peakDay,
    peakHour,
    ...options,
  });

  return {
    totalForecasts,
    avgDailyOrders: Math.round(totalOrders / 7),
    peakDay,
    peakHour,
  };
}

/**
 * Compare forecasts with actual data
 */
export async function evaluateForecastAccuracy(
  options: {
    zoneId?: string;
    merchantId?: string;
    daysBack?: number;
  } = {}
): Promise<{
  meanAbsoluteError: number;
  meanPercentageError: number;
  accuracy: number;
  sampleSize: number;
}> {
  const { zoneId, merchantId, daysBack = 7 } = options;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  // Get forecasts with actual data
  let query = supabaseAdmin
    .from('demand_forecasts')
    .select('predicted_orders, actual_orders')
    .gte('forecast_date', startDate.toISOString().split('T')[0])
    .not('actual_orders', 'is', null);

  if (zoneId) {
    query = query.eq('zone_id', zoneId);
  }
  if (merchantId) {
    query = query.eq('merchant_id', merchantId);
  }

  const { data: forecasts } = await query;

  if (!forecasts || forecasts.length === 0) {
    return {
      meanAbsoluteError: 0,
      meanPercentageError: 0,
      accuracy: 0,
      sampleSize: 0,
    };
  }

  let totalAbsError = 0;
  let totalPctError = 0;
  let withinThreshold = 0;

  for (const f of forecasts) {
    const absError = Math.abs(f.predicted_orders - f.actual_orders);
    totalAbsError += absError;

    if (f.actual_orders > 0) {
      totalPctError += absError / f.actual_orders;
    }

    // Consider accurate if within 20%
    if (f.actual_orders === 0 || absError / f.actual_orders <= 0.2) {
      withinThreshold++;
    }
  }

  const n = forecasts.length;

  return {
    meanAbsoluteError: Math.round(totalAbsError / n * 10) / 10,
    meanPercentageError: Math.round(totalPctError / n * 1000) / 10,
    accuracy: Math.round(withinThreshold / n * 1000) / 10,
    sampleSize: n,
  };
}

/**
 * Update forecasts with actual order counts
 */
export async function updateActualDemand(): Promise<number> {
  const now = new Date();
  const currentHour = now.getHours();
  const today = now.toISOString().split('T')[0];

  // Get actual order counts for completed hours today
  const { data: hourlyOrders } = await supabaseAdmin
    .from('orders')
    .select('zone_id, merchant_id, created_at')
    .gte('created_at', `${today}T00:00:00`)
    .lt('created_at', `${today}T${String(currentHour).padStart(2, '0')}:00:00`);

  if (!hourlyOrders) return 0;

  // Group by zone, merchant, and hour
  const counts: Record<string, number> = {};

  for (const order of hourlyOrders) {
    const hour = new Date(order.created_at).getHours();
    const key = `${order.zone_id || 'null'}_${order.merchant_id || 'null'}_${hour}`;
    counts[key] = (counts[key] || 0) + 1;
  }

  // Update forecasts
  let updated = 0;
  for (const [key, count] of Object.entries(counts)) {
    const [zoneId, merchantId, hourStr] = key.split('_');

    await supabaseAdmin
      .from('demand_forecasts')
      .update({ actual_orders: count })
      .eq('forecast_date', today)
      .eq('hour', parseInt(hourStr))
      .eq('zone_id', zoneId === 'null' ? null : zoneId)
      .eq('merchant_id', merchantId === 'null' ? null : merchantId);

    updated++;
  }

  return updated;
}

/**
 * Get capacity recommendations based on forecasts
 */
export async function getCapacityRecommendations(options: {
  zoneId?: string;
  targetDate?: Date;
}): Promise<{
  recommendedDrivers: Record<number, number>;
  peakPeriods: Array<{ start: number; end: number; drivers: number }>;
  totalDriverHours: number;
  alerts: string[];
}> {
  const targetDate = options.targetDate || new Date();
  const dayForecasts = await forecastDay(targetDate, { zoneId: options.zoneId });

  const recommendedDrivers: Record<number, number> = {};
  const alerts: string[] = [];
  let totalDriverHours = 0;

  // Calculate recommended drivers per hour
  for (let hour = 0; hour < 24; hour++) {
    const forecast = dayForecasts[hour];
    recommendedDrivers[hour] = forecast.predictedDriversNeeded;
    totalDriverHours += forecast.predictedDriversNeeded;

    // Generate alerts for high demand periods
    if (forecast.predictedDriversNeeded > 10) {
      alerts.push(`High demand expected at ${hour}:00 - ${forecast.predictedDriversNeeded} drivers needed`);
    }
  }

  // Identify peak periods (consecutive hours with above-average demand)
  const avgDrivers = totalDriverHours / 24;
  const peakPeriods: Array<{ start: number; end: number; drivers: number }> = [];
  let currentPeak: { start: number; end: number; drivers: number } | null = null;

  for (let hour = 0; hour < 24; hour++) {
    const drivers = recommendedDrivers[hour];

    if (drivers > avgDrivers * 1.2) {
      if (currentPeak) {
        currentPeak.end = hour;
        currentPeak.drivers = Math.max(currentPeak.drivers, drivers);
      } else {
        currentPeak = { start: hour, end: hour, drivers };
      }
    } else if (currentPeak) {
      peakPeriods.push(currentPeak);
      currentPeak = null;
    }
  }

  if (currentPeak) {
    peakPeriods.push(currentPeak);
  }

  return {
    recommendedDrivers,
    peakPeriods,
    totalDriverHours,
    alerts,
  };
}

// Helper functions

async function getHistoricalDemand(options: {
  zoneId?: string;
  merchantId?: string;
  daysBack: number;
}): Promise<HistoricalDataPoint[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - options.daysBack);

  let query = supabaseAdmin
    .from('demand_history')
    .select('*')
    .gte('recorded_date', startDate.toISOString().split('T')[0]);

  if (options.zoneId) {
    query = query.eq('zone_id', options.zoneId);
  }
  if (options.merchantId) {
    query = query.eq('merchant_id', options.merchantId);
  }

  const { data } = await query;

  if (!data) return [];

  return data.map((d) => ({
    date: new Date(d.recorded_date),
    hour: d.hour,
    orderCount: d.order_count,
    dayOfWeek: new Date(d.recorded_date).getDay(),
    isWeekend: d.is_weekend,
    isHoliday: d.is_holiday,
    weatherCondition: d.weather_condition,
    specialEvent: d.special_event,
  }));
}

function analyzePatterns(data: HistoricalDataPoint[]): DemandPattern {
  // Hourly pattern
  const hourlyTotals: Record<number, number[]> = {};
  const weeklyTotals: Record<number, number[]> = {};
  const monthlyTotals: Record<number, number[]> = {};

  for (const point of data) {
    if (!hourlyTotals[point.hour]) hourlyTotals[point.hour] = [];
    hourlyTotals[point.hour].push(point.orderCount);

    if (!weeklyTotals[point.dayOfWeek]) weeklyTotals[point.dayOfWeek] = [];
    weeklyTotals[point.dayOfWeek].push(point.orderCount);

    const month = point.date.getMonth();
    if (!monthlyTotals[month]) monthlyTotals[month] = [];
    monthlyTotals[month].push(point.orderCount);
  }

  // Calculate averages
  const hourlyPattern: Record<number, number> = {};
  const weeklyPattern: Record<number, number> = {};
  const monthlyPattern: Record<number, number> = {};

  const overallAvg = data.reduce((sum, p) => sum + p.orderCount, 0) / data.length;

  for (let h = 0; h < 24; h++) {
    const vals = hourlyTotals[h] || [0];
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    hourlyPattern[h] = overallAvg > 0 ? avg / overallAvg : 1.0;
  }

  for (let d = 0; d < 7; d++) {
    const vals = weeklyTotals[d] || [0];
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    weeklyPattern[d] = overallAvg > 0 ? avg / overallAvg : 1.0;
  }

  for (let m = 0; m < 12; m++) {
    const vals = monthlyTotals[m] || [0];
    const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : overallAvg;
    monthlyPattern[m] = overallAvg > 0 ? avg / overallAvg : 1.0;
  }

  // Find peak and low hours
  const hourlyAvgs = Object.entries(hourlyPattern)
    .map(([h, f]) => ({ hour: parseInt(h), factor: f }))
    .sort((a, b) => b.factor - a.factor);

  const peakHours = hourlyAvgs.slice(0, 3).map((h) => h.hour);
  const lowHours = hourlyAvgs.slice(-3).map((h) => h.hour);

  return {
    hourlyPattern,
    weeklyPattern,
    monthlyPattern,
    avgOrdersPerHour: overallAvg,
    peakHours,
    lowHours,
  };
}

function calculateRecentAverage(
  data: HistoricalDataPoint[],
  days: number,
  skipDays: number = 0
): number {
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - days - skipDays);
  const endDate = new Date();
  endDate.setDate(now.getDate() - skipDays);

  const recentData = data.filter((d) => d.date >= startDate && d.date < endDate);

  if (recentData.length === 0) return 0;

  return recentData.reduce((sum, p) => sum + p.orderCount, 0) / recentData.length;
}

function calculateVariance(
  data: HistoricalDataPoint[],
  targetHour: number,
  targetDayOfWeek: number
): number {
  const relevantData = data.filter(
    (d) => d.hour === targetHour && d.dayOfWeek === targetDayOfWeek
  );

  if (relevantData.length < 2) return 5; // Default variance

  const avg = relevantData.reduce((sum, p) => sum + p.orderCount, 0) / relevantData.length;
  const squaredDiffs = relevantData.map((p) => Math.pow(p.orderCount - avg, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / relevantData.length;

  return Math.sqrt(variance);
}

function checkHoliday(date: Date): boolean {
  const dateStr = date.toISOString().split('T')[0];
  // Replace year with current year for matching
  const currentYear = date.getFullYear();
  const holidays = HOLIDAYS_2024.map((h) => h.replace('2024', String(currentYear)));
  return holidays.includes(dateStr);
}

function getDefaultForecast(targetDate: Date, targetHour: number): ForecastResult {
  const dayOfWeek = targetDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isHoliday = checkHoliday(targetDate);

  // Default hourly distribution
  const defaultHourlyOrders: Record<number, number> = {
    0: 2, 1: 1, 2: 1, 3: 1, 4: 1, 5: 2,
    6: 3, 7: 5, 8: 8, 9: 10, 10: 12, 11: 15,
    12: 20, 13: 18, 14: 15, 15: 12, 16: 12, 17: 15,
    18: 20, 19: 25, 20: 22, 21: 18, 22: 10, 23: 5,
  };

  let predictedOrders = defaultHourlyOrders[targetHour] || 10;

  if (isWeekend) predictedOrders = Math.round(predictedOrders * 1.2);
  if (isHoliday) predictedOrders = Math.round(predictedOrders * 0.7);

  return {
    predictedOrders,
    predictedDriversNeeded: Math.ceil(predictedOrders / 3),
    confidence: 0.5, // Low confidence for default
    factors: {
      dayOfWeek: getDayName(dayOfWeek),
      isWeekend,
      isHoliday,
      historicalAvg: 10,
      trend: 1.0,
      seasonality: 1.0,
    },
    range: {
      min: Math.round(predictedOrders * 0.6),
      max: Math.round(predictedOrders * 1.4),
    },
  };
}

function getDayName(day: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[day];
}
