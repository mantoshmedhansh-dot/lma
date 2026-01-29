/**
 * Notifications & Communications API Routes
 *
 * Endpoints for:
 * - Notification preferences
 * - In-app notifications
 * - Order tracking
 * - Ratings and feedback
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';
import {
  // Notification service
  sendNotification,
  sendBulkNotification,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  getInAppNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  // Templates
  getTemplate,
  saveTemplate,
  getAllTemplates,
  previewTemplate,
  validateTemplate,
  // Order tracking
  getOrderTracking,
  getLiveTrackingUpdate,
  updateDriverLocation,
  updateOrderStatus,
  generateTrackingLink,
  getOrderFromTrackingToken,
  getDriverRoute,
  // Ratings
  submitOrderRating,
  getOrderRating,
  getDriverRatingStats,
  getMerchantRatingStats,
  getDriverRecentRatings,
  getMerchantRecentRatings,
  requestFeedback,
  reportIssue,
  getIssueCategories,
  getFeedbackSummary,
} from '../services/notifications/index.js';

const router = Router();

// ============================================
// NOTIFICATION PREFERENCES
// ============================================

/**
 * Get user's notification preferences
 */
router.get('/preferences', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const preferences = await getUserNotificationPreferences(userId);
    return res.json(preferences);
  } catch (error) {
    logger.error('Failed to get notification preferences', { error });
    return res.status(500).json({ error: 'Failed to get preferences' });
  }
});

/**
 * Update user's notification preferences
 */
router.put('/preferences', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const preferences = req.body;

    await updateUserNotificationPreferences(userId, preferences);

    return res.json({ success: true });
  } catch (error) {
    logger.error('Failed to update notification preferences', { error });
    return res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// ============================================
// IN-APP NOTIFICATIONS
// ============================================

/**
 * Get user's in-app notifications
 */
router.get('/inbox', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const unreadOnly = req.query.unreadOnly === 'true';

    const notifications = await getInAppNotifications(userId, { limit, unreadOnly });

    return res.json(notifications);
  } catch (error) {
    logger.error('Failed to get notifications', { error });
    return res.status(500).json({ error: 'Failed to get notifications' });
  }
});

/**
 * Mark notification as read
 */
router.post('/inbox/:notificationId/read', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { notificationId } = req.params;

    await markNotificationAsRead(notificationId, userId);

    return res.json({ success: true });
  } catch (error) {
    logger.error('Failed to mark notification as read', { error });
    return res.status(500).json({ error: 'Failed to mark as read' });
  }
});

/**
 * Mark all notifications as read
 */
router.post('/inbox/read-all', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const count = await markAllNotificationsAsRead(userId);
    return res.json({ success: true, count });
  } catch (error) {
    logger.error('Failed to mark all as read', { error });
    return res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// ============================================
// SEND NOTIFICATIONS (Admin)
// ============================================

/**
 * Send notification to user(s)
 */
router.post('/send', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { recipients, payload } = req.body;

    if (!recipients || !payload) {
      return res.status(400).json({ error: 'Recipients and payload are required' });
    }

    let results;
    if (Array.isArray(recipients)) {
      results = await sendBulkNotification(recipients, payload);
    } else {
      results = await sendNotification(recipients, payload);
    }

    return res.json(results);
  } catch (error) {
    logger.error('Failed to send notification', { error });
    return res.status(500).json({ error: 'Failed to send notification' });
  }
});

// ============================================
// NOTIFICATION TEMPLATES
// ============================================

/**
 * Get all templates
 */
router.get('/templates', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const type = req.query.type as string | undefined;
    const channel = req.query.channel as string | undefined;
    const language = req.query.language as string | undefined;

    const templates = await getAllTemplates({
      type: type as any,
      channel: channel as any,
      language: language as any,
    });

    return res.json(templates);
  } catch (error) {
    logger.error('Failed to get templates', { error });
    return res.status(500).json({ error: 'Failed to get templates' });
  }
});

/**
 * Create/update template
 */
router.post('/templates', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { type, channel, language, title, body, isActive } = req.body;

    // Validate template
    const validation = validateTemplate(title, body);
    if (!validation.valid) {
      return res.status(400).json({ errors: validation.errors, warnings: validation.warnings });
    }

    const template = await saveTemplate({
      type,
      channel: channel || 'all',
      language: language || 'en',
      title,
      body,
      variables: [],
      isActive: isActive !== false,
    });

    return res.status(201).json(template);
  } catch (error) {
    logger.error('Failed to save template', { error });
    return res.status(500).json({ error: 'Failed to save template' });
  }
});

/**
 * Preview template
 */
router.post('/templates/preview', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { type, channel, language, variables } = req.body;

    const preview = await previewTemplate(
      type,
      channel || 'push',
      language || 'en',
      variables
    );

    if (!preview) {
      return res.status(404).json({ error: 'Template not found' });
    }

    return res.json(preview);
  } catch (error) {
    logger.error('Failed to preview template', { error });
    return res.status(500).json({ error: 'Failed to preview template' });
  }
});

// ============================================
// ORDER TRACKING
// ============================================

/**
 * Get order tracking details
 */
router.get('/tracking/:orderId', authenticate, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const tracking = await getOrderTracking(orderId);

    if (!tracking) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.json(tracking);
  } catch (error) {
    logger.error('Failed to get tracking', { error, orderId: req.params.orderId });
    return res.status(500).json({ error: 'Failed to get tracking' });
  }
});

/**
 * Get live tracking update
 */
router.get('/tracking/:orderId/live', authenticate, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const update = await getLiveTrackingUpdate(orderId);

    if (!update) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.json(update);
  } catch (error) {
    logger.error('Failed to get live tracking', { error, orderId: req.params.orderId });
    return res.status(500).json({ error: 'Failed to get live tracking' });
  }
});

/**
 * Get tracking by token (public)
 */
router.get('/track/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const orderId = await getOrderFromTrackingToken(token);

    if (!orderId) {
      return res.status(404).json({ error: 'Invalid or expired tracking link' });
    }

    const tracking = await getLiveTrackingUpdate(orderId);
    return res.json(tracking);
  } catch (error) {
    logger.error('Failed to get tracking by token', { error });
    return res.status(500).json({ error: 'Failed to get tracking' });
  }
});

/**
 * Generate shareable tracking link
 */
router.post('/tracking/:orderId/share', authenticate, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const link = await generateTrackingLink(orderId);
    return res.json({ link });
  } catch (error) {
    logger.error('Failed to generate tracking link', { error });
    return res.status(500).json({ error: 'Failed to generate link' });
  }
});

/**
 * Update driver location
 */
router.post('/tracking/driver/location', authenticate, requireRole(['driver']), async (req: Request, res: Response) => {
  try {
    const driverId = req.user!.driverId;
    const { latitude, longitude } = req.body;

    if (!driverId) {
      return res.status(400).json({ error: 'Driver ID required' });
    }

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    await updateDriverLocation(driverId, { latitude, longitude });

    return res.json({ success: true });
  } catch (error) {
    logger.error('Failed to update driver location', { error });
    return res.status(500).json({ error: 'Failed to update location' });
  }
});

/**
 * Get driver's current route
 */
router.get('/tracking/driver/route', authenticate, requireRole(['driver']), async (req: Request, res: Response) => {
  try {
    const driverId = req.user!.driverId;

    if (!driverId) {
      return res.status(400).json({ error: 'Driver ID required' });
    }

    const route = await getDriverRoute(driverId);
    return res.json(route);
  } catch (error) {
    logger.error('Failed to get driver route', { error });
    return res.status(500).json({ error: 'Failed to get route' });
  }
});

// ============================================
// RATINGS & FEEDBACK
// ============================================

/**
 * Submit order rating
 */
router.post('/ratings/order', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      orderId,
      overallRating,
      driverRating,
      merchantRating,
      dimensions,
      feedback,
      issues,
      tipAmount,
    } = req.body;

    if (!orderId || !overallRating) {
      return res.status(400).json({ error: 'Order ID and overall rating required' });
    }

    const result = await submitOrderRating({
      orderId,
      customerId: userId,
      overallRating,
      driverRating,
      merchantRating,
      dimensions,
      feedback,
      issues,
      tipAmount,
      createdAt: new Date(),
    });

    if (!result.success) {
      return res.status(400).json({ error: 'Failed to submit rating' });
    }

    return res.json(result);
  } catch (error) {
    logger.error('Failed to submit rating', { error });
    return res.status(500).json({ error: 'Failed to submit rating' });
  }
});

/**
 * Get order rating
 */
router.get('/ratings/order/:orderId', authenticate, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const rating = await getOrderRating(orderId);

    if (!rating) {
      return res.status(404).json({ error: 'Rating not found' });
    }

    return res.json(rating);
  } catch (error) {
    logger.error('Failed to get rating', { error });
    return res.status(500).json({ error: 'Failed to get rating' });
  }
});

/**
 * Get driver rating stats
 */
router.get('/ratings/driver/:driverId/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const { driverId } = req.params;
    const stats = await getDriverRatingStats(driverId);
    return res.json(stats);
  } catch (error) {
    logger.error('Failed to get driver rating stats', { error });
    return res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * Get merchant rating stats
 */
router.get('/ratings/merchant/:merchantId/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const stats = await getMerchantRatingStats(merchantId);
    return res.json(stats);
  } catch (error) {
    logger.error('Failed to get merchant rating stats', { error });
    return res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * Get recent driver ratings
 */
router.get('/ratings/driver/:driverId/recent', authenticate, async (req: Request, res: Response) => {
  try {
    const { driverId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const ratings = await getDriverRecentRatings(driverId, limit);
    return res.json(ratings);
  } catch (error) {
    logger.error('Failed to get recent ratings', { error });
    return res.status(500).json({ error: 'Failed to get ratings' });
  }
});

/**
 * Get recent merchant ratings
 */
router.get('/ratings/merchant/:merchantId/recent', authenticate, async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const ratings = await getMerchantRecentRatings(merchantId, limit);
    return res.json(ratings);
  } catch (error) {
    logger.error('Failed to get recent ratings', { error });
    return res.status(500).json({ error: 'Failed to get ratings' });
  }
});

/**
 * Request feedback for an order
 */
router.post('/ratings/request/:orderId', authenticate, requireRole(['admin', 'merchant']), async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    await requestFeedback(orderId);
    return res.json({ success: true });
  } catch (error) {
    logger.error('Failed to request feedback', { error });
    return res.status(500).json({ error: 'Failed to request feedback' });
  }
});

/**
 * Get issue categories
 */
router.get('/ratings/issues/categories', authenticate, async (req: Request, res: Response) => {
  try {
    const categories = getIssueCategories();
    return res.json(categories);
  } catch (error) {
    logger.error('Failed to get issue categories', { error });
    return res.status(500).json({ error: 'Failed to get categories' });
  }
});

/**
 * Report an issue
 */
router.post('/ratings/issues/report', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { orderId, issues, additionalDetails } = req.body;

    if (!orderId || !issues || issues.length === 0) {
      return res.status(400).json({ error: 'Order ID and issues required' });
    }

    const result = await reportIssue(orderId, userId, issues, additionalDetails);

    if (!result.success) {
      return res.status(400).json({ error: 'Failed to report issue' });
    }

    return res.json(result);
  } catch (error) {
    logger.error('Failed to report issue', { error });
    return res.status(500).json({ error: 'Failed to report issue' });
  }
});

/**
 * Get feedback summary (analytics)
 */
router.get('/ratings/summary', authenticate, requireRole(['admin', 'merchant']), async (req: Request, res: Response) => {
  try {
    const merchantId = req.query.merchantId as string | undefined;
    const driverId = req.query.driverId as string | undefined;
    const daysBack = parseInt(req.query.daysBack as string) || 30;

    const summary = await getFeedbackSummary({ merchantId, driverId, daysBack });
    return res.json(summary);
  } catch (error) {
    logger.error('Failed to get feedback summary', { error });
    return res.status(500).json({ error: 'Failed to get summary' });
  }
});

export default router;
