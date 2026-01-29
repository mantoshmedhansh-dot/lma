/**
 * Notification Templates System
 *
 * Provides templating for all notification types with:
 * - Variable substitution
 * - Multi-language support
 * - Channel-specific formatting
 * - Template versioning
 */

import { supabaseAdmin } from '../../config/supabase.js';
import { logger } from '../../lib/logger.js';
import { NotificationType, NotificationChannel } from './notificationService.js';

type Language = 'en' | 'hi' | 'ta' | 'te' | 'kn' | 'ml' | 'mr' | 'bn' | 'gu' | 'pa';

interface TemplateVariables {
  // Common
  userName?: string;
  userPhone?: string;
  appName?: string;

  // Order related
  orderId?: string;
  orderNumber?: string;
  orderTotal?: number;
  itemCount?: number;
  deliveryAddress?: string;
  pickupAddress?: string;
  estimatedTime?: string;
  actualTime?: string;

  // Driver related
  driverName?: string;
  driverPhone?: string;
  vehicleNumber?: string;
  vehicleType?: string;

  // Merchant related
  merchantName?: string;
  merchantPhone?: string;

  // Payment related
  paymentMethod?: string;
  paymentAmount?: number;
  transactionId?: string;

  // Tracking
  trackingUrl?: string;
  feedbackUrl?: string;
  supportUrl?: string;

  // Promo
  promoCode?: string;
  discountAmount?: number;
  discountPercent?: number;
  validUntil?: string;

  // Generic
  otp?: string;
  reason?: string;
  [key: string]: unknown;
}

interface Template {
  id: string;
  type: NotificationType;
  channel: NotificationChannel | 'all';
  language: Language;
  title: string;
  body: string;
  variables: string[];
  isActive: boolean;
  version: number;
}

interface ProcessedTemplate {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// Default templates (English)
const DEFAULT_TEMPLATES: Record<NotificationType, { title: string; body: string }> = {
  order_placed: {
    title: 'Order Placed Successfully',
    body: 'Your order #{orderNumber} has been placed. Total: ₹{orderTotal}. We\'ll notify you once the restaurant confirms.',
  },
  order_confirmed: {
    title: 'Order Confirmed!',
    body: '{merchantName} has confirmed your order #{orderNumber}. Estimated delivery: {estimatedTime}.',
  },
  order_preparing: {
    title: 'Preparing Your Order',
    body: '{merchantName} is preparing your order #{orderNumber}. Get ready!',
  },
  order_ready: {
    title: 'Order Ready for Pickup',
    body: 'Your order #{orderNumber} is ready! A driver will pick it up soon.',
  },
  driver_assigned: {
    title: 'Driver Assigned',
    body: '{driverName} is assigned to your order #{orderNumber}. {vehicleType}: {vehicleNumber}',
  },
  order_picked_up: {
    title: 'Order Picked Up',
    body: '{driverName} has picked up your order from {merchantName}. On the way!',
  },
  order_in_transit: {
    title: 'Order On the Way',
    body: 'Your order #{orderNumber} is on the way. ETA: {estimatedTime}',
  },
  order_delivered: {
    title: 'Order Delivered!',
    body: 'Your order #{orderNumber} has been delivered. Enjoy your meal! Rate your experience: {feedbackUrl}',
  },
  order_cancelled: {
    title: 'Order Cancelled',
    body: 'Your order #{orderNumber} has been cancelled. Reason: {reason}. Amount will be refunded shortly.',
  },
  driver_nearby: {
    title: 'Driver Nearby',
    body: '{driverName} is nearby. Please be ready to receive your order #{orderNumber}.',
  },
  payment_received: {
    title: 'Payment Successful',
    body: 'Payment of ₹{paymentAmount} received for order #{orderNumber}. Transaction ID: {transactionId}',
  },
  payment_failed: {
    title: 'Payment Failed',
    body: 'Payment for order #{orderNumber} failed. Please try again or use a different payment method.',
  },
  promo_offer: {
    title: 'Special Offer for You!',
    body: 'Use code {promoCode} to get {discountPercent}% off your next order. Valid until {validUntil}.',
  },
  account_update: {
    title: 'Account Updated',
    body: 'Your account information has been updated successfully.',
  },
  password_reset: {
    title: 'Password Reset',
    body: 'Click here to reset your password. This link expires in 1 hour.',
  },
  otp: {
    title: 'Verification Code',
    body: 'Your verification code is {otp}. Valid for 10 minutes. Do not share this code.',
  },
  feedback_request: {
    title: 'Rate Your Experience',
    body: 'How was your order from {merchantName}? Tap to rate: {feedbackUrl}',
  },
  support_response: {
    title: 'Support Response',
    body: 'We\'ve responded to your support request. Tap to view the response.',
  },
  driver_earnings: {
    title: 'Earnings Update',
    body: 'Great job! You\'ve earned ₹{paymentAmount} today. Keep delivering!',
  },
  merchant_order: {
    title: 'New Order #{orderNumber}',
    body: 'New order received! {itemCount} item(s). Total: ₹{orderTotal}. Confirm now!',
  },
};

// Hindi translations
const HINDI_TEMPLATES: Partial<Record<NotificationType, { title: string; body: string }>> = {
  order_placed: {
    title: 'ऑर्डर सफलतापूर्वक दिया गया',
    body: 'आपका ऑर्डर #{orderNumber} दिया गया है। कुल: ₹{orderTotal}। रेस्तरां के कन्फर्म करने पर आपको सूचित किया जाएगा।',
  },
  order_confirmed: {
    title: 'ऑर्डर कन्फर्म!',
    body: '{merchantName} ने आपका ऑर्डर #{orderNumber} कन्फर्म कर दिया है। अनुमानित डिलीवरी: {estimatedTime}।',
  },
  order_delivered: {
    title: 'ऑर्डर डिलीवर हो गया!',
    body: 'आपका ऑर्डर #{orderNumber} डिलीवर हो गया है। अपने अनुभव को रेट करें: {feedbackUrl}',
  },
  otp: {
    title: 'सत्यापन कोड',
    body: 'आपका सत्यापन कोड {otp} है। 10 मिनट के लिए वैध। इस कोड को किसी के साथ साझा न करें।',
  },
};

/**
 * Get template for a notification type
 */
export async function getTemplate(
  type: NotificationType,
  channel: NotificationChannel,
  language: Language = 'en'
): Promise<Template | null> {
  // Try to get from database first
  const { data: dbTemplate } = await supabaseAdmin
    .from('notification_templates')
    .select('*')
    .eq('type', type)
    .eq('is_active', true)
    .or(`channel.eq.${channel},channel.eq.all`)
    .eq('language', language)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  if (dbTemplate) {
    return {
      id: dbTemplate.id,
      type: dbTemplate.type,
      channel: dbTemplate.channel,
      language: dbTemplate.language,
      title: dbTemplate.title,
      body: dbTemplate.body,
      variables: dbTemplate.variables || [],
      isActive: dbTemplate.is_active,
      version: dbTemplate.version,
    };
  }

  // Fall back to default templates
  const defaultTemplate =
    language === 'hi' && HINDI_TEMPLATES[type]
      ? HINDI_TEMPLATES[type]
      : DEFAULT_TEMPLATES[type];

  if (!defaultTemplate) return null;

  return {
    id: `default_${type}_${language}`,
    type,
    channel: 'all',
    language,
    title: defaultTemplate.title,
    body: defaultTemplate.body,
    variables: extractVariables(defaultTemplate.body),
    isActive: true,
    version: 1,
  };
}

/**
 * Process template with variables
 */
export function processTemplate(
  template: Template,
  variables: TemplateVariables
): ProcessedTemplate {
  let title = template.title;
  let body = template.body;

  // Add default app name
  variables.appName = variables.appName || 'LMA';

  // Replace all variables
  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined && value !== null) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      const stringValue = formatValue(key, value);
      title = title.replace(regex, stringValue);
      body = body.replace(regex, stringValue);
    }
  }

  // Remove any unreplaced variables
  title = title.replace(/\{[^}]+\}/g, '');
  body = body.replace(/\{[^}]+\}/g, '');

  return {
    title: title.trim(),
    body: body.trim(),
    data: variables as Record<string, unknown>,
  };
}

/**
 * Create or update a template
 */
export async function saveTemplate(template: Omit<Template, 'id' | 'version'>): Promise<Template> {
  // Get current version
  const { data: existing } = await supabaseAdmin
    .from('notification_templates')
    .select('version')
    .eq('type', template.type)
    .eq('channel', template.channel)
    .eq('language', template.language)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  const newVersion = (existing?.version || 0) + 1;

  // Deactivate previous versions
  await supabaseAdmin
    .from('notification_templates')
    .update({ is_active: false })
    .eq('type', template.type)
    .eq('channel', template.channel)
    .eq('language', template.language);

  // Insert new version
  const { data, error } = await supabaseAdmin
    .from('notification_templates')
    .insert({
      type: template.type,
      channel: template.channel,
      language: template.language,
      title: template.title,
      body: template.body,
      variables: extractVariables(template.body),
      is_active: template.isActive,
      version: newVersion,
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to save template', { error, template });
    throw new Error('Failed to save template');
  }

  logger.info('Template saved', {
    type: template.type,
    channel: template.channel,
    language: template.language,
    version: newVersion,
  });

  return {
    id: data.id,
    type: data.type,
    channel: data.channel,
    language: data.language,
    title: data.title,
    body: data.body,
    variables: data.variables,
    isActive: data.is_active,
    version: data.version,
  };
}

/**
 * Get all templates
 */
export async function getAllTemplates(options: {
  type?: NotificationType;
  channel?: NotificationChannel;
  language?: Language;
  activeOnly?: boolean;
} = {}): Promise<Template[]> {
  let query = supabaseAdmin
    .from('notification_templates')
    .select('*')
    .order('type')
    .order('version', { ascending: false });

  if (options.type) {
    query = query.eq('type', options.type);
  }
  if (options.channel) {
    query = query.or(`channel.eq.${options.channel},channel.eq.all`);
  }
  if (options.language) {
    query = query.eq('language', options.language);
  }
  if (options.activeOnly !== false) {
    query = query.eq('is_active', true);
  }

  const { data } = await query;

  return (data || []).map((t) => ({
    id: t.id,
    type: t.type,
    channel: t.channel,
    language: t.language,
    title: t.title,
    body: t.body,
    variables: t.variables || [],
    isActive: t.is_active,
    version: t.version,
  }));
}

/**
 * Preview template with sample data
 */
export async function previewTemplate(
  type: NotificationType,
  channel: NotificationChannel,
  language: Language = 'en',
  customVariables?: Partial<TemplateVariables>
): Promise<ProcessedTemplate | null> {
  const template = await getTemplate(type, channel, language);
  if (!template) return null;

  // Sample data for preview
  const sampleVariables: TemplateVariables = {
    userName: 'John Doe',
    userPhone: '+91 98765 43210',
    orderId: 'ord_abc123xyz',
    orderNumber: 'ABC123',
    orderTotal: 450,
    itemCount: 3,
    deliveryAddress: '123 Main Street, Bangalore',
    pickupAddress: 'Restaurant XYZ, MG Road',
    estimatedTime: '30-40 mins',
    actualTime: '35 mins',
    driverName: 'Rajesh Kumar',
    driverPhone: '+91 98765 12345',
    vehicleNumber: 'KA-01-AB-1234',
    vehicleType: 'Motorcycle',
    merchantName: 'Biryani House',
    merchantPhone: '+91 98765 67890',
    paymentMethod: 'UPI',
    paymentAmount: 450,
    transactionId: 'TXN123456',
    trackingUrl: 'https://lma.app/track/ABC123',
    feedbackUrl: 'https://lma.app/rate/ABC123',
    promoCode: 'SAVE20',
    discountPercent: 20,
    validUntil: 'Dec 31, 2024',
    otp: '123456',
    reason: 'Restaurant closed',
    ...customVariables,
  };

  return processTemplate(template, sampleVariables);
}

/**
 * Validate template syntax
 */
export function validateTemplate(title: string, body: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for unclosed braces
  const titleBraces = (title.match(/\{/g) || []).length;
  const titleCloseBraces = (title.match(/\}/g) || []).length;
  if (titleBraces !== titleCloseBraces) {
    errors.push('Title has mismatched braces');
  }

  const bodyBraces = (body.match(/\{/g) || []).length;
  const bodyCloseBraces = (body.match(/\}/g) || []).length;
  if (bodyBraces !== bodyCloseBraces) {
    errors.push('Body has mismatched braces');
  }

  // Check for empty variables
  if (/\{\s*\}/.test(title) || /\{\s*\}/.test(body)) {
    errors.push('Empty variable placeholders found');
  }

  // Check title length
  if (title.length > 100) {
    warnings.push('Title is longer than recommended (100 characters)');
  }

  // Check body length for SMS
  if (body.length > 160) {
    warnings.push('Body exceeds SMS limit (160 characters)');
  }

  // Check for unknown variables
  const knownVariables = [
    'userName', 'userPhone', 'appName', 'orderId', 'orderNumber', 'orderTotal',
    'itemCount', 'deliveryAddress', 'pickupAddress', 'estimatedTime', 'actualTime',
    'driverName', 'driverPhone', 'vehicleNumber', 'vehicleType', 'merchantName',
    'merchantPhone', 'paymentMethod', 'paymentAmount', 'transactionId', 'trackingUrl',
    'feedbackUrl', 'supportUrl', 'promoCode', 'discountAmount', 'discountPercent',
    'validUntil', 'otp', 'reason',
  ];

  const usedVariables = extractVariables(`${title} ${body}`);
  for (const variable of usedVariables) {
    if (!knownVariables.includes(variable)) {
      warnings.push(`Unknown variable: {${variable}}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Helper functions

function extractVariables(text: string): string[] {
  const matches = text.match(/\{([^}]+)\}/g) || [];
  return matches.map((m) => m.slice(1, -1));
}

function formatValue(key: string, value: unknown): string {
  // Format currency values
  if (key.includes('Amount') || key.includes('Total') || key === 'orderTotal') {
    return `₹${Number(value).toLocaleString('en-IN')}`;
  }

  // Format percentages
  if (key.includes('Percent')) {
    return `${value}%`;
  }

  return String(value);
}

export type { Template, TemplateVariables, ProcessedTemplate, Language };
