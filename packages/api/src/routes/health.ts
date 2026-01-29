import { Router, Request, Response } from 'express';
import { sendSuccess } from '../utils/response.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';
import {
  getSystemHealth,
  quickHealthCheck,
  readinessCheck,
  livenessCheck,
  logHealthCheck,
  checkAlerts,
  getMetricsSummary,
  getHealthCheckHistory,
  calculateUptime,
  getRequestRate,
  getErrorRate,
  getStats as getCacheStats,
} from '../services/monitoring/index.js';
import { getStats as getAuditStats, getAuditSummary } from '../services/security/index.js';

const router = Router();

/**
 * Quick health check (for load balancers)
 * GET /health
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const health = await quickHealthCheck();
    res.status(health.status === 'ok' ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({ status: 'error', message: 'Health check failed' });
  }
});

/**
 * Full health check with all services
 * GET /health/full
 */
router.get('/full', async (req: Request, res: Response) => {
  try {
    const health = await getSystemHealth();
    await logHealthCheck(health);
    res.status(health.status === 'unhealthy' ? 503 : 200).json(health);
  } catch (error) {
    logger.error('Full health check failed', { error });
    res.status(503).json({ status: 'unhealthy', error: 'Health check failed' });
  }
});

/**
 * Kubernetes readiness probe
 * GET /health/ready
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const ready = await readinessCheck();
    res.status(ready.ready ? 200 : 503).json(ready);
  } catch (error) {
    res.status(503).json({ ready: false, error: 'Readiness check failed' });
  }
});

/**
 * Kubernetes liveness probe
 * GET /health/live
 */
router.get('/live', (req: Request, res: Response) => {
  const live = livenessCheck();
  res.status(200).json(live);
});

/**
 * Get system alerts
 * GET /health/alerts
 */
router.get('/alerts', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { alerts } = await checkAlerts();
    return res.json({ alerts, checkedAt: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to check alerts', { error });
    return res.status(500).json({ error: 'Failed to check alerts' });
  }
});

/**
 * Get metrics summary
 * GET /health/metrics/:metricName
 */
router.get('/metrics/:metricName', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { metricName } = req.params;
    const hours = parseInt(req.query.hours as string) || 24;

    const summary = await getMetricsSummary(metricName, hours);
    return res.json(summary);
  } catch (error) {
    logger.error('Failed to get metrics summary', { error });
    return res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * Get health check history for a service
 * GET /health/history/:serviceName
 */
router.get('/history/:serviceName', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { serviceName } = req.params;
    const hours = parseInt(req.query.hours as string) || 24;

    const history = await getHealthCheckHistory(serviceName, hours);
    return res.json(history);
  } catch (error) {
    logger.error('Failed to get health history', { error });
    return res.status(500).json({ error: 'Failed to get history' });
  }
});

/**
 * Get uptime for a service
 * GET /health/uptime/:serviceName
 */
router.get('/uptime/:serviceName', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { serviceName } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    const uptime = await calculateUptime(serviceName, days);
    return res.json({ serviceName, uptime, period: `${days} days` });
  } catch (error) {
    logger.error('Failed to calculate uptime', { error });
    return res.status(500).json({ error: 'Failed to calculate uptime' });
  }
});

/**
 * Get current rates
 * GET /health/rates
 */
router.get('/rates', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const [requestRate, errorRate] = await Promise.all([
      getRequestRate(),
      getErrorRate(),
    ]);

    return res.json({
      requestsPerMinute: requestRate,
      errorRatePercent: errorRate,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get rates', { error });
    return res.status(500).json({ error: 'Failed to get rates' });
  }
});

/**
 * Get cache statistics
 * GET /health/cache
 */
router.get('/cache', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const stats = getCacheStats();
    return res.json(stats);
  } catch (error) {
    logger.error('Failed to get cache stats', { error });
    return res.status(500).json({ error: 'Failed to get cache stats' });
  }
});

/**
 * Get audit summary
 * GET /health/audit
 */
router.get('/audit', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const daysBack = parseInt(req.query.daysBack as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const summary = await getAuditSummary(startDate, new Date());
    return res.json(summary);
  } catch (error) {
    logger.error('Failed to get audit summary', { error });
    return res.status(500).json({ error: 'Failed to get audit summary' });
  }
});

export default router;
