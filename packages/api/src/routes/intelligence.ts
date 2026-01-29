/**
 * Intelligence Layer API Routes
 *
 * Endpoints for AI/ML powered features:
 * - Delivery time prediction
 * - Smart order allocation
 * - Geofencing and zones
 * - Demand forecasting
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';
import {
  // Delivery prediction
  predictDeliveryTime,
  getHistoricalData,
  updateModelWeights,
  calculateAccuracy,
  // Order allocation
  findBestDriver,
  autoAssignOrder,
  batchAllocate,
  reassignOrder,
  // Geofencing
  createZone,
  updateZone,
  deleteZone,
  getZones,
  checkServiceability,
  createSurgeRule,
  calculateSurgeMultiplier,
  getDriversInZone,
  getZoneStats,
  // Demand forecasting
  forecastDemand,
  forecastDay,
  generateWeeklyForecasts,
  evaluateForecastAccuracy,
  getCapacityRecommendations,
} from '../services/intelligence/index.js';

const router = Router();

// ============================================
// DELIVERY PREDICTION ENDPOINTS
// ============================================

/**
 * Predict delivery time for an order
 */
router.post('/predict-delivery', authenticate, async (req: Request, res: Response) => {
  try {
    const {
      pickupLat,
      pickupLng,
      deliveryLat,
      deliveryLng,
      merchantId,
      driverId,
      scheduledTime,
    } = req.body;

    if (!pickupLat || !pickupLng || !deliveryLat || !deliveryLng) {
      return res.status(400).json({ error: 'Missing required coordinates' });
    }

    const prediction = await predictDeliveryTime({
      pickupLat,
      pickupLng,
      deliveryLat,
      deliveryLng,
      merchantId,
      driverId,
      scheduledTime: scheduledTime ? new Date(scheduledTime) : undefined,
    });

    return res.json(prediction);
  } catch (error) {
    logger.error('Delivery prediction error', { error });
    return res.status(500).json({ error: 'Prediction failed' });
  }
});

/**
 * Get prediction model accuracy metrics
 */
router.get('/predict-delivery/accuracy', authenticate, requireRole(['admin', 'merchant']), async (req: Request, res: Response) => {
  try {
    const merchantId = req.query.merchantId as string | undefined;
    const daysBack = parseInt(req.query.daysBack as string) || 7;

    const accuracy = await calculateAccuracy(merchantId, daysBack);

    return res.json(accuracy);
  } catch (error) {
    logger.error('Accuracy calculation error', { error });
    return res.status(500).json({ error: 'Failed to calculate accuracy' });
  }
});

/**
 * Retrain prediction model with latest data
 */
router.post('/predict-delivery/train', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.body;

    const newWeights = await updateModelWeights(merchantId);

    return res.json({
      message: 'Model retrained successfully',
      weights: newWeights,
    });
  } catch (error) {
    logger.error('Model training error', { error });
    return res.status(500).json({ error: 'Training failed' });
  }
});

// ============================================
// ORDER ALLOCATION ENDPOINTS
// ============================================

/**
 * Find best driver for an order
 */
router.post('/allocation/find-driver', authenticate, requireRole(['admin', 'merchant']), async (req: Request, res: Response) => {
  try {
    const {
      orderId,
      merchantId,
      pickupLatitude,
      pickupLongitude,
      deliveryLatitude,
      deliveryLongitude,
      totalAmount,
      isCod,
      deliveryFee,
      priority,
      maxDistance,
      vehicleTypes,
      excludeDrivers,
      minRating,
    } = req.body;

    if (!pickupLatitude || !pickupLongitude || !deliveryLatitude || !deliveryLongitude) {
      return res.status(400).json({ error: 'Missing required coordinates' });
    }

    const result = await findBestDriver(
      {
        id: orderId || 'temp',
        merchant_id: merchantId,
        pickup_latitude: pickupLatitude,
        pickup_longitude: pickupLongitude,
        delivery_latitude: deliveryLatitude,
        delivery_longitude: deliveryLongitude,
        total_amount: totalAmount || 0,
        is_cod: isCod || false,
        delivery_fee: deliveryFee || 0,
        priority,
      },
      {
        maxDistance,
        vehicleTypes,
        excludeDrivers,
        minRating,
      }
    );

    return res.json(result);
  } catch (error) {
    logger.error('Find driver error', { error });
    return res.status(500).json({ error: 'Failed to find driver' });
  }
});

/**
 * Auto-assign driver to an order
 */
router.post('/allocation/auto-assign/:orderId', authenticate, requireRole(['admin', 'merchant']), async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const result = await autoAssignOrder(orderId);

    return res.json(result);
  } catch (error) {
    logger.error('Auto-assign error', { error, orderId: req.params.orderId });
    return res.status(500).json({ error: 'Failed to auto-assign' });
  }
});

/**
 * Batch assign multiple orders
 */
router.post('/allocation/batch', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { orderIds } = req.body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ error: 'orderIds array is required' });
    }

    const result = await batchAllocate(orderIds);

    return res.json(result);
  } catch (error) {
    logger.error('Batch allocation error', { error });
    return res.status(500).json({ error: 'Batch allocation failed' });
  }
});

/**
 * Reassign order to a different driver
 */
router.post('/allocation/reassign/:orderId', authenticate, requireRole(['admin', 'merchant']), async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const result = await reassignOrder(orderId, reason || 'Manual reassignment');

    return res.json(result);
  } catch (error) {
    logger.error('Reassign error', { error, orderId: req.params.orderId });
    return res.status(500).json({ error: 'Failed to reassign' });
  }
});

// ============================================
// GEOFENCING ENDPOINTS
// ============================================

/**
 * Create a new zone
 */
router.post('/zones', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { name, type, polygon, properties, merchantId } = req.body;

    if (!name || !type || !polygon?.coordinates) {
      return res.status(400).json({ error: 'Missing required fields: name, type, polygon' });
    }

    const zone = await createZone({
      name,
      type,
      polygon,
      properties: properties || {},
      isActive: true,
      merchantId,
    });

    return res.status(201).json(zone);
  } catch (error) {
    logger.error('Create zone error', { error });
    return res.status(500).json({ error: 'Failed to create zone' });
  }
});

/**
 * Get all zones
 */
router.get('/zones', authenticate, async (req: Request, res: Response) => {
  try {
    const type = req.query.type as string | undefined;
    const merchantId = req.query.merchantId as string | undefined;
    const activeOnly = req.query.activeOnly !== 'false';

    const zones = await getZones({
      type: type as 'delivery' | 'pickup' | 'restricted' | 'surge' | 'warehouse' | undefined,
      merchantId,
      activeOnly,
    });

    return res.json(zones);
  } catch (error) {
    logger.error('Get zones error', { error });
    return res.status(500).json({ error: 'Failed to get zones' });
  }
});

/**
 * Update a zone
 */
router.put('/zones/:zoneId', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const updates = req.body;

    const zone = await updateZone(zoneId, updates);

    return res.json(zone);
  } catch (error) {
    logger.error('Update zone error', { error, zoneId: req.params.zoneId });
    return res.status(500).json({ error: 'Failed to update zone' });
  }
});

/**
 * Delete a zone
 */
router.delete('/zones/:zoneId', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;

    await deleteZone(zoneId);

    return res.json({ message: 'Zone deleted' });
  } catch (error) {
    logger.error('Delete zone error', { error, zoneId: req.params.zoneId });
    return res.status(500).json({ error: 'Failed to delete zone' });
  }
});

/**
 * Check serviceability for a location
 */
router.post('/zones/check-serviceability', authenticate, async (req: Request, res: Response) => {
  try {
    const { latitude, longitude, merchantId, orderValue, vehicleType } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Missing required coordinates' });
    }

    const result = await checkServiceability(
      { latitude, longitude },
      { merchantId, orderValue, vehicleType }
    );

    return res.json(result);
  } catch (error) {
    logger.error('Serviceability check error', { error });
    return res.status(500).json({ error: 'Failed to check serviceability' });
  }
});

/**
 * Get zone statistics
 */
router.get('/zones/:zoneId/stats', authenticate, requireRole(['admin', 'merchant']), async (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const daysBack = parseInt(req.query.daysBack as string) || 7;

    const stats = await getZoneStats(zoneId, daysBack);

    return res.json(stats);
  } catch (error) {
    logger.error('Zone stats error', { error, zoneId: req.params.zoneId });
    return res.status(500).json({ error: 'Failed to get zone stats' });
  }
});

/**
 * Get drivers in a zone
 */
router.get('/zones/:zoneId/drivers', authenticate, requireRole(['admin', 'merchant']), async (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;

    const drivers = await getDriversInZone(zoneId);

    return res.json(drivers);
  } catch (error) {
    logger.error('Get drivers in zone error', { error, zoneId: req.params.zoneId });
    return res.status(500).json({ error: 'Failed to get drivers' });
  }
});

/**
 * Create surge pricing rule
 */
router.post('/zones/:zoneId/surge-rules', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const { condition, multiplier, priority } = req.body;

    if (!condition || !multiplier) {
      return res.status(400).json({ error: 'Missing required fields: condition, multiplier' });
    }

    const rule = await createSurgeRule({
      zoneId,
      condition,
      multiplier,
      isActive: true,
      priority: priority || 0,
    });

    return res.status(201).json(rule);
  } catch (error) {
    logger.error('Create surge rule error', { error });
    return res.status(500).json({ error: 'Failed to create surge rule' });
  }
});

/**
 * Calculate current surge multiplier for a zone
 */
router.get('/zones/:zoneId/surge', authenticate, async (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const latitude = parseFloat(req.query.latitude as string);
    const longitude = parseFloat(req.query.longitude as string);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'Valid latitude and longitude required' });
    }

    const multiplier = await calculateSurgeMultiplier(zoneId, { latitude, longitude });

    return res.json({ multiplier });
  } catch (error) {
    logger.error('Surge calculation error', { error, zoneId: req.params.zoneId });
    return res.status(500).json({ error: 'Failed to calculate surge' });
  }
});

// ============================================
// DEMAND FORECASTING ENDPOINTS
// ============================================

/**
 * Get demand forecast for specific time
 */
router.post('/forecast', authenticate, requireRole(['admin', 'merchant']), async (req: Request, res: Response) => {
  try {
    const { zoneId, merchantId, targetDate, targetHour } = req.body;

    if (targetDate === undefined || targetHour === undefined) {
      return res.status(400).json({ error: 'targetDate and targetHour are required' });
    }

    const forecast = await forecastDemand({
      zoneId,
      merchantId,
      targetDate: new Date(targetDate),
      targetHour,
    });

    return res.json(forecast);
  } catch (error) {
    logger.error('Forecast error', { error });
    return res.status(500).json({ error: 'Forecast failed' });
  }
});

/**
 * Get forecasts for an entire day
 */
router.get('/forecast/day', authenticate, requireRole(['admin', 'merchant']), async (req: Request, res: Response) => {
  try {
    const targetDate = req.query.date ? new Date(req.query.date as string) : new Date();
    const zoneId = req.query.zoneId as string | undefined;
    const merchantId = req.query.merchantId as string | undefined;

    const forecasts = await forecastDay(targetDate, { zoneId, merchantId });

    return res.json({
      date: targetDate.toISOString().split('T')[0],
      forecasts,
    });
  } catch (error) {
    logger.error('Day forecast error', { error });
    return res.status(500).json({ error: 'Forecast failed' });
  }
});

/**
 * Generate weekly forecasts
 */
router.post('/forecast/generate-weekly', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { zoneId, merchantId } = req.body;

    const result = await generateWeeklyForecasts({ zoneId, merchantId });

    return res.json(result);
  } catch (error) {
    logger.error('Weekly forecast generation error', { error });
    return res.status(500).json({ error: 'Failed to generate forecasts' });
  }
});

/**
 * Get forecast accuracy metrics
 */
router.get('/forecast/accuracy', authenticate, requireRole(['admin', 'merchant']), async (req: Request, res: Response) => {
  try {
    const zoneId = req.query.zoneId as string | undefined;
    const merchantId = req.query.merchantId as string | undefined;
    const daysBack = parseInt(req.query.daysBack as string) || 7;

    const accuracy = await evaluateForecastAccuracy({ zoneId, merchantId, daysBack });

    return res.json(accuracy);
  } catch (error) {
    logger.error('Forecast accuracy error', { error });
    return res.status(500).json({ error: 'Failed to get accuracy' });
  }
});

/**
 * Get capacity recommendations based on forecasts
 */
router.get('/forecast/capacity', authenticate, requireRole(['admin', 'merchant']), async (req: Request, res: Response) => {
  try {
    const targetDate = req.query.date ? new Date(req.query.date as string) : new Date();
    const zoneId = req.query.zoneId as string | undefined;

    const recommendations = await getCapacityRecommendations({ zoneId, targetDate });

    return res.json(recommendations);
  } catch (error) {
    logger.error('Capacity recommendations error', { error });
    return res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

export default router;
