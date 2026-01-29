import { Router } from 'express';
import { performHealthCheck, metrics } from '../lib/monitoring.js';
import { sendSuccess } from '../utils/response.js';

const router = Router();

/**
 * Detailed health check endpoint
 * GET /health
 */
router.get('/', async (req, res, next) => {
  try {
    const health = await performHealthCheck();

    // Set appropriate status code based on health
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      success: health.status !== 'unhealthy',
      data: health,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Liveness probe - simple check if the server is running
 * GET /health/live
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'alive',
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * Readiness probe - check if the server is ready to accept traffic
 * GET /health/ready
 */
router.get('/ready', async (req, res) => {
  try {
    const health = await performHealthCheck();

    if (health.status === 'unhealthy') {
      res.status(503).json({
        success: false,
        data: {
          status: 'not_ready',
          reason: 'One or more services are unhealthy',
          services: health.services,
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        status: 'ready',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      data: {
        status: 'not_ready',
        reason: 'Health check failed',
      },
    });
  }
});

/**
 * Metrics endpoint (for monitoring systems)
 * GET /health/metrics
 */
router.get('/metrics', (req, res) => {
  const metricsData = metrics.getMetrics();
  const memUsage = process.memoryUsage();

  sendSuccess(res, {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    ...metricsData,
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
    },
    nodeVersion: process.version,
    platform: process.platform,
  });
});

/**
 * Prometheus-compatible metrics endpoint
 * GET /health/prometheus
 */
router.get('/prometheus', (req, res) => {
  const metricsData = metrics.getMetrics();
  const memUsage = process.memoryUsage();

  const prometheusMetrics = `
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total ${metricsData.requests.total}

# HELP http_request_errors_total Total number of HTTP request errors
# TYPE http_request_errors_total counter
http_request_errors_total ${metricsData.requests.errors}

# HELP http_request_duration_seconds HTTP request latency
# TYPE http_request_duration_seconds summary
http_request_duration_seconds{quantile="0.5"} ${metricsData.latency.p50 / 1000}
http_request_duration_seconds{quantile="0.95"} ${metricsData.latency.p95 / 1000}
http_request_duration_seconds{quantile="0.99"} ${metricsData.latency.p99 / 1000}

# HELP process_memory_bytes Process memory usage
# TYPE process_memory_bytes gauge
process_memory_rss_bytes ${memUsage.rss}
process_memory_heap_total_bytes ${memUsage.heapTotal}
process_memory_heap_used_bytes ${memUsage.heapUsed}

# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds gauge
process_uptime_seconds ${process.uptime()}
`.trim();

  res.set('Content-Type', 'text/plain');
  res.send(prometheusMetrics);
});

export default router;
