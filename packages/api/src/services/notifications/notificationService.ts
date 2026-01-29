/**
 * Unified Notification Service
 *
 * Orchestrates notifications across all channels:
 * - Push notifications (mobile/web)
 * - SMS
 * - Email
 * - In-app notifications
 *
 * Features:
 * - Channel selection based on preferences
 * - Retry logic
 * - Rate limiting
 * - Template support
 * - Delivery tracking
 */

import { supabaseAdmin } from '../../config/supabase.js';
import { logger } from '../../lib/logger.js';
import { pushChannel, PushNotificationPayload } from './channels/push.js';
import { smsChannel, SMSPayload } from './channels/sms.js';
import { emailChannel, EmailPayload } from './channels/email.js';

// Notification types
type NotificationType =
  | 'order_placed'
  | 'order_confirmed'
  | 'order_preparing'
  | 'order_ready'
  | 'driver_assigned'
  | 'order_picked_up'
  | 'order_in_transit'
  | 'order_delivered'
  | 'order_cancelled'
  | 'driver_nearby'
  | 'payment_received'
  | 'payment_failed'
  | 'promo_offer'
  | 'account_update'
  | 'password_reset'
  | 'otp'
  | 'feedback_request'
  | 'support_response'
  | 'driver_earnings'
  | 'merchant_order';

type NotificationChannel = 'push' | 'sms' | 'email' | 'in_app';

interface NotificationRecipient {
  userId: string;
  email?: string;
  phone?: string;
  deviceTokens?: Array<{
    token: string;
    platform: 'android' | 'ios' | 'web';
  }>;
  preferredChannels?: NotificationChannel[];
}

interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channels?: NotificationChannel[];
  priority?: 'low' | 'normal' | 'high';
  templateId?: string;
  templateData?: Record<string, unknown>;
  imageUrl?: string;
  actionUrl?: string;
  scheduledFor?: Date;
}

interface NotificationResult {
  notificationId: string;
  userId: string;
  channels: {
    [channel in NotificationChannel]?: {
      success: boolean;
      messageId?: string;
      error?: string;
    };
  };
  overallSuccess: boolean;
}

interface UserNotificationPreferences {
  userId: string;
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  quietHoursStart?: string; // HH:mm
  quietHoursEnd?: string;
  disabledTypes?: NotificationType[];
}

// Rate limiting configuration
const RATE_LIMITS: Record<NotificationChannel, { maxPerHour: number; maxPerDay: number }> = {
  push: { maxPerHour: 10, maxPerDay: 50 },
  sms: { maxPerHour: 5, maxPerDay: 20 },
  email: { maxPerHour: 10, maxPerDay: 30 },
  in_app: { maxPerHour: 20, maxPerDay: 100 },
};

/**
 * Send notification to a user
 */
export async function sendNotification(
  recipient: NotificationRecipient,
  payload: NotificationPayload
): Promise<NotificationResult> {
  const notificationId = generateNotificationId();
  const channels: NotificationResult['channels'] = {};

  // Get user preferences
  const preferences = await getUserNotificationPreferences(recipient.userId);

  // Determine which channels to use
  const channelsToUse = determineChannels(payload, preferences, recipient);

  // Check quiet hours
  if (isInQuietHours(preferences)) {
    // Store for later delivery (except high priority)
    if (payload.priority !== 'high') {
      await storeForLaterDelivery(notificationId, recipient, payload);
      logger.info('Notification stored for quiet hours', { notificationId, userId: recipient.userId });
      return {
        notificationId,
        userId: recipient.userId,
        channels: {},
        overallSuccess: true,
      };
    }
  }

  // Check rate limits
  const rateLimitOk = await checkRateLimits(recipient.userId, channelsToUse);
  if (!rateLimitOk.success) {
    logger.warn('Rate limit exceeded', {
      userId: recipient.userId,
      exceededChannels: rateLimitOk.exceededChannels,
    });
  }

  // Send via each channel
  for (const channel of channelsToUse) {
    if (rateLimitOk.exceededChannels?.includes(channel)) {
      channels[channel] = { success: false, error: 'Rate limit exceeded' };
      continue;
    }

    try {
      switch (channel) {
        case 'push':
          channels.push = await sendPushNotification(recipient, payload);
          break;
        case 'sms':
          channels.sms = await sendSMSNotification(recipient, payload);
          break;
        case 'email':
          channels.email = await sendEmailNotification(recipient, payload);
          break;
        case 'in_app':
          channels.in_app = await sendInAppNotification(recipient, payload);
          break;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      channels[channel] = { success: false, error: errorMessage };
      logger.error('Failed to send notification via channel', {
        notificationId,
        channel,
        error: errorMessage,
      });
    }
  }

  // Record notification
  await recordNotification(notificationId, recipient.userId, payload, channels);

  // Update rate limit counters
  await updateRateLimitCounters(recipient.userId, channelsToUse);

  const overallSuccess = Object.values(channels).some((c) => c.success);

  return {
    notificationId,
    userId: recipient.userId,
    channels,
    overallSuccess,
  };
}

/**
 * Send notification to multiple users
 */
export async function sendBulkNotification(
  recipients: NotificationRecipient[],
  payload: NotificationPayload
): Promise<NotificationResult[]> {
  const results = await Promise.all(
    recipients.map((recipient) => sendNotification(recipient, payload))
  );

  const successCount = results.filter((r) => r.overallSuccess).length;
  logger.info('Bulk notification sent', {
    total: recipients.length,
    success: successCount,
    type: payload.type,
  });

  return results;
}

/**
 * Send push notification
 */
async function sendPushNotification(
  recipient: NotificationRecipient,
  payload: NotificationPayload
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!recipient.deviceTokens || recipient.deviceTokens.length === 0) {
    return { success: false, error: 'No device tokens' };
  }

  const pushPayload: PushNotificationPayload = {
    title: payload.title,
    body: payload.body,
    data: payload.data ? stringifyData(payload.data) : undefined,
    imageUrl: payload.imageUrl,
    clickAction: payload.actionUrl,
  };

  const results = await Promise.all(
    recipient.deviceTokens.map((device) =>
      pushChannel.send(
        {
          userId: recipient.userId,
          deviceToken: device.token,
          platform: device.platform,
        },
        pushPayload
      )
    )
  );

  const successResult = results.find((r) => r.success);
  if (successResult) {
    return { success: true, messageId: successResult.messageId };
  }

  return { success: false, error: results[0]?.error || 'All push sends failed' };
}

/**
 * Send SMS notification
 */
async function sendSMSNotification(
  recipient: NotificationRecipient,
  payload: NotificationPayload
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!recipient.phone) {
    return { success: false, error: 'No phone number' };
  }

  const smsPayload: SMSPayload = {
    message: `${payload.title}: ${payload.body}`,
    templateId: payload.templateId,
  };

  const result = await smsChannel.send(
    { userId: recipient.userId, phoneNumber: recipient.phone },
    smsPayload
  );

  return {
    success: result.success,
    messageId: result.messageId,
    error: result.error,
  };
}

/**
 * Send email notification
 */
async function sendEmailNotification(
  recipient: NotificationRecipient,
  payload: NotificationPayload
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!recipient.email) {
    return { success: false, error: 'No email address' };
  }

  const emailPayload: EmailPayload = {
    subject: payload.title,
    text: payload.body,
    html: generateEmailHtml(payload),
    templateId: payload.templateId,
    templateData: payload.templateData,
  };

  const result = await emailChannel.send(
    { userId: recipient.userId, email: recipient.email },
    emailPayload
  );

  return {
    success: result.success,
    messageId: result.messageId,
    error: result.error,
  };
}

/**
 * Send in-app notification
 */
async function sendInAppNotification(
  recipient: NotificationRecipient,
  payload: NotificationPayload
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin.from('in_app_notifications').insert({
      user_id: recipient.userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      image_url: payload.imageUrl,
      action_url: payload.actionUrl,
      is_read: false,
      created_at: new Date().toISOString(),
    }).select('id').single();

    if (error) throw error;

    return { success: true, messageId: data.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Get user notification preferences
 */
export async function getUserNotificationPreferences(
  userId: string
): Promise<UserNotificationPreferences> {
  const { data } = await supabaseAdmin
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (data) {
    return {
      userId,
      pushEnabled: data.push_enabled ?? true,
      smsEnabled: data.sms_enabled ?? true,
      emailEnabled: data.email_enabled ?? true,
      inAppEnabled: data.in_app_enabled ?? true,
      quietHoursStart: data.quiet_hours_start,
      quietHoursEnd: data.quiet_hours_end,
      disabledTypes: data.disabled_types || [],
    };
  }

  // Default preferences
  return {
    userId,
    pushEnabled: true,
    smsEnabled: true,
    emailEnabled: true,
    inAppEnabled: true,
  };
}

/**
 * Update user notification preferences
 */
export async function updateUserNotificationPreferences(
  userId: string,
  preferences: Partial<UserNotificationPreferences>
): Promise<void> {
  await supabaseAdmin.from('notification_preferences').upsert({
    user_id: userId,
    push_enabled: preferences.pushEnabled,
    sms_enabled: preferences.smsEnabled,
    email_enabled: preferences.emailEnabled,
    in_app_enabled: preferences.inAppEnabled,
    quiet_hours_start: preferences.quietHoursStart,
    quiet_hours_end: preferences.quietHoursEnd,
    disabled_types: preferences.disabledTypes,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Get user's in-app notifications
 */
export async function getInAppNotifications(
  userId: string,
  options: { limit?: number; unreadOnly?: boolean } = {}
): Promise<Array<{
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
}>> {
  let query = supabaseAdmin
    .from('in_app_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (options.unreadOnly) {
    query = query.eq('is_read', false);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data } = await query;

  return (data || []).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    data: n.data,
    isRead: n.is_read,
    createdAt: new Date(n.created_at),
  }));
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<void> {
  await supabaseAdmin
    .from('in_app_notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId);
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(userId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('in_app_notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_read', false)
    .select('id');

  return data?.length || 0;
}

// Helper functions

function generateNotificationId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function determineChannels(
  payload: NotificationPayload,
  preferences: UserNotificationPreferences,
  recipient: NotificationRecipient
): NotificationChannel[] {
  // Start with requested channels or defaults based on notification type
  let channels = payload.channels || getDefaultChannels(payload.type);

  // Filter based on user preferences
  channels = channels.filter((channel) => {
    switch (channel) {
      case 'push':
        return preferences.pushEnabled && recipient.deviceTokens?.length;
      case 'sms':
        return preferences.smsEnabled && recipient.phone;
      case 'email':
        return preferences.emailEnabled && recipient.email;
      case 'in_app':
        return preferences.inAppEnabled;
      default:
        return false;
    }
  });

  // Check if notification type is disabled
  if (preferences.disabledTypes?.includes(payload.type)) {
    // Only allow transactional notifications (OTP, order updates)
    const transactionalTypes: NotificationType[] = [
      'otp',
      'order_confirmed',
      'order_delivered',
      'order_cancelled',
      'password_reset',
    ];
    if (!transactionalTypes.includes(payload.type)) {
      return [];
    }
  }

  return channels;
}

function getDefaultChannels(type: NotificationType): NotificationChannel[] {
  const channelMap: Record<NotificationType, NotificationChannel[]> = {
    order_placed: ['push', 'email', 'in_app'],
    order_confirmed: ['push', 'sms', 'in_app'],
    order_preparing: ['push', 'in_app'],
    order_ready: ['push', 'in_app'],
    driver_assigned: ['push', 'in_app'],
    order_picked_up: ['push', 'in_app'],
    order_in_transit: ['push', 'in_app'],
    order_delivered: ['push', 'sms', 'email', 'in_app'],
    order_cancelled: ['push', 'sms', 'email', 'in_app'],
    driver_nearby: ['push'],
    payment_received: ['push', 'in_app'],
    payment_failed: ['push', 'sms', 'email', 'in_app'],
    promo_offer: ['push', 'email', 'in_app'],
    account_update: ['email', 'in_app'],
    password_reset: ['email'],
    otp: ['sms'],
    feedback_request: ['push', 'email', 'in_app'],
    support_response: ['push', 'email', 'in_app'],
    driver_earnings: ['push', 'in_app'],
    merchant_order: ['push', 'sms', 'in_app'],
  };

  return channelMap[type] || ['push', 'in_app'];
}

function isInQuietHours(preferences: UserNotificationPreferences): boolean {
  if (!preferences.quietHoursStart || !preferences.quietHoursEnd) {
    return false;
  }

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  if (preferences.quietHoursStart <= preferences.quietHoursEnd) {
    return currentTime >= preferences.quietHoursStart && currentTime < preferences.quietHoursEnd;
  } else {
    // Overnight quiet hours (e.g., 22:00 - 07:00)
    return currentTime >= preferences.quietHoursStart || currentTime < preferences.quietHoursEnd;
  }
}

async function checkRateLimits(
  userId: string,
  channels: NotificationChannel[]
): Promise<{ success: boolean; exceededChannels?: NotificationChannel[] }> {
  const exceeded: NotificationChannel[] = [];
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  for (const channel of channels) {
    const limits = RATE_LIMITS[channel];

    const { count: hourCount } = await supabaseAdmin
      .from('notification_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('channel', channel)
      .gte('sent_at', hourAgo.toISOString());

    const { count: dayCount } = await supabaseAdmin
      .from('notification_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('channel', channel)
      .gte('sent_at', dayAgo.toISOString());

    if ((hourCount || 0) >= limits.maxPerHour || (dayCount || 0) >= limits.maxPerDay) {
      exceeded.push(channel);
    }
  }

  return {
    success: exceeded.length === 0,
    exceededChannels: exceeded.length > 0 ? exceeded : undefined,
  };
}

async function updateRateLimitCounters(
  userId: string,
  channels: NotificationChannel[]
): Promise<void> {
  const now = new Date().toISOString();
  await Promise.all(
    channels.map((channel) =>
      supabaseAdmin.from('notification_log').insert({
        user_id: userId,
        channel,
        sent_at: now,
      })
    )
  );
}

async function recordNotification(
  notificationId: string,
  userId: string,
  payload: NotificationPayload,
  channels: NotificationResult['channels']
): Promise<void> {
  await supabaseAdmin.from('notification_history').insert({
    id: notificationId,
    user_id: userId,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    channels_used: Object.keys(channels),
    channel_results: channels,
    created_at: new Date().toISOString(),
  });
}

async function storeForLaterDelivery(
  notificationId: string,
  recipient: NotificationRecipient,
  payload: NotificationPayload
): Promise<void> {
  await supabaseAdmin.from('scheduled_notifications').insert({
    id: notificationId,
    user_id: recipient.userId,
    recipient_data: recipient,
    payload,
    scheduled_for: getQuietHoursEnd(recipient.userId),
    created_at: new Date().toISOString(),
  });
}

async function getQuietHoursEnd(userId: string): Promise<string> {
  const prefs = await getUserNotificationPreferences(userId);
  if (!prefs.quietHoursEnd) return new Date().toISOString();

  const [hours, minutes] = prefs.quietHoursEnd.split(':').map(Number);
  const deliveryTime = new Date();
  deliveryTime.setHours(hours, minutes, 0, 0);

  if (deliveryTime < new Date()) {
    deliveryTime.setDate(deliveryTime.getDate() + 1);
  }

  return deliveryTime.toISOString();
}

function stringifyData(data: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, String(value)])
  );
}

function generateEmailHtml(payload: NotificationPayload): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">${payload.title}</h2>
      <p style="color: #666; line-height: 1.6;">${payload.body}</p>
      ${
        payload.actionUrl
          ? `<a href="${payload.actionUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 15px;">View Details</a>`
          : ''
      }
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">This email was sent by LMA. If you have questions, contact support.</p>
    </div>
  `;
}

export type {
  NotificationType,
  NotificationChannel,
  NotificationRecipient,
  NotificationPayload,
  NotificationResult,
  UserNotificationPreferences,
};
