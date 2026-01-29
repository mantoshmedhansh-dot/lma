import { supabaseAdmin } from '../config/supabase.js';

/**
 * Health check status
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: ServiceStatus;
    cache?: ServiceStatus;
    external?: Record<string, ServiceStatus>;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  latency?: {
    database: number;
  };
}

export interface ServiceStatus {
  status: 'healthy' | 'unhealthy';
  latency?: number;
  message?: string;
}

/**
 * Perform comprehensive health check
 */
export async function performHealthCheck(): Promise<HealthStatus> {
  const startTime = Date.now();
  const services: HealthStatus['services'] = {
    database: { status: 'unhealthy' },
  };
  const latency: HealthStatus['latency'] = {
    database: 0,
  };

  // Check database
  const dbStart = Date.now();
  try {
    const { error } = await supabaseAdmin.from('users').select('count').limit(1);
    services.database = {
      status: error ? 'unhealthy' : 'healthy',
      latency: Date.now() - dbStart,
      message: error?.message,
    };
    latency.database = Date.now() - dbStart;
  } catch (err) {
    services.database = {
      status: 'unhealthy',
      latency: Date.now() - dbStart,
      message: err instanceof Error ? err.message : 'Database connection failed',
    };
  }

  // Memory usage
  const memUsage = process.memoryUsage();
  const memory = {
    used: Math.round(memUsage.heapUsed / 1024 / 1024),
    total: Math.round(memUsage.heapTotal / 1024 / 1024),
    percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
  };

  // Determine overall status
  const allHealthy = Object.values(services).every((s) => s.status === 'healthy');
  const someHealthy = Object.values(services).some((s) => s.status === 'healthy');

  return {
    status: allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '0.1.0',
    services,
    memory,
    latency,
  };
}

/**
 * Metrics collector
 */
export class MetricsCollector {
  private requestCount = 0;
  private errorCount = 0;
  private requestDurations: number[] = [];
  private readonly maxDurations = 1000;

  recordRequest(duration: number, isError: boolean) {
    this.requestCount++;
    if (isError) this.errorCount++;

    this.requestDurations.push(duration);
    if (this.requestDurations.length > this.maxDurations) {
      this.requestDurations.shift();
    }
  }

  getMetrics() {
    const durations = [...this.requestDurations];
    durations.sort((a, b) => a - b);

    return {
      requests: {
        total: this.requestCount,
        errors: this.errorCount,
        errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0,
      },
      latency: {
        avg: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
        p50: this.percentile(durations, 50),
        p95: this.percentile(durations, 95),
        p99: this.percentile(durations, 99),
      },
    };
  }

  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, index)];
  }

  reset() {
    this.requestCount = 0;
    this.errorCount = 0;
    this.requestDurations = [];
  }
}

// Global metrics collector instance
export const metrics = new MetricsCollector();

/**
 * Request timing middleware factory
 */
export function createTimingMiddleware() {
  return (req: { startTime?: number }, res: { on: (event: string, callback: () => void) => void; statusCode: number }, next: () => void) => {
    req.startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - (req.startTime || Date.now());
      const isError = res.statusCode >= 400;
      metrics.recordRequest(duration, isError);
    });

    next();
  };
}
