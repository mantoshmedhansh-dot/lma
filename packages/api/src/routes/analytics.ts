/**
 * Analytics & Dashboard API Routes
 *
 * Endpoints for:
 * - KPI data
 * - Report generation
 * - Real-time dashboard feeds
 * - Alert management
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';
import {
  // KPIs
  getDeliveryKPIs,
  getDriverKPIs,
  getMerchantKPIs,
  getFinancialKPIs,
  getOperationalKPIs,
  getDashboardSummary,
  compareKPIs,
  getDateRange,
  // Reports
  generateReport,
  scheduleReport,
  getScheduledReports,
  runDueReports,
  // Real-time
  getLiveOrderStats,
  getLiveDriverStats,
  getLiveOperationalMetrics,
  getDashboardFeed,
  getActiveAlerts,
  acknowledgeAlert,
  getOrderTimeline,
  getOrderHeatmapData,
  getSystemHealth,
  trackDriverLocation,
} from '../services/analytics/index.js';

const router = Router();

// ============================================
// KPI ENDPOINTS
// ============================================

/**
 * Get delivery KPIs
 */
router.get('/kpi/delivery', authenticate, requireRole(['admin', 'merchant']), async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'week';
    const merchantId = req.query.merchantId as string | undefined;
    const zoneId = req.query.zoneId as string | undefined;

    const kpis = await getDeliveryKPIs(period as 'today' | 'week' | 'month', {
      merchantId,
      zoneId,
    });

    return res.json(kpis);
  } catch (error) {
    logger.error('Failed to get delivery KPIs', { error });
    return res.status(500).json({ error: 'Failed to get delivery KPIs' });
  }
});

/**
 * Get driver KPIs
 */
router.get('/kpi/drivers', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'week';
    const zoneId = req.query.zoneId as string | undefined;

    const kpis = await getDriverKPIs(period as 'today' | 'week' | 'month', { zoneId });

    return res.json(kpis);
  } catch (error) {
    logger.error('Failed to get driver KPIs', { error });
    return res.status(500).json({ error: 'Failed to get driver KPIs' });
  }
});

/**
 * Get merchant KPIs
 */
router.get('/kpi/merchants', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'week';
    const category = req.query.category as string | undefined;

    const kpis = await getMerchantKPIs(period as 'today' | 'week' | 'month', { category });

    return res.json(kpis);
  } catch (error) {
    logger.error('Failed to get merchant KPIs', { error });
    return res.status(500).json({ error: 'Failed to get merchant KPIs' });
  }
});

/**
 * Get financial KPIs
 */
router.get('/kpi/financial', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'week';
    const merchantId = req.query.merchantId as string | undefined;

    const kpis = await getFinancialKPIs(period as 'today' | 'week' | 'month', { merchantId });

    return res.json(kpis);
  } catch (error) {
    logger.error('Failed to get financial KPIs', { error });
    return res.status(500).json({ error: 'Failed to get financial KPIs' });
  }
});

/**
 * Get operational KPIs
 */
router.get('/kpi/operational', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'week';

    const kpis = await getOperationalKPIs(period as 'today' | 'week' | 'month');

    return res.json(kpis);
  } catch (error) {
    logger.error('Failed to get operational KPIs', { error });
    return res.status(500).json({ error: 'Failed to get operational KPIs' });
  }
});

/**
 * Get complete dashboard summary
 */
router.get('/kpi/summary', authenticate, requireRole(['admin', 'merchant']), async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'week';
    const merchantId = req.query.merchantId as string | undefined;
    const zoneId = req.query.zoneId as string | undefined;

    const summary = await getDashboardSummary(period as 'today' | 'week' | 'month', {
      merchantId,
      zoneId,
    });

    return res.json(summary);
  } catch (error) {
    logger.error('Failed to get dashboard summary', { error });
    return res.status(500).json({ error: 'Failed to get dashboard summary' });
  }
});

/**
 * Compare KPIs between periods
 */
router.get('/kpi/compare', authenticate, requireRole(['admin', 'merchant']), async (req: Request, res: Response) => {
  try {
    const currentPeriod = (req.query.current as string) || 'week';
    const previousPeriod = (req.query.previous as string) || 'month';
    const merchantId = req.query.merchantId as string | undefined;
    const zoneId = req.query.zoneId as string | undefined;

    const comparison = await compareKPIs(
      currentPeriod as 'today' | 'week' | 'month',
      previousPeriod as 'today' | 'week' | 'month',
      { merchantId, zoneId }
    );

    return res.json(comparison);
  } catch (error) {
    logger.error('Failed to compare KPIs', { error });
    return res.status(500).json({ error: 'Failed to compare KPIs' });
  }
});

// ============================================
// REPORT ENDPOINTS
// ============================================

/**
 * Generate a report
 */
router.post('/reports/generate', authenticate, requireRole(['admin', 'merchant']), async (req: Request, res: Response) => {
  try {
    const { type, format, dateRange, filters } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'Report type is required' });
    }

    const report = await generateReport({
      type,
      format: format || 'json',
      dateRange: dateRange ? {
        start: new Date(dateRange.start),
        end: new Date(dateRange.end),
      } : undefined,
      filters,
    });

    return res.json(report);
  } catch (error) {
    logger.error('Failed to generate report', { error });
    return res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * Schedule a report
 */
router.post('/reports/schedule', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { type, format, schedule, recipients, filters } = req.body;

    if (!type || !schedule || !recipients?.length) {
      return res.status(400).json({ error: 'Type, schedule, and recipients are required' });
    }

    const scheduledReport = await scheduleReport({
      type,
      format: format || 'csv',
      schedule,
      recipients,
      filters,
    });

    return res.status(201).json(scheduledReport);
  } catch (error) {
    logger.error('Failed to schedule report', { error });
    return res.status(500).json({ error: 'Failed to schedule report' });
  }
});

/**
 * Get scheduled reports
 */
router.get('/reports/scheduled', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const reports = await getScheduledReports();
    return res.json(reports);
  } catch (error) {
    logger.error('Failed to get scheduled reports', { error });
    return res.status(500).json({ error: 'Failed to get scheduled reports' });
  }
});

/**
 * Manually run due reports (admin task)
 */
router.post('/reports/run-due', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const count = await runDueReports();
    return res.json({ message: `Generated ${count} reports` });
  } catch (error) {
    logger.error('Failed to run due reports', { error });
    return res.status(500).json({ error: 'Failed to run due reports' });
  }
});

// ============================================
// REAL-TIME ENDPOINTS
// ============================================

/**
 * Get live dashboard feed
 */
router.get('/live/feed', authenticate, requireRole(['admin', 'merchant']), async (req: Request, res: Response) => {
  try {
    const feed = await getDashboardFeed();
    return res.json(feed);
  } catch (error) {
    logger.error('Failed to get dashboard feed', { error });
    return res.status(500).json({ error: 'Failed to get dashboard feed' });
  }
});

/**
 * Get live order stats
 */
router.get('/live/orders', authenticate, requireRole(['admin', 'merchant']), async (req: Request, res: Response) => {
  try {
    const stats = await getLiveOrderStats();
    return res.json(stats);
  } catch (error) {
    logger.error('Failed to get live order stats', { error });
    return res.status(500).json({ error: 'Failed to get live order stats' });
  }
});

/**
 * Get live driver stats with locations
 */
router.get('/live/drivers', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const stats = await getLiveDriverStats();
    return res.json(stats);
  } catch (error) {
    logger.error('Failed to get live driver stats', { error });
    return res.status(500).json({ error: 'Failed to get live driver stats' });
  }
});

/**
 * Get live operational metrics
 */
router.get('/live/operations', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const metrics = await getLiveOperationalMetrics();
    return res.json(metrics);
  } catch (error) {
    logger.error('Failed to get operational metrics', { error });
    return res.status(500).json({ error: 'Failed to get operational metrics' });
  }
});

/**
 * Get order heatmap data
 */
router.get('/live/heatmap', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const data = await getOrderHeatmapData();
    return res.json(data);
  } catch (error) {
    logger.error('Failed to get heatmap data', { error });
    return res.status(500).json({ error: 'Failed to get heatmap data' });
  }
});

/**
 * Get order timeline
 */
router.get('/live/orders/:orderId/timeline', authenticate, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const timeline = await getOrderTimeline(orderId);
    return res.json(timeline);
  } catch (error) {
    logger.error('Failed to get order timeline', { error, orderId: req.params.orderId });
    return res.status(500).json({ error: 'Failed to get order timeline' });
  }
});

/**
 * Update driver location
 */
router.post('/live/drivers/:driverId/location', authenticate, requireRole(['driver']), async (req: Request, res: Response) => {
  try {
    const { driverId } = req.params;
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    await trackDriverLocation(driverId, latitude, longitude);

    return res.json({ success: true });
  } catch (error) {
    logger.error('Failed to update driver location', { error, driverId: req.params.driverId });
    return res.status(500).json({ error: 'Failed to update location' });
  }
});

// ============================================
// ALERTS ENDPOINTS
// ============================================

/**
 * Get active alerts
 */
router.get('/alerts', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const alerts = await getActiveAlerts();
    return res.json(alerts);
  } catch (error) {
    logger.error('Failed to get alerts', { error });
    return res.status(500).json({ error: 'Failed to get alerts' });
  }
});

/**
 * Acknowledge an alert
 */
router.post('/alerts/:alertId/acknowledge', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    await acknowledgeAlert(alertId);
    return res.json({ success: true });
  } catch (error) {
    logger.error('Failed to acknowledge alert', { error, alertId: req.params.alertId });
    return res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// ============================================
// SYSTEM HEALTH
// ============================================

/**
 * Get system health metrics
 */
router.get('/health', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const health = await getSystemHealth();
    return res.json(health);
  } catch (error) {
    logger.error('Failed to get system health', { error });
    return res.status(500).json({ error: 'Failed to get system health' });
  }
});

export default router;
