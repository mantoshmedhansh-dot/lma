/**
 * Rating and Feedback System
 *
 * Handles customer ratings and feedback for:
 * - Orders (overall experience)
 * - Drivers (delivery service)
 * - Merchants (food quality)
 *
 * Features:
 * - Multi-dimensional ratings
 * - Text feedback
 * - Issue reporting
 * - Rating aggregation
 * - Feedback analysis
 */

import { supabaseAdmin } from '../../config/supabase.js';
import { logger } from '../../lib/logger.js';
import { sendNotification, NotificationRecipient } from './notificationService.js';

// Rating types
type RatingTarget = 'order' | 'driver' | 'merchant';

interface RatingDimension {
  id: string;
  label: string;
  value: number; // 1-5
}

interface OrderRating {
  orderId: string;
  customerId: string;
  overallRating: number;
  driverRating?: number;
  merchantRating?: number;
  dimensions?: RatingDimension[];
  feedback?: string;
  issues?: string[];
  tipAmount?: number;
  createdAt: Date;
}

interface DriverRating {
  driverId: string;
  orderId: string;
  customerId: string;
  rating: number;
  dimensions?: {
    punctuality?: number;
    professionalism?: number;
    delivery_care?: number;
  };
  feedback?: string;
  createdAt: Date;
}

interface MerchantRating {
  merchantId: string;
  orderId: string;
  customerId: string;
  rating: number;
  dimensions?: {
    food_quality?: number;
    packaging?: number;
    accuracy?: number;
    value_for_money?: number;
  };
  feedback?: string;
  photos?: string[];
  createdAt: Date;
}

interface RatingStats {
  averageRating: number;
  totalRatings: number;
  ratingDistribution: Record<number, number>;
  dimensionAverages?: Record<string, number>;
  recentTrend: 'up' | 'down' | 'stable';
}

interface FeedbackIssue {
  id: string;
  category: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

// Issue categories
const ISSUE_CATEGORIES: FeedbackIssue[] = [
  { id: 'late_delivery', category: 'Delivery', description: 'Order arrived late', severity: 'medium' },
  { id: 'wrong_items', category: 'Order', description: 'Wrong items received', severity: 'high' },
  { id: 'missing_items', category: 'Order', description: 'Items missing from order', severity: 'high' },
  { id: 'cold_food', category: 'Food', description: 'Food was cold', severity: 'medium' },
  { id: 'poor_packaging', category: 'Packaging', description: 'Poor packaging', severity: 'low' },
  { id: 'spilled', category: 'Packaging', description: 'Order was spilled/damaged', severity: 'high' },
  { id: 'rude_driver', category: 'Driver', description: 'Driver was unprofessional', severity: 'medium' },
  { id: 'hygiene', category: 'Food', description: 'Hygiene concerns', severity: 'high' },
  { id: 'quantity', category: 'Food', description: 'Less quantity than expected', severity: 'medium' },
  { id: 'taste', category: 'Food', description: 'Taste was not good', severity: 'low' },
];

/**
 * Submit order rating
 */
export async function submitOrderRating(rating: OrderRating): Promise<{ success: boolean; ratingId?: string }> {
  try {
    // Validate order exists and belongs to customer
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, customer_id, driver_id, merchant_id, status')
      .eq('id', rating.orderId)
      .eq('customer_id', rating.customerId)
      .single();

    if (!order) {
      return { success: false };
    }

    if (order.status !== 'delivered') {
      logger.warn('Cannot rate undelivered order', { orderId: rating.orderId });
      return { success: false };
    }

    // Check if already rated
    const { data: existing } = await supabaseAdmin
      .from('order_ratings')
      .select('id')
      .eq('order_id', rating.orderId)
      .single();

    if (existing) {
      logger.warn('Order already rated', { orderId: rating.orderId });
      return { success: false };
    }

    // Insert rating
    const { data, error } = await supabaseAdmin
      .from('order_ratings')
      .insert({
        order_id: rating.orderId,
        customer_id: rating.customerId,
        overall_rating: rating.overallRating,
        driver_rating: rating.driverRating,
        merchant_rating: rating.merchantRating,
        dimensions: rating.dimensions,
        feedback: rating.feedback,
        issues: rating.issues,
        tip_amount: rating.tipAmount,
      })
      .select('id')
      .single();

    if (error) throw error;

    // Update driver rating if provided
    if (rating.driverRating && order.driver_id) {
      await submitDriverRating({
        driverId: order.driver_id,
        orderId: rating.orderId,
        customerId: rating.customerId,
        rating: rating.driverRating,
        feedback: rating.feedback,
        createdAt: new Date(),
      });
    }

    // Update merchant rating if provided
    if (rating.merchantRating && order.merchant_id) {
      await submitMerchantRating({
        merchantId: order.merchant_id,
        orderId: rating.orderId,
        customerId: rating.customerId,
        rating: rating.merchantRating,
        feedback: rating.feedback,
        createdAt: new Date(),
      });
    }

    // Process tip if provided
    if (rating.tipAmount && rating.tipAmount > 0 && order.driver_id) {
      await processTip(order.driver_id, rating.orderId, rating.tipAmount);
    }

    // Handle issues if reported
    if (rating.issues && rating.issues.length > 0) {
      await handleIssueReport(rating.orderId, rating.customerId, rating.issues);
    }

    logger.info('Order rating submitted', {
      orderId: rating.orderId,
      rating: rating.overallRating,
    });

    return { success: true, ratingId: data.id };
  } catch (error) {
    logger.error('Failed to submit order rating', { error, orderId: rating.orderId });
    return { success: false };
  }
}

/**
 * Submit driver rating
 */
export async function submitDriverRating(rating: DriverRating): Promise<void> {
  await supabaseAdmin.from('driver_ratings').insert({
    driver_id: rating.driverId,
    order_id: rating.orderId,
    customer_id: rating.customerId,
    rating: rating.rating,
    dimensions: rating.dimensions,
    feedback: rating.feedback,
  });

  // Update driver's average rating
  await updateDriverAverageRating(rating.driverId);
}

/**
 * Submit merchant rating
 */
export async function submitMerchantRating(rating: MerchantRating): Promise<void> {
  await supabaseAdmin.from('merchant_ratings').insert({
    merchant_id: rating.merchantId,
    order_id: rating.orderId,
    customer_id: rating.customerId,
    rating: rating.rating,
    dimensions: rating.dimensions,
    feedback: rating.feedback,
    photos: rating.photos,
  });

  // Update merchant's average rating
  await updateMerchantAverageRating(rating.merchantId);
}

/**
 * Get rating statistics for a driver
 */
export async function getDriverRatingStats(driverId: string): Promise<RatingStats> {
  const { data: ratings } = await supabaseAdmin
    .from('driver_ratings')
    .select('rating, dimensions, created_at')
    .eq('driver_id', driverId);

  return calculateRatingStats(ratings || []);
}

/**
 * Get rating statistics for a merchant
 */
export async function getMerchantRatingStats(merchantId: string): Promise<RatingStats> {
  const { data: ratings } = await supabaseAdmin
    .from('merchant_ratings')
    .select('rating, dimensions, created_at')
    .eq('merchant_id', merchantId);

  return calculateRatingStats(ratings || []);
}

/**
 * Get order rating
 */
export async function getOrderRating(orderId: string): Promise<OrderRating | null> {
  const { data } = await supabaseAdmin
    .from('order_ratings')
    .select('*')
    .eq('order_id', orderId)
    .single();

  if (!data) return null;

  return {
    orderId: data.order_id,
    customerId: data.customer_id,
    overallRating: data.overall_rating,
    driverRating: data.driver_rating,
    merchantRating: data.merchant_rating,
    dimensions: data.dimensions,
    feedback: data.feedback,
    issues: data.issues,
    tipAmount: data.tip_amount,
    createdAt: new Date(data.created_at),
  };
}

/**
 * Get recent ratings for a driver
 */
export async function getDriverRecentRatings(
  driverId: string,
  limit: number = 10
): Promise<Array<{
  orderId: string;
  rating: number;
  feedback?: string;
  createdAt: Date;
}>> {
  const { data } = await supabaseAdmin
    .from('driver_ratings')
    .select('order_id, rating, feedback, created_at')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data || []).map((r) => ({
    orderId: r.order_id,
    rating: r.rating,
    feedback: r.feedback,
    createdAt: new Date(r.created_at),
  }));
}

/**
 * Get recent ratings for a merchant
 */
export async function getMerchantRecentRatings(
  merchantId: string,
  limit: number = 10
): Promise<Array<{
  orderId: string;
  rating: number;
  feedback?: string;
  photos?: string[];
  createdAt: Date;
}>> {
  const { data } = await supabaseAdmin
    .from('merchant_ratings')
    .select('order_id, rating, feedback, photos, created_at')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data || []).map((r) => ({
    orderId: r.order_id,
    rating: r.rating,
    feedback: r.feedback,
    photos: r.photos,
    createdAt: new Date(r.created_at),
  }));
}

/**
 * Request feedback from customer
 */
export async function requestFeedback(orderId: string): Promise<void> {
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select(`
      id,
      order_number,
      customer_id,
      users!orders_customer_id_fkey(id, full_name, phone, email),
      merchants(business_name)
    `)
    .eq('id', orderId)
    .eq('status', 'delivered')
    .single();

  if (!order) return;

  // Check if already rated
  const { data: existing } = await supabaseAdmin
    .from('order_ratings')
    .select('id')
    .eq('order_id', orderId)
    .single();

  if (existing) return;

  // Get device tokens
  const { data: devices } = await supabaseAdmin
    .from('user_devices')
    .select('token, platform')
    .eq('user_id', order.customer_id)
    .eq('is_active', true);

  const user = order.users as { id: string; full_name: string; phone: string; email: string };
  const merchant = order.merchants as { business_name: string };

  const recipient: NotificationRecipient = {
    userId: order.customer_id,
    email: user?.email,
    phone: user?.phone,
    deviceTokens: devices?.map((d) => ({ token: d.token, platform: d.platform })),
  };

  const feedbackUrl = `${process.env.APP_URL || 'https://lma.app'}/rate/${orderId}`;

  await sendNotification(recipient, {
    type: 'feedback_request',
    title: 'How was your order?',
    body: `Rate your experience with ${merchant?.business_name || 'your recent order'}`,
    data: { orderId, feedbackUrl },
    actionUrl: feedbackUrl,
  });

  logger.info('Feedback request sent', { orderId });
}

/**
 * Get available issue categories
 */
export function getIssueCategories(): FeedbackIssue[] {
  return ISSUE_CATEGORIES;
}

/**
 * Report an issue with an order
 */
export async function reportIssue(
  orderId: string,
  customerId: string,
  issueIds: string[],
  additionalDetails?: string
): Promise<{ success: boolean; ticketId?: string }> {
  try {
    const issues = ISSUE_CATEGORIES.filter((i) => issueIds.includes(i.id));
    const severity = issues.reduce(
      (max, i) =>
        i.severity === 'high' ? 'high' :
        i.severity === 'medium' && max !== 'high' ? 'medium' : max,
      'low' as 'low' | 'medium' | 'high'
    );

    const { data, error } = await supabaseAdmin
      .from('support_tickets')
      .insert({
        order_id: orderId,
        customer_id: customerId,
        type: 'order_issue',
        status: 'open',
        priority: severity,
        subject: `Order Issue: ${issues.map((i) => i.description).join(', ')}`,
        description: additionalDetails,
        metadata: { issues: issueIds },
      })
      .select('id')
      .single();

    if (error) throw error;

    logger.info('Issue reported', { orderId, issueIds, ticketId: data.id });

    return { success: true, ticketId: data.id };
  } catch (error) {
    logger.error('Failed to report issue', { error, orderId });
    return { success: false };
  }
}

/**
 * Get feedback summary for analytics
 */
export async function getFeedbackSummary(
  options: {
    merchantId?: string;
    driverId?: string;
    daysBack?: number;
  } = {}
): Promise<{
  totalRatings: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  commonIssues: Array<{ issue: string; count: number }>;
  sentimentSummary: { positive: number; neutral: number; negative: number };
}> {
  const daysBack = options.daysBack || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  let query = supabaseAdmin
    .from('order_ratings')
    .select('overall_rating, issues, feedback')
    .gte('created_at', startDate.toISOString());

  if (options.merchantId) {
    query = query.eq('merchant_id', options.merchantId);
  }

  const { data: ratings } = await query;

  if (!ratings || ratings.length === 0) {
    return {
      totalRatings: 0,
      averageRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      commonIssues: [],
      sentimentSummary: { positive: 0, neutral: 0, negative: 0 },
    };
  }

  // Calculate distribution
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalRating = 0;

  ratings.forEach((r) => {
    distribution[r.overall_rating] = (distribution[r.overall_rating] || 0) + 1;
    totalRating += r.overall_rating;
  });

  // Count issues
  const issueCounts: Record<string, number> = {};
  ratings.forEach((r) => {
    if (r.issues) {
      r.issues.forEach((issue: string) => {
        issueCounts[issue] = (issueCounts[issue] || 0) + 1;
      });
    }
  });

  const commonIssues = Object.entries(issueCounts)
    .map(([issue, count]) => ({ issue, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Simple sentiment analysis
  const positive = ratings.filter((r) => r.overall_rating >= 4).length;
  const negative = ratings.filter((r) => r.overall_rating <= 2).length;
  const neutral = ratings.length - positive - negative;

  return {
    totalRatings: ratings.length,
    averageRating: Math.round((totalRating / ratings.length) * 10) / 10,
    ratingDistribution: distribution,
    commonIssues,
    sentimentSummary: { positive, neutral, negative },
  };
}

// Helper functions

async function updateDriverAverageRating(driverId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from('driver_ratings')
    .select('rating')
    .eq('driver_id', driverId);

  if (!data || data.length === 0) return;

  const avgRating = data.reduce((sum, r) => sum + r.rating, 0) / data.length;

  await supabaseAdmin
    .from('drivers')
    .update({
      average_rating: Math.round(avgRating * 10) / 10,
      total_ratings: data.length,
    })
    .eq('id', driverId);
}

async function updateMerchantAverageRating(merchantId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from('merchant_ratings')
    .select('rating')
    .eq('merchant_id', merchantId);

  if (!data || data.length === 0) return;

  const avgRating = data.reduce((sum, r) => sum + r.rating, 0) / data.length;

  await supabaseAdmin
    .from('merchants')
    .update({
      average_rating: Math.round(avgRating * 10) / 10,
      total_ratings: data.length,
    })
    .eq('id', merchantId);
}

async function processTip(driverId: string, orderId: string, amount: number): Promise<void> {
  // Record tip
  await supabaseAdmin.from('driver_tips').insert({
    driver_id: driverId,
    order_id: orderId,
    amount,
  });

  // Update driver balance
  await supabaseAdmin.rpc('increment_driver_balance', {
    driver_id: driverId,
    amount,
  });

  logger.info('Tip processed', { driverId, orderId, amount });
}

async function handleIssueReport(
  orderId: string,
  customerId: string,
  issues: string[]
): Promise<void> {
  // Create support ticket for high-severity issues
  const highSeverityIssues = ISSUE_CATEGORIES.filter(
    (i) => issues.includes(i.id) && i.severity === 'high'
  );

  if (highSeverityIssues.length > 0) {
    await supabaseAdmin.from('support_tickets').insert({
      order_id: orderId,
      customer_id: customerId,
      type: 'order_issue',
      status: 'open',
      priority: 'high',
      subject: `High Priority Issue: ${highSeverityIssues.map((i) => i.description).join(', ')}`,
      metadata: { issues },
    });
  }
}

function calculateRatingStats(
  ratings: Array<{ rating: number; dimensions?: Record<string, number>; created_at: string }>
): RatingStats {
  if (ratings.length === 0) {
    return {
      averageRating: 0,
      totalRatings: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      recentTrend: 'stable',
    };
  }

  // Calculate average
  const totalRating = ratings.reduce((sum, r) => sum + r.rating, 0);
  const averageRating = Math.round((totalRating / ratings.length) * 10) / 10;

  // Calculate distribution
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  ratings.forEach((r) => {
    distribution[r.rating] = (distribution[r.rating] || 0) + 1;
  });

  // Calculate dimension averages
  const dimensionTotals: Record<string, { sum: number; count: number }> = {};
  ratings.forEach((r) => {
    if (r.dimensions) {
      Object.entries(r.dimensions).forEach(([key, value]) => {
        if (!dimensionTotals[key]) {
          dimensionTotals[key] = { sum: 0, count: 0 };
        }
        dimensionTotals[key].sum += value;
        dimensionTotals[key].count++;
      });
    }
  });

  const dimensionAverages: Record<string, number> = {};
  Object.entries(dimensionTotals).forEach(([key, { sum, count }]) => {
    dimensionAverages[key] = Math.round((sum / count) * 10) / 10;
  });

  // Calculate trend (compare last 7 days to previous 7 days)
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const recentRatings = ratings.filter((r) => new Date(r.created_at) >= weekAgo);
  const previousRatings = ratings.filter(
    (r) => new Date(r.created_at) >= twoWeeksAgo && new Date(r.created_at) < weekAgo
  );

  let recentTrend: 'up' | 'down' | 'stable' = 'stable';
  if (recentRatings.length > 0 && previousRatings.length > 0) {
    const recentAvg = recentRatings.reduce((s, r) => s + r.rating, 0) / recentRatings.length;
    const previousAvg = previousRatings.reduce((s, r) => s + r.rating, 0) / previousRatings.length;

    if (recentAvg > previousAvg + 0.2) {
      recentTrend = 'up';
    } else if (recentAvg < previousAvg - 0.2) {
      recentTrend = 'down';
    }
  }

  return {
    averageRating,
    totalRatings: ratings.length,
    ratingDistribution: distribution,
    dimensionAverages: Object.keys(dimensionAverages).length > 0 ? dimensionAverages : undefined,
    recentTrend,
  };
}

export type { OrderRating, DriverRating, MerchantRating, RatingStats, FeedbackIssue };
