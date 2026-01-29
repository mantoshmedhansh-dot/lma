/**
 * Health Monitoring & Alerting Service
 *
 * Features:
 * - Service health checks
 * - Dependency monitoring (DB, Redis, external APIs)
 * - Performance metrics collection
 * - Alerting thresholds
 * - Status page data
 */

import { supabaseAdmin } from '../../config/supabase.js';
import { logger } from '../../lib/logger.js';
import os from 'os';

// Health check statuses
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

interface ServiceHealth {
  name: string;
  status: HealthStatus;
  responseTimeMs?: number;
  lastCheck: Date;
  message?: string;
  details?: Record<string, unknown>;
}

interface SystemHealth {
  status: HealthStatus;
  uptime: number;
  timestamp: Date;
  version: string;
  services: ServiceHealth[];
  system: {
    cpuUsage: number;
    memoryUsage: number;
    memoryTotal: number;
    memoryFree: number;
    loadAverage: number[];
  };
}

// Alert configuration
interface AlertThreshold {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
  severity: 'warning' | 'critical';
  message: string;
}

const DEFAULT_THRESHOLDS: AlertThreshold[] = [
  { metric: 'cpu_usage', operator: 'gt', value: 80, severity: 'warning', message: 'High CPU usage' },
  { metric: 'cpu_usage', operator: 'gt', value: 95, severity: 'critical', message: 'Critical CPU usage' },
  { metric: 'memory_usage', operator: 'gt', value: 85, severity: 'warning', message: 'High memory usage' },
  { metric: 'memory_usage', operator: 'gt', value: 95, severity: 'critical', message: 'Critical memory usage' },
  { metric: 'db_response_time', operator: 'gt', value: 500, severity: 'warning', message: 'Slow database response' },
  { metric: 'db_response_time', operator: 'gt', value: 2000, severity: 'critical', message: 'Database timeout risk' },
  { metric: 'error_rate', operator: 'gt', value: 5, severity: 'warning', message: 'Elevated error rate' },
  { metric: 'error_rate', operator: 'gt', value: 10, severity: 'critical', message: 'High error rate' },
];

// Metrics store
const metricsBuffer: Array<{
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
  timestamp: Date;
}> = [];

const METRICS_FLUSH_INTERVAL = 60000; // 1 minute
const MAX_BUFFER_SIZE = 1000;

// Application start time
const startTime = Date.now();

// ============================================
// HEALTH CHECKS
// ============================================

/**
 * Check database health
 */
async function checkDatabase(): Promise<ServiceHealth> {
  const startTime = Date.now();

  try {
    const { error } = await supabaseAdmin.from('users').select('count').limit(1);

    const responseTimeMs = Date.now() - startTime;

    if (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        responseTimeMs,
        lastCheck: new Date(),
        message: error.message,
      };
    }

    return {
      name: 'database',
      status: responseTimeMs > 500 ? 'degraded' : 'healthy',
      responseTimeMs,
      lastCheck: new Date(),
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'unhealthy',
      responseTimeMs: Date.now() - startTime,
      lastCheck: new Date(),
      message: (error as Error).message,
    };
  }
}

/**
 * Check Redis health (if using Redis)
 */
async function checkRedis(): Promise<ServiceHealth> {
  // Placeholder - implement when Redis is added
  return {
    name: 'redis',
    status: 'healthy',
    lastCheck: new Date(),
    message: 'Not configured',
  };
}

/**
 * Check external API health
 */
async function checkExternalAPI(name: string, url: string): Promise<ServiceHealth> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseTimeMs = Date.now() - startTime;

    return {
      name,
      status: response.ok ? 'healthy' : 'degraded',
      responseTimeMs,
      lastCheck: new Date(),
      details: { statusCode: response.status },
    };
  } catch (error) {
    return {
      name,
      status: 'unhealthy',
      responseTimeMs: Date.now() - startTime,
      lastCheck: new Date(),
      message: (error as Error).message,
    };
  }
}

/**
 * Get system metrics
 */
function getSystemMetrics(): SystemHealth['system'] {
  const cpus = os.cpus();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();

  // Calculate CPU usage
  let totalIdle = 0;
  let totalTick = 0;

  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  }

  const cpuUsage = ((1 - totalIdle / totalTick) * 100);

  return {
    cpuUsage: Math.round(cpuUsage * 100) / 100,
    memoryUsage: Math.round(((totalMemory - freeMemory) / totalMemory) * 100 * 100) / 100,
    memoryTotal: totalMemory,
    memoryFree: freeMemory,
    loadAverage: os.loadavg(),
  };
}

/**
 * Get full system health
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const services: ServiceHealth[] = [];

  // Check all services in parallel
  const [dbHealth, redisHealth] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  services.push(dbHealth, redisHealth);

  // Check external APIs if configured
  if (process.env.GOOGLE_MAPS_API_KEY) {
    const mapsHealth = await checkExternalAPI('google_maps', 'https://maps.googleapis.com/maps/api/js');
    services.push(mapsHealth);
  }

  // Determine overall status
  const hasUnhealthy = services.some((s) => s.status === 'unhealthy');
  const hasDegraded = services.some((s) => s.status === 'degraded');

  const status: HealthStatus = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

  return {
    status,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date(),
    version: process.env.APP_VERSION || '1.0.0',
    services,
    system: getSystemMetrics(),
  };
}

/**
 * Quick health check (for load balancers)
 */
export async function quickHealthCheck(): Promise<{ status: 'ok' | 'error'; message?: string }> {
  try {
    const { error } = await supabaseAdmin.from('users').select('count').limit(1);

    if (error) {
      return { status: 'error', message: 'Database unavailable' };
    }

    return { status: 'ok' };
  } catch (error) {
    return { status: 'error', message: (error as Error).message };
  }
}

/**
 * Readiness check (for Kubernetes)
 */
export async function readinessCheck(): Promise<{ ready: boolean; checks: Record<string, boolean> }> {
  const checks: Record<string, boolean> = {};

  // Database check
  try {
    const { error } = await supabaseAdmin.from('users').select('count').limit(1);
    checks.database = !error;
  } catch {
    checks.database = false;
  }

  // Check if all required environment variables are set
  checks.config = Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_KEY
  );

  return {
    ready: Object.values(checks).every((v) => v),
    checks,
  };
}

/**
 * Liveness check (for Kubernetes)
 */
export function livenessCheck(): { alive: boolean; uptime: number } {
  return {
    alive: true,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };
}

// ============================================
// METRICS COLLECTION
// ============================================

/**
 * Record a metric
 */
export function recordMetric(
  name: string,
  value: number,
  unit?: string,
  tags?: Record<string, string>
): void {
  metricsBuffer.push({
    name,
    value,
    unit,
    tags,
    timestamp: new Date(),
  });

  // Flush if buffer is full
  if (metricsBuffer.length >= MAX_BUFFER_SIZE) {
    flushMetrics().catch((err) => logger.error('Failed to flush metrics', { err }));
  }
}

/**
 * Record response time
 */
export function recordResponseTime(endpoint: string, method: string, durationMs: number): void {
  recordMetric('response_time', durationMs, 'ms', { endpoint, method });
}

/**
 * Record error
 */
export function recordError(endpoint: string, errorType: string): void {
  recordMetric('error', 1, 'count', { endpoint, error_type: errorType });
}

/**
 * Record request
 */
export function recordRequest(endpoint: string, method: string, statusCode: number): void {
  recordMetric('request', 1, 'count', { endpoint, method, status: String(statusCode) });
}

/**
 * Flush metrics to database
 */
async function flushMetrics(): Promise<void> {
  if (metricsBuffer.length === 0) return;

  const metrics = metricsBuffer.splice(0, metricsBuffer.length);

  try {
    await supabaseAdmin.from('system_metrics').insert(
      metrics.map((m) => ({
        metric_name: m.name,
        metric_value: m.value,
        unit: m.unit,
        tags: m.tags,
        recorded_at: m.timestamp.toISOString(),
      }))
    );
  } catch (error) {
    logger.error('Failed to flush metrics', { error, count: metrics.length });
    // Re-add to buffer on failure (with limit)
    if (metricsBuffer.length < MAX_BUFFER_SIZE / 2) {
      metricsBuffer.unshift(...metrics);
    }
  }
}

// Periodic flush
setInterval(flushMetrics, METRICS_FLUSH_INTERVAL);

// ============================================
// ALERTING
// ============================================

/**
 * Check thresholds and trigger alerts
 */
export async function checkAlerts(thresholds: AlertThreshold[] = DEFAULT_THRESHOLDS): Promise<{
  alerts: Array<{ metric: string; severity: string; message: string; value: number }>;
}> {
  const alerts: Array<{ metric: string; severity: string; message: string; value: number }> = [];
  const system = getSystemMetrics();

  const currentValues: Record<string, number> = {
    cpu_usage: system.cpuUsage,
    memory_usage: system.memoryUsage,
  };

  // Get database response time
  const dbHealth = await checkDatabase();
  if (dbHealth.responseTimeMs) {
    currentValues.db_response_time = dbHealth.responseTimeMs;
  }

  // Calculate error rate from recent metrics
  const { data: recentErrors } = await supabaseAdmin
    .from('system_metrics')
    .select('metric_value')
    .eq('metric_name', 'error')
    .gte('recorded_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

  const { data: recentRequests } = await supabaseAdmin
    .from('system_metrics')
    .select('metric_value')
    .eq('metric_name', 'request')
    .gte('recorded_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

  const errorCount = (recentErrors || []).reduce((sum, e) => sum + e.metric_value, 0);
  const requestCount = (recentRequests || []).reduce((sum, r) => sum + r.metric_value, 0);

  if (requestCount > 0) {
    currentValues.error_rate = (errorCount / requestCount) * 100;
  }

  // Check thresholds
  for (const threshold of thresholds) {
    const value = currentValues[threshold.metric];

    if (value === undefined) continue;

    let triggered = false;

    switch (threshold.operator) {
      case 'gt':
        triggered = value > threshold.value;
        break;
      case 'lt':
        triggered = value < threshold.value;
        break;
      case 'eq':
        triggered = value === threshold.value;
        break;
      case 'gte':
        triggered = value >= threshold.value;
        break;
      case 'lte':
        triggered = value <= threshold.value;
        break;
    }

    if (triggered) {
      alerts.push({
        metric: threshold.metric,
        severity: threshold.severity,
        message: threshold.message,
        value,
      });
    }
  }

  // Log alerts
  if (alerts.length > 0) {
    for (const alert of alerts) {
      if (alert.severity === 'critical') {
        logger.error('Critical alert triggered', alert);
      } else {
        logger.warn('Warning alert triggered', alert);
      }

      // Store alert in database
      await supabaseAdmin.from('security_events').insert({
        event_type: 'system_alert',
        severity: alert.severity === 'critical' ? 'high' : 'medium',
        description: alert.message,
        details: { metric: alert.metric, value: alert.value, threshold: alert },
      });
    }
  }

  return { alerts };
}

// ============================================
// HEALTH CHECK HISTORY
// ============================================

/**
 * Log health check result
 */
export async function logHealthCheck(health: SystemHealth): Promise<void> {
  for (const service of health.services) {
    try {
      await supabaseAdmin.from('health_check_logs').insert({
        service_name: service.name,
        status: service.status,
        response_time_ms: service.responseTimeMs,
        details: service.details,
        error_message: service.message,
        checked_at: service.lastCheck.toISOString(),
      });
    } catch (error) {
      logger.warn('Failed to log health check', { service: service.name, error });
    }
  }
}

/**
 * Get health check history
 */
export async function getHealthCheckHistory(
  serviceName: string,
  hours: number = 24
): Promise<Array<{ status: string; responseTimeMs?: number; checkedAt: Date }>> {
  const { data } = await supabaseAdmin
    .from('health_check_logs')
    .select('status, response_time_ms, checked_at')
    .eq('service_name', serviceName)
    .gte('checked_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
    .order('checked_at', { ascending: false });

  return (data || []).map((h) => ({
    status: h.status,
    responseTimeMs: h.response_time_ms,
    checkedAt: new Date(h.checked_at),
  }));
}

/**
 * Calculate uptime percentage
 */
export async function calculateUptime(serviceName: string, days: number = 30): Promise<number> {
  const { data, count } = await supabaseAdmin
    .from('health_check_logs')
    .select('status', { count: 'exact' })
    .eq('service_name', serviceName)
    .gte('checked_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

  if (!data || !count || count === 0) {
    return 100;
  }

  const healthyCount = data.filter((h) => h.status === 'healthy').length;
  return Math.round((healthyCount / count) * 100 * 100) / 100;
}

// ============================================
// METRICS AGGREGATION
// ============================================

/**
 * Get metrics summary for dashboard
 */
export async function getMetricsSummary(
  metricName: string,
  hours: number = 24
): Promise<{
  min: number;
  max: number;
  avg: number;
  count: number;
  latest: number;
}> {
  const { data } = await supabaseAdmin
    .from('system_metrics')
    .select('metric_value')
    .eq('metric_name', metricName)
    .gte('recorded_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
    .order('recorded_at', { ascending: false });

  if (!data || data.length === 0) {
    return { min: 0, max: 0, avg: 0, count: 0, latest: 0 };
  }

  const values = data.map((d) => d.metric_value);

  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    count: values.length,
    latest: values[0],
  };
}

/**
 * Get request rate per minute
 */
export async function getRequestRate(): Promise<number> {
  const { data } = await supabaseAdmin
    .from('system_metrics')
    .select('metric_value')
    .eq('metric_name', 'request')
    .gte('recorded_at', new Date(Date.now() - 60 * 1000).toISOString());

  if (!data) return 0;

  return data.reduce((sum, d) => sum + d.metric_value, 0);
}

/**
 * Get error rate per minute
 */
export async function getErrorRate(): Promise<number> {
  const { data: errors } = await supabaseAdmin
    .from('system_metrics')
    .select('metric_value')
    .eq('metric_name', 'error')
    .gte('recorded_at', new Date(Date.now() - 60 * 1000).toISOString());

  const { data: requests } = await supabaseAdmin
    .from('system_metrics')
    .select('metric_value')
    .eq('metric_name', 'request')
    .gte('recorded_at', new Date(Date.now() - 60 * 1000).toISOString());

  const errorCount = (errors || []).reduce((sum, d) => sum + d.metric_value, 0);
  const requestCount = (requests || []).reduce((sum, d) => sum + d.metric_value, 0);

  if (requestCount === 0) return 0;

  return Math.round((errorCount / requestCount) * 100 * 100) / 100;
}

// ============================================
// EXPRESS MIDDLEWARE
// ============================================

import { Request, Response, NextFunction } from 'express';

/**
 * Metrics middleware
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const endpoint = req.route?.path || req.path;

    recordResponseTime(endpoint, req.method, duration);
    recordRequest(endpoint, req.method, res.statusCode);

    if (res.statusCode >= 400) {
      recordError(endpoint, res.statusCode >= 500 ? 'server_error' : 'client_error');
    }
  });

  next();
}

/**
 * Health check endpoint handler
 */
export async function healthEndpoint(req: Request, res: Response): Promise<void> {
  const type = req.query.type as string;

  switch (type) {
    case 'quick':
      const quick = await quickHealthCheck();
      res.status(quick.status === 'ok' ? 200 : 503).json(quick);
      break;

    case 'ready':
      const ready = await readinessCheck();
      res.status(ready.ready ? 200 : 503).json(ready);
      break;

    case 'live':
      const live = livenessCheck();
      res.status(200).json(live);
      break;

    default:
      const health = await getSystemHealth();
      await logHealthCheck(health);
      res.status(health.status === 'unhealthy' ? 503 : 200).json(health);
  }
}

// ============================================
// BACKGROUND HEALTH CHECKER
// ============================================

let healthCheckInterval: NodeJS.Timeout | null = null;

/**
 * Start background health checker
 */
export function startHealthChecker(intervalMs: number = 60000): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }

  healthCheckInterval = setInterval(async () => {
    try {
      const health = await getSystemHealth();
      await logHealthCheck(health);

      // Check alerts
      await checkAlerts();

      if (health.status !== 'healthy') {
        logger.warn('System health degraded', { status: health.status });
      }
    } catch (error) {
      logger.error('Health check failed', { error });
    }
  }, intervalMs);

  logger.info('Health checker started', { intervalMs });
}

/**
 * Stop background health checker
 */
export function stopHealthChecker(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    logger.info('Health checker stopped');
  }
}

export type { HealthStatus, ServiceHealth, SystemHealth, AlertThreshold };
