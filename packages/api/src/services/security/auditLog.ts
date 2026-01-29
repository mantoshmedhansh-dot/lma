/**
 * Audit Logging Service
 *
 * Comprehensive audit logging for:
 * - User authentication events
 * - Data access and modifications
 * - Admin actions
 * - Security events
 * - Compliance tracking
 */

import { supabaseAdmin } from '../../config/supabase.js';
import { logger } from '../../lib/logger.js';
import { Request } from 'express';
import crypto from 'crypto';

// Audit event types
type AuditEventType =
  // Authentication
  | 'auth.login'
  | 'auth.logout'
  | 'auth.login_failed'
  | 'auth.password_change'
  | 'auth.password_reset'
  | 'auth.mfa_enabled'
  | 'auth.mfa_disabled'
  | 'auth.token_refresh'
  | 'auth.session_expired'
  // User management
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.suspended'
  | 'user.activated'
  | 'user.role_changed'
  // Data access
  | 'data.viewed'
  | 'data.exported'
  | 'data.created'
  | 'data.updated'
  | 'data.deleted'
  // Order operations
  | 'order.created'
  | 'order.updated'
  | 'order.cancelled'
  | 'order.assigned'
  | 'order.completed'
  // Payment operations
  | 'payment.initiated'
  | 'payment.completed'
  | 'payment.failed'
  | 'payment.refunded'
  // Admin actions
  | 'admin.config_changed'
  | 'admin.user_impersonated'
  | 'admin.bulk_operation'
  | 'admin.report_generated'
  // Security events
  | 'security.suspicious_activity'
  | 'security.rate_limit_exceeded'
  | 'security.ip_blocked'
  | 'security.unauthorized_access'
  | 'security.permission_denied'
  // System events
  | 'system.startup'
  | 'system.shutdown'
  | 'system.error'
  | 'system.maintenance';

type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

interface AuditLogEntry {
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  targetUserId?: string;
  resourceType?: string;
  resourceId?: string;
  action: string;
  details?: Record<string, unknown>;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    sessionId?: string;
    geoLocation?: {
      country?: string;
      city?: string;
    };
  };
  previousValue?: unknown;
  newValue?: unknown;
}

interface AuditLogRecord extends AuditLogEntry {
  id: string;
  timestamp: Date;
  hash: string;
  previousHash?: string;
}

// In-memory buffer for batch inserts
const auditBuffer: AuditLogEntry[] = [];
const BUFFER_SIZE = 100;
const FLUSH_INTERVAL = 5000; // 5 seconds

// Previous hash for chain integrity
let lastHash: string | null = null;

/**
 * Log an audit event
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  // Add to buffer
  auditBuffer.push(entry);

  // Log immediately for critical events
  if (entry.severity === 'critical') {
    await flushAuditBuffer();
    return;
  }

  // Flush if buffer is full
  if (auditBuffer.length >= BUFFER_SIZE) {
    await flushAuditBuffer();
  }
}

/**
 * Flush audit buffer to database
 */
async function flushAuditBuffer(): Promise<void> {
  if (auditBuffer.length === 0) return;

  const entries = auditBuffer.splice(0, auditBuffer.length);
  const records: AuditLogRecord[] = [];

  for (const entry of entries) {
    const record = createAuditRecord(entry);
    records.push(record);
    lastHash = record.hash;
  }

  try {
    await supabaseAdmin.from('audit_logs').insert(
      records.map((r) => ({
        id: r.id,
        event_type: r.eventType,
        severity: r.severity,
        user_id: r.userId,
        target_user_id: r.targetUserId,
        resource_type: r.resourceType,
        resource_id: r.resourceId,
        action: r.action,
        details: r.details,
        metadata: r.metadata,
        previous_value: r.previousValue,
        new_value: r.newValue,
        hash: r.hash,
        previous_hash: r.previousHash,
        created_at: r.timestamp.toISOString(),
      }))
    );
  } catch (error) {
    logger.error('Failed to flush audit buffer', { error, count: entries.length });
    // Re-add to buffer on failure
    auditBuffer.unshift(...entries);
  }
}

/**
 * Create audit record with hash chain
 */
function createAuditRecord(entry: AuditLogEntry): AuditLogRecord {
  const id = generateAuditId();
  const timestamp = new Date();

  // Create hash for integrity verification
  const hashData = JSON.stringify({
    id,
    timestamp: timestamp.toISOString(),
    eventType: entry.eventType,
    userId: entry.userId,
    action: entry.action,
    previousHash: lastHash,
  });

  const hash = crypto.createHash('sha256').update(hashData).digest('hex');

  return {
    ...entry,
    id,
    timestamp,
    hash,
    previousHash: lastHash || undefined,
  };
}

/**
 * Generate unique audit ID
 */
function generateAuditId(): string {
  return `audit_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

// Start periodic flush
setInterval(flushAuditBuffer, FLUSH_INTERVAL);

/**
 * Log authentication event
 */
export async function logAuthEvent(
  type: 'login' | 'logout' | 'login_failed' | 'password_change' | 'password_reset',
  userId: string | undefined,
  req: Request,
  details?: Record<string, unknown>
): Promise<void> {
  const eventType: AuditEventType = `auth.${type}`;
  const severity: AuditSeverity = type === 'login_failed' ? 'warning' : 'info';

  await logAuditEvent({
    eventType,
    severity,
    userId,
    action: type.replace('_', ' '),
    details,
    metadata: extractRequestMetadata(req),
  });
}

/**
 * Log data access event
 */
export async function logDataAccess(
  action: 'viewed' | 'exported' | 'created' | 'updated' | 'deleted',
  userId: string,
  resourceType: string,
  resourceId: string,
  req: Request,
  details?: { previousValue?: unknown; newValue?: unknown }
): Promise<void> {
  await logAuditEvent({
    eventType: `data.${action}`,
    severity: action === 'deleted' ? 'warning' : 'info',
    userId,
    resourceType,
    resourceId,
    action: `${action} ${resourceType}`,
    metadata: extractRequestMetadata(req),
    previousValue: details?.previousValue,
    newValue: details?.newValue,
  });
}

/**
 * Log order event
 */
export async function logOrderEvent(
  action: 'created' | 'updated' | 'cancelled' | 'assigned' | 'completed',
  userId: string,
  orderId: string,
  details?: Record<string, unknown>
): Promise<void> {
  await logAuditEvent({
    eventType: `order.${action}`,
    severity: action === 'cancelled' ? 'warning' : 'info',
    userId,
    resourceType: 'order',
    resourceId: orderId,
    action: `order ${action}`,
    details,
  });
}

/**
 * Log payment event
 */
export async function logPaymentEvent(
  action: 'initiated' | 'completed' | 'failed' | 'refunded',
  userId: string,
  paymentId: string,
  amount: number,
  details?: Record<string, unknown>
): Promise<void> {
  await logAuditEvent({
    eventType: `payment.${action}`,
    severity: action === 'failed' ? 'warning' : 'info',
    userId,
    resourceType: 'payment',
    resourceId: paymentId,
    action: `payment ${action}`,
    details: { amount, ...details },
  });
}

/**
 * Log admin action
 */
export async function logAdminAction(
  action: 'config_changed' | 'user_impersonated' | 'bulk_operation' | 'report_generated',
  adminUserId: string,
  req: Request,
  details: Record<string, unknown>,
  targetUserId?: string
): Promise<void> {
  await logAuditEvent({
    eventType: `admin.${action}`,
    severity: action === 'user_impersonated' ? 'warning' : 'info',
    userId: adminUserId,
    targetUserId,
    action: action.replace('_', ' '),
    details,
    metadata: extractRequestMetadata(req),
  });
}

/**
 * Log security event
 */
export async function logSecurityEvent(
  type: 'suspicious_activity' | 'rate_limit_exceeded' | 'ip_blocked' | 'unauthorized_access' | 'permission_denied',
  req: Request,
  details: Record<string, unknown>
): Promise<void> {
  const severityMap: Record<string, AuditSeverity> = {
    suspicious_activity: 'warning',
    rate_limit_exceeded: 'warning',
    ip_blocked: 'warning',
    unauthorized_access: 'error',
    permission_denied: 'warning',
  };

  await logAuditEvent({
    eventType: `security.${type}`,
    severity: severityMap[type] || 'warning',
    userId: (req as any).user?.id,
    action: type.replace('_', ' '),
    details,
    metadata: extractRequestMetadata(req),
  });
}

/**
 * Log user management event
 */
export async function logUserEvent(
  action: 'created' | 'updated' | 'deleted' | 'suspended' | 'activated' | 'role_changed',
  adminUserId: string,
  targetUserId: string,
  details?: Record<string, unknown>
): Promise<void> {
  await logAuditEvent({
    eventType: `user.${action}`,
    severity: ['deleted', 'suspended'].includes(action) ? 'warning' : 'info',
    userId: adminUserId,
    targetUserId,
    resourceType: 'user',
    resourceId: targetUserId,
    action: `user ${action}`,
    details,
  });
}

/**
 * Extract metadata from request
 */
function extractRequestMetadata(req: Request): AuditLogEntry['metadata'] {
  return {
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'],
    requestId: (req as any).requestId,
    sessionId: (req as any).sessionId,
  };
}

/**
 * Get client IP
 */
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

/**
 * Query audit logs
 */
export async function queryAuditLogs(options: {
  userId?: string;
  eventType?: AuditEventType;
  resourceType?: string;
  resourceId?: string;
  severity?: AuditSeverity;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{
  logs: AuditLogRecord[];
  total: number;
}> {
  let query = supabaseAdmin
    .from('audit_logs')
    .select('*', { count: 'exact' });

  if (options.userId) {
    query = query.or(`user_id.eq.${options.userId},target_user_id.eq.${options.userId}`);
  }
  if (options.eventType) {
    query = query.eq('event_type', options.eventType);
  }
  if (options.resourceType) {
    query = query.eq('resource_type', options.resourceType);
  }
  if (options.resourceId) {
    query = query.eq('resource_id', options.resourceId);
  }
  if (options.severity) {
    query = query.eq('severity', options.severity);
  }
  if (options.startDate) {
    query = query.gte('created_at', options.startDate.toISOString());
  }
  if (options.endDate) {
    query = query.lte('created_at', options.endDate.toISOString());
  }

  query = query
    .order('created_at', { ascending: false })
    .range(options.offset || 0, (options.offset || 0) + (options.limit || 50) - 1);

  const { data, count, error } = await query;

  if (error) {
    logger.error('Failed to query audit logs', { error, options });
    throw error;
  }

  return {
    logs: (data || []).map(mapAuditRecord),
    total: count || 0,
  };
}

/**
 * Verify audit log integrity
 */
export async function verifyAuditLogIntegrity(
  startId?: string,
  limit: number = 1000
): Promise<{
  verified: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}> {
  let query = supabaseAdmin
    .from('audit_logs')
    .select('id, hash, previous_hash, event_type, user_id, action, created_at')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (startId) {
    query = query.gt('id', startId);
  }

  const { data, error } = await query;

  if (error || !data) {
    throw new Error('Failed to fetch audit logs for verification');
  }

  let verified = 0;
  let failed = 0;
  const errors: Array<{ id: string; error: string }> = [];
  let previousHash: string | null = null;

  for (const record of data) {
    // Verify chain integrity
    if (previousHash && record.previous_hash !== previousHash) {
      failed++;
      errors.push({ id: record.id, error: 'Chain broken - previous hash mismatch' });
    } else {
      // Verify hash
      const expectedHashData = JSON.stringify({
        id: record.id,
        timestamp: record.created_at,
        eventType: record.event_type,
        userId: record.user_id,
        action: record.action,
        previousHash: record.previous_hash,
      });

      const expectedHash = crypto.createHash('sha256').update(expectedHashData).digest('hex');

      if (record.hash !== expectedHash) {
        failed++;
        errors.push({ id: record.id, error: 'Hash mismatch - data may have been tampered' });
      } else {
        verified++;
      }
    }

    previousHash = record.hash;
  }

  return { verified, failed, errors };
}

/**
 * Get audit summary for compliance reports
 */
export async function getAuditSummary(
  startDate: Date,
  endDate: Date
): Promise<{
  totalEvents: number;
  byEventType: Record<string, number>;
  bySeverity: Record<string, number>;
  topUsers: Array<{ userId: string; count: number }>;
  securityEvents: number;
}> {
  const { data, count } = await supabaseAdmin
    .from('audit_logs')
    .select('event_type, severity, user_id', { count: 'exact' })
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  const byEventType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const userCounts: Record<string, number> = {};
  let securityEvents = 0;

  for (const record of data || []) {
    byEventType[record.event_type] = (byEventType[record.event_type] || 0) + 1;
    bySeverity[record.severity] = (bySeverity[record.severity] || 0) + 1;

    if (record.user_id) {
      userCounts[record.user_id] = (userCounts[record.user_id] || 0) + 1;
    }

    if (record.event_type.startsWith('security.')) {
      securityEvents++;
    }
  }

  const topUsers = Object.entries(userCounts)
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalEvents: count || 0,
    byEventType,
    bySeverity,
    topUsers,
    securityEvents,
  };
}

/**
 * Map database record to AuditLogRecord
 */
function mapAuditRecord(data: Record<string, unknown>): AuditLogRecord {
  return {
    id: data.id as string,
    eventType: data.event_type as AuditEventType,
    severity: data.severity as AuditSeverity,
    userId: data.user_id as string | undefined,
    targetUserId: data.target_user_id as string | undefined,
    resourceType: data.resource_type as string | undefined,
    resourceId: data.resource_id as string | undefined,
    action: data.action as string,
    details: data.details as Record<string, unknown> | undefined,
    metadata: data.metadata as AuditLogEntry['metadata'],
    previousValue: data.previous_value,
    newValue: data.new_value,
    timestamp: new Date(data.created_at as string),
    hash: data.hash as string,
    previousHash: data.previous_hash as string | undefined,
  };
}

export type { AuditEventType, AuditSeverity, AuditLogEntry, AuditLogRecord };
