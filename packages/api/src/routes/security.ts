/**
 * Security & Compliance API Routes
 *
 * Endpoints for:
 * - Audit logs
 * - Data export requests (GDPR)
 * - Data deletion requests (GDPR)
 * - Consent management
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';
import {
  queryAuditLogs,
  verifyAuditLogIntegrity,
  getAuditSummary,
  logDataAccess,
} from '../services/security/auditLog.js';
import {
  processDataExportRequest,
  processDataDeletionRequest,
  getConsentRecord,
  recordConsent,
  applyRetentionPolicies,
  maskEmail,
  maskPhone,
} from '../services/security/encryption.js';

const router = Router();

// ============================================
// AUDIT LOGS
// ============================================

/**
 * Query audit logs
 */
router.get('/audit-logs', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const {
      userId,
      eventType,
      resourceType,
      resourceId,
      severity,
      startDate,
      endDate,
      limit,
      offset,
    } = req.query;

    const result = await queryAuditLogs({
      userId: userId as string | undefined,
      eventType: eventType as any,
      resourceType: resourceType as string | undefined,
      resourceId: resourceId as string | undefined,
      severity: severity as any,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    // Log this data access
    await logDataAccess(
      'viewed',
      req.user!.id,
      'audit_logs',
      'query',
      req,
      { query: req.query }
    );

    return res.json(result);
  } catch (error) {
    logger.error('Failed to query audit logs', { error });
    return res.status(500).json({ error: 'Failed to query audit logs' });
  }
});

/**
 * Verify audit log integrity
 */
router.post('/audit-logs/verify', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { startId, limit } = req.body;

    const result = await verifyAuditLogIntegrity(startId, limit || 1000);

    return res.json({
      ...result,
      integrity: result.failed === 0 ? 'valid' : 'compromised',
    });
  } catch (error) {
    logger.error('Failed to verify audit log integrity', { error });
    return res.status(500).json({ error: 'Failed to verify integrity' });
  }
});

/**
 * Get audit summary
 */
router.get('/audit-logs/summary', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const daysBack = parseInt(req.query.daysBack as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const summary = await getAuditSummary(startDate, new Date());
    return res.json(summary);
  } catch (error) {
    logger.error('Failed to get audit summary', { error });
    return res.status(500).json({ error: 'Failed to get summary' });
  }
});

// ============================================
// GDPR DATA REQUESTS
// ============================================

/**
 * Request data export (GDPR - Right to data portability)
 */
router.post('/data-export', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { format, includeOrderHistory, includePayments, includeLocations } = req.body;

    const result = await processDataExportRequest({
      userId,
      requestedAt: new Date(),
      format: format || 'json',
      includeOrderHistory: includeOrderHistory !== false,
      includePayments: includePayments !== false,
      includeLocations: includeLocations !== false,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({
      success: true,
      data: result.data,
      message: 'Your data export is ready',
    });
  } catch (error) {
    logger.error('Failed to process data export', { error });
    return res.status(500).json({ error: 'Failed to export data' });
  }
});

/**
 * Request data deletion (GDPR - Right to erasure)
 */
router.post('/data-deletion', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { reason, retainAnonymized } = req.body;

    // This is a serious operation - log it
    logger.warn('Data deletion request initiated', { userId, reason });

    const result = await processDataDeletionRequest({
      userId,
      requestedAt: new Date(),
      reason,
      retainAnonymized: retainAnonymized !== false, // Default to true for legal compliance
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({
      success: true,
      deletedItems: result.deletedItems,
      message: 'Your data has been deleted/anonymized',
    });
  } catch (error) {
    logger.error('Failed to process data deletion', { error });
    return res.status(500).json({ error: 'Failed to delete data' });
  }
});

/**
 * Admin: Process data deletion for a user
 */
router.post('/data-deletion/:userId', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason, retainAnonymized } = req.body;

    logger.warn('Admin data deletion request', {
      adminId: req.user!.id,
      targetUserId: userId,
      reason,
    });

    const result = await processDataDeletionRequest({
      userId,
      requestedAt: new Date(),
      reason,
      retainAnonymized: retainAnonymized !== false,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({
      success: true,
      deletedItems: result.deletedItems,
    });
  } catch (error) {
    logger.error('Failed to process admin data deletion', { error });
    return res.status(500).json({ error: 'Failed to delete data' });
  }
});

// ============================================
// CONSENT MANAGEMENT
// ============================================

/**
 * Get user's consent records
 */
router.get('/consents', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const record = await getConsentRecord(userId);
    return res.json(record);
  } catch (error) {
    logger.error('Failed to get consent record', { error });
    return res.status(500).json({ error: 'Failed to get consents' });
  }
});

/**
 * Update consent
 */
router.post('/consents', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { consentType, granted } = req.body;

    if (!consentType || typeof granted !== 'boolean') {
      return res.status(400).json({ error: 'Consent type and granted status required' });
    }

    await recordConsent(userId, consentType, granted, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.json({ success: true });
  } catch (error) {
    logger.error('Failed to update consent', { error });
    return res.status(500).json({ error: 'Failed to update consent' });
  }
});

/**
 * Get consent types
 */
router.get('/consent-types', authenticate, (req: Request, res: Response) => {
  return res.json({
    types: [
      {
        id: 'marketing',
        name: 'Marketing Communications',
        description: 'Receive promotional offers, discounts, and news about our services',
        required: false,
      },
      {
        id: 'analytics',
        name: 'Analytics',
        description: 'Allow us to analyze your usage to improve our services',
        required: false,
      },
      {
        id: 'location',
        name: 'Location Tracking',
        description: 'Allow location tracking for better delivery experience',
        required: false,
      },
      {
        id: 'terms',
        name: 'Terms of Service',
        description: 'Agreement to our terms of service',
        required: true,
      },
      {
        id: 'privacy',
        name: 'Privacy Policy',
        description: 'Acknowledgement of our privacy policy',
        required: true,
      },
    ],
  });
});

// ============================================
// DATA RETENTION
// ============================================

/**
 * Apply retention policies (admin only, typically run as cron job)
 */
router.post('/retention/apply', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const result = await applyRetentionPolicies();

    logger.info('Retention policies applied', { result });

    return res.json({
      success: true,
      processed: result.processed,
    });
  } catch (error) {
    logger.error('Failed to apply retention policies', { error });
    return res.status(500).json({ error: 'Failed to apply retention policies' });
  }
});

// ============================================
// DATA MASKING PREVIEW
// ============================================

/**
 * Preview masked data
 */
router.post('/mask-preview', authenticate, async (req: Request, res: Response) => {
  try {
    const { email, phone } = req.body;

    return res.json({
      email: email ? maskEmail(email) : undefined,
      phone: phone ? maskPhone(phone) : undefined,
    });
  } catch (error) {
    logger.error('Failed to mask data', { error });
    return res.status(500).json({ error: 'Failed to mask data' });
  }
});

export default router;
