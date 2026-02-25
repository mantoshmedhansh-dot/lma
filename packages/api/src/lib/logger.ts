/**
 * Structured Logger for LMA API
 * Provides consistent logging format for production monitoring
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  requestId?: string;
  userId?: string;
  merchantId?: string;
  orderId?: string;
  action?: string;
  duration?: number;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  environment: string;
  version: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

class Logger {
  private service: string;
  private environment: string;
  private version: string;
  private minLevel: LogLevel;

  constructor() {
    this.service = 'lma-api';
    this.environment = process.env.NODE_ENV || 'development';
    this.version = process.env.npm_package_version || '0.1.0';
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || (this.environment === 'production' ? 'info' : 'debug');
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private formatEntry(level: LogLevel, message: string, context?: LogContext, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      environment: this.environment,
      version: this.version,
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: this.environment !== 'production' ? error.stack : undefined,
      };
    }

    return entry;
  }

  private output(entry: LogEntry): void {
    const output = JSON.stringify(entry);

    switch (entry.level) {
      case 'error':
      case 'fatal':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      this.output(this.formatEntry('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      this.output(this.formatEntry('info', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      this.output(this.formatEntry('warn', message, context));
    }
  }

  error(message: string, errorOrContext?: Error | LogContext, context?: LogContext): void {
    if (this.shouldLog('error')) {
      if (errorOrContext instanceof Error) {
        this.output(this.formatEntry('error', message, context, errorOrContext));
      } else {
        this.output(this.formatEntry('error', message, errorOrContext));
      }
    }
  }

  fatal(message: string, errorOrContext?: Error | LogContext, context?: LogContext): void {
    if (this.shouldLog('fatal')) {
      if (errorOrContext instanceof Error) {
        this.output(this.formatEntry('fatal', message, context, errorOrContext));
      } else {
        this.output(this.formatEntry('fatal', message, errorOrContext));
      }
    }
  }

  // Request logging helper
  request(method: string, path: string, statusCode: number, duration: number, context?: LogContext): void {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    this.output(
      this.formatEntry(level, `${method} ${path} ${statusCode}`, {
        ...context,
        method,
        path,
        statusCode,
        duration,
      })
    );
  }

  // Audit logging for sensitive operations
  audit(action: string, context: LogContext): void {
    this.output(
      this.formatEntry('info', `AUDIT: ${action}`, {
        ...context,
        action,
        audit: true,
      })
    );
  }

  // Create child logger with preset context
  child(baseContext: LogContext): ChildLogger {
    return new ChildLogger(this, baseContext);
  }
}

class ChildLogger {
  private parent: Logger;
  private baseContext: LogContext;

  constructor(parent: Logger, baseContext: LogContext) {
    this.parent = parent;
    this.baseContext = baseContext;
  }

  private mergeContext(context?: LogContext): LogContext {
    return { ...this.baseContext, ...context };
  }

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, this.mergeContext(context));
  }

  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, this.mergeContext(context));
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.parent.error(message, error, this.mergeContext(context));
  }

  fatal(message: string, error?: Error, context?: LogContext): void {
    this.parent.fatal(message, error, this.mergeContext(context));
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for type usage
export type { ChildLogger };
