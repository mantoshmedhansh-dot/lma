/**
 * Report Generation Service
 *
 * Generates various reports for:
 * - Daily/Weekly/Monthly summaries
 * - Driver performance reports
 * - Merchant settlement reports
 * - Financial reconciliation
 * - Export to CSV/PDF formats
 */

import { supabaseAdmin } from '../../config/supabase.js';
import { logger } from '../../lib/logger.js';
import {
  getDeliveryKPIs,
  getDriverKPIs,
  getMerchantKPIs,
  getFinancialKPIs,
  getDateRange,
} from './kpi.js';

// Report types
type ReportType =
  | 'daily_summary'
  | 'weekly_summary'
  | 'monthly_summary'
  | 'driver_performance'
  | 'merchant_settlement'
  | 'financial_reconciliation'
  | 'cod_collection'
  | 'delivery_analysis'
  | 'zone_performance';

type ExportFormat = 'json' | 'csv' | 'pdf';

interface ReportConfig {
  type: ReportType;
  format: ExportFormat;
  dateRange?: {
    start: Date;
    end: Date;
  };
  filters?: {
    merchantId?: string;
    driverId?: string;
    zoneId?: string;
  };
  recipients?: string[];
  scheduleId?: string;
}

interface ReportResult {
  id: string;
  type: ReportType;
  format: ExportFormat;
  data: unknown;
  generatedAt: Date;
  fileUrl?: string;
  fileName?: string;
}

interface ScheduledReport {
  id: string;
  type: ReportType;
  format: ExportFormat;
  schedule: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  filters?: Record<string, unknown>;
  isActive: boolean;
  lastRunAt?: Date;
  nextRunAt: Date;
}

/**
 * Generate a report based on configuration
 */
export async function generateReport(config: ReportConfig): Promise<ReportResult> {
  const reportId = generateReportId();
  const dateRange = config.dateRange || getDateRange('week');

  logger.info('Generating report', { reportId, type: config.type, format: config.format });

  let data: unknown;

  switch (config.type) {
    case 'daily_summary':
      data = await generateDailySummary(dateRange.start);
      break;
    case 'weekly_summary':
      data = await generateWeeklySummary(dateRange);
      break;
    case 'monthly_summary':
      data = await generateMonthlySummary(dateRange);
      break;
    case 'driver_performance':
      data = await generateDriverPerformanceReport(dateRange, config.filters?.driverId);
      break;
    case 'merchant_settlement':
      data = await generateMerchantSettlementReport(dateRange, config.filters?.merchantId);
      break;
    case 'financial_reconciliation':
      data = await generateFinancialReconciliation(dateRange);
      break;
    case 'cod_collection':
      data = await generateCODCollectionReport(dateRange, config.filters?.driverId);
      break;
    case 'delivery_analysis':
      data = await generateDeliveryAnalysisReport(dateRange, config.filters);
      break;
    case 'zone_performance':
      data = await generateZonePerformanceReport(dateRange, config.filters?.zoneId);
      break;
    default:
      throw new Error(`Unknown report type: ${config.type}`);
  }

  // Convert to requested format
  let fileUrl: string | undefined;
  let fileName: string | undefined;

  if (config.format === 'csv') {
    const csv = convertToCSV(data, config.type);
    fileName = `${config.type}_${formatDate(new Date())}.csv`;
    fileUrl = await uploadReport(csv, fileName, 'text/csv');
  } else if (config.format === 'pdf') {
    // PDF generation would use a library like puppeteer or pdfmake
    // For now, we'll store as JSON and note PDF support
    fileName = `${config.type}_${formatDate(new Date())}.json`;
    fileUrl = await uploadReport(JSON.stringify(data, null, 2), fileName, 'application/json');
  }

  // Store report record
  await supabaseAdmin.from('generated_reports').insert({
    id: reportId,
    type: config.type,
    format: config.format,
    date_range_start: dateRange.start.toISOString(),
    date_range_end: dateRange.end.toISOString(),
    filters: config.filters || {},
    file_url: fileUrl,
    file_name: fileName,
    generated_at: new Date().toISOString(),
  });

  logger.info('Report generated successfully', { reportId, type: config.type });

  return {
    id: reportId,
    type: config.type,
    format: config.format,
    data,
    generatedAt: new Date(),
    fileUrl,
    fileName,
  };
}

/**
 * Generate daily summary report
 */
async function generateDailySummary(date: Date): Promise<{
  date: string;
  orders: {
    total: number;
    completed: number;
    cancelled: number;
    pending: number;
  };
  revenue: {
    total: number;
    deliveryFees: number;
    avgOrderValue: number;
  };
  performance: {
    avgDeliveryTime: number;
    onTimeRate: number;
    completionRate: number;
  };
  drivers: {
    active: number;
    avgDeliveries: number;
  };
  hourlyBreakdown: Array<{
    hour: number;
    orders: number;
    revenue: number;
  }>;
}> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const deliveryKPIs = await getDeliveryKPIs('custom', {
    customRange: { start: startOfDay, end: endOfDay },
  });

  const driverKPIs = await getDriverKPIs('custom', {
    customRange: { start: startOfDay, end: endOfDay },
  });

  // Get hourly breakdown
  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('created_at, total_amount')
    .gte('created_at', startOfDay.toISOString())
    .lte('created_at', endOfDay.toISOString());

  const hourlyBreakdown: Array<{ hour: number; orders: number; revenue: number }> = [];
  for (let h = 0; h < 24; h++) {
    const hourOrders = orders?.filter((o) => new Date(o.created_at).getHours() === h) || [];
    hourlyBreakdown.push({
      hour: h,
      orders: hourOrders.length,
      revenue: hourOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
    });
  }

  return {
    date: formatDate(date),
    orders: {
      total: deliveryKPIs.totalOrders,
      completed: deliveryKPIs.completedOrders,
      cancelled: deliveryKPIs.cancelledOrders,
      pending: deliveryKPIs.pendingOrders,
    },
    revenue: {
      total: deliveryKPIs.totalRevenue,
      deliveryFees: deliveryKPIs.totalDeliveryFees,
      avgOrderValue: deliveryKPIs.avgOrderValue,
    },
    performance: {
      avgDeliveryTime: deliveryKPIs.avgDeliveryTime,
      onTimeRate: Math.round(deliveryKPIs.onTimeDeliveryRate * 10) / 10,
      completionRate: Math.round(deliveryKPIs.completionRate * 10) / 10,
    },
    drivers: {
      active: driverKPIs.activeDrivers,
      avgDeliveries: driverKPIs.avgDeliveriesPerDriver,
    },
    hourlyBreakdown,
  };
}

/**
 * Generate weekly summary report
 */
async function generateWeeklySummary(dateRange: { start: Date; end: Date }): Promise<{
  period: { start: string; end: string };
  summary: {
    totalOrders: number;
    totalRevenue: number;
    avgDailyOrders: number;
    avgDailyRevenue: number;
    completionRate: number;
    avgDeliveryTime: number;
  };
  dailyStats: Array<{
    date: string;
    orders: number;
    revenue: number;
    completionRate: number;
  }>;
  topMerchants: Array<{ name: string; orders: number; revenue: number }>;
  topDrivers: Array<{ name: string; deliveries: number; rating: number }>;
}> {
  const deliveryKPIs = await getDeliveryKPIs('custom', { customRange: dateRange });
  const merchantKPIs = await getMerchantKPIs('custom', { customRange: dateRange });
  const driverKPIs = await getDriverKPIs('custom', { customRange: dateRange });

  // Get daily stats
  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('created_at, total_amount, status')
    .gte('created_at', dateRange.start.toISOString())
    .lte('created_at', dateRange.end.toISOString());

  const dailyStatsMap: Record<string, { orders: number; revenue: number; completed: number }> = {};
  orders?.forEach((o) => {
    const date = o.created_at.split('T')[0];
    if (!dailyStatsMap[date]) {
      dailyStatsMap[date] = { orders: 0, revenue: 0, completed: 0 };
    }
    dailyStatsMap[date].orders++;
    dailyStatsMap[date].revenue += o.total_amount || 0;
    if (o.status === 'delivered') dailyStatsMap[date].completed++;
  });

  const dailyStats = Object.entries(dailyStatsMap)
    .map(([date, stats]) => ({
      date,
      orders: stats.orders,
      revenue: Math.round(stats.revenue * 100) / 100,
      completionRate: stats.orders > 0 ? Math.round((stats.completed / stats.orders) * 1000) / 10 : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const days = dailyStats.length || 1;

  return {
    period: {
      start: formatDate(dateRange.start),
      end: formatDate(dateRange.end),
    },
    summary: {
      totalOrders: deliveryKPIs.totalOrders,
      totalRevenue: deliveryKPIs.totalRevenue,
      avgDailyOrders: Math.round(deliveryKPIs.totalOrders / days),
      avgDailyRevenue: Math.round((deliveryKPIs.totalRevenue / days) * 100) / 100,
      completionRate: Math.round(deliveryKPIs.completionRate * 10) / 10,
      avgDeliveryTime: deliveryKPIs.avgDeliveryTime,
    },
    dailyStats,
    topMerchants: merchantKPIs.topMerchants.slice(0, 5).map((m) => ({
      name: m.name,
      orders: m.orders,
      revenue: Math.round(m.revenue * 100) / 100,
    })),
    topDrivers: driverKPIs.topPerformers.slice(0, 5).map((d) => ({
      name: d.name,
      deliveries: d.deliveries,
      rating: d.rating,
    })),
  };
}

/**
 * Generate monthly summary report
 */
async function generateMonthlySummary(dateRange: { start: Date; end: Date }) {
  const weeklyReport = await generateWeeklySummary(dateRange);

  // Add monthly specific metrics
  const financialKPIs = await getFinancialKPIs('custom', { customRange: dateRange });

  return {
    ...weeklyReport,
    financial: {
      grossRevenue: financialKPIs.grossRevenue,
      netRevenue: financialKPIs.netRevenue,
      totalCommissions: financialKPIs.totalCommissions,
      codCollected: financialKPIs.codCollected,
      revenueByPaymentMethod: financialKPIs.revenueByPaymentMethod,
    },
    weeklyTrend: financialKPIs.dailyRevenue,
  };
}

/**
 * Generate driver performance report
 */
async function generateDriverPerformanceReport(
  dateRange: { start: Date; end: Date },
  driverId?: string
): Promise<{
  period: { start: string; end: string };
  drivers: Array<{
    id: string;
    name: string;
    totalDeliveries: number;
    completedDeliveries: number;
    avgDeliveryTime: number;
    rating: number;
    earnings: number;
    acceptanceRate: number;
    onTimeRate: number;
  }>;
}> {
  let query = supabaseAdmin
    .from('orders')
    .select('driver_id, status, created_at, delivered_at, delivery_fee')
    .gte('created_at', dateRange.start.toISOString())
    .lte('created_at', dateRange.end.toISOString())
    .not('driver_id', 'is', null);

  if (driverId) {
    query = query.eq('driver_id', driverId);
  }

  const { data: orders } = await query;

  // Get driver info
  const driverIds = [...new Set(orders?.map((o) => o.driver_id) || [])];
  const { data: drivers } = await supabaseAdmin
    .from('drivers')
    .select('id, user_id, average_rating, users(full_name)')
    .in('id', driverIds);

  // Calculate per-driver stats
  const driverStats: Record<string, {
    total: number;
    completed: number;
    deliveryTimes: number[];
    earnings: number;
    onTime: number;
  }> = {};

  orders?.forEach((o) => {
    if (!driverStats[o.driver_id]) {
      driverStats[o.driver_id] = { total: 0, completed: 0, deliveryTimes: [], earnings: 0, onTime: 0 };
    }

    driverStats[o.driver_id].total++;

    if (o.status === 'delivered') {
      driverStats[o.driver_id].completed++;
      driverStats[o.driver_id].earnings += o.delivery_fee || 0;

      if (o.delivered_at && o.created_at) {
        const time = (new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) / 60000;
        if (time > 0 && time < 180) {
          driverStats[o.driver_id].deliveryTimes.push(time);
          if (time <= 45) driverStats[o.driver_id].onTime++;
        }
      }
    }
  });

  const driverReport = drivers?.map((d) => {
    const stats = driverStats[d.id] || { total: 0, completed: 0, deliveryTimes: [], earnings: 0, onTime: 0 };
    const avgTime = stats.deliveryTimes.length > 0
      ? stats.deliveryTimes.reduce((a, b) => a + b, 0) / stats.deliveryTimes.length
      : 0;

    return {
      id: d.id,
      name: (d.users as { full_name: string })?.full_name || 'Unknown',
      totalDeliveries: stats.total,
      completedDeliveries: stats.completed,
      avgDeliveryTime: Math.round(avgTime),
      rating: d.average_rating || 0,
      earnings: Math.round(stats.earnings * 100) / 100,
      acceptanceRate: 85, // Would need tracking
      onTimeRate: stats.completed > 0 ? Math.round((stats.onTime / stats.completed) * 1000) / 10 : 0,
    };
  }) || [];

  return {
    period: { start: formatDate(dateRange.start), end: formatDate(dateRange.end) },
    drivers: driverReport.sort((a, b) => b.completedDeliveries - a.completedDeliveries),
  };
}

/**
 * Generate merchant settlement report
 */
async function generateMerchantSettlementReport(
  dateRange: { start: Date; end: Date },
  merchantId?: string
): Promise<{
  period: { start: string; end: string };
  merchants: Array<{
    id: string;
    name: string;
    totalOrders: number;
    grossSales: number;
    commissionRate: number;
    commissionAmount: number;
    netPayable: number;
    codCollected: number;
    codToSettle: number;
  }>;
  summary: {
    totalGrossSales: number;
    totalCommissions: number;
    totalNetPayable: number;
  };
}> {
  let query = supabaseAdmin
    .from('orders')
    .select('merchant_id, total_amount, delivery_fee, is_cod, status')
    .eq('status', 'delivered')
    .gte('created_at', dateRange.start.toISOString())
    .lte('created_at', dateRange.end.toISOString());

  if (merchantId) {
    query = query.eq('merchant_id', merchantId);
  }

  const { data: orders } = await query;

  // Get merchant info
  const merchantIds = [...new Set(orders?.map((o) => o.merchant_id) || [])];
  const { data: merchants } = await supabaseAdmin
    .from('merchants')
    .select('id, business_name, commission_rate')
    .in('id', merchantIds);

  // Calculate per-merchant stats
  const merchantStats: Record<string, {
    orders: number;
    sales: number;
    cod: number;
  }> = {};

  orders?.forEach((o) => {
    if (!merchantStats[o.merchant_id]) {
      merchantStats[o.merchant_id] = { orders: 0, sales: 0, cod: 0 };
    }
    merchantStats[o.merchant_id].orders++;
    merchantStats[o.merchant_id].sales += o.total_amount || 0;
    if (o.is_cod) {
      merchantStats[o.merchant_id].cod += o.total_amount || 0;
    }
  });

  const defaultCommissionRate = 0.15;

  const merchantReport = merchants?.map((m) => {
    const stats = merchantStats[m.id] || { orders: 0, sales: 0, cod: 0 };
    const commissionRate = m.commission_rate || defaultCommissionRate;
    const commissionAmount = stats.sales * commissionRate;
    const netPayable = stats.sales - commissionAmount - stats.cod;

    return {
      id: m.id,
      name: m.business_name,
      totalOrders: stats.orders,
      grossSales: Math.round(stats.sales * 100) / 100,
      commissionRate: commissionRate * 100,
      commissionAmount: Math.round(commissionAmount * 100) / 100,
      netPayable: Math.round(netPayable * 100) / 100,
      codCollected: Math.round(stats.cod * 100) / 100,
      codToSettle: Math.round(stats.cod * 100) / 100,
    };
  }) || [];

  const summary = merchantReport.reduce(
    (acc, m) => ({
      totalGrossSales: acc.totalGrossSales + m.grossSales,
      totalCommissions: acc.totalCommissions + m.commissionAmount,
      totalNetPayable: acc.totalNetPayable + m.netPayable,
    }),
    { totalGrossSales: 0, totalCommissions: 0, totalNetPayable: 0 }
  );

  return {
    period: { start: formatDate(dateRange.start), end: formatDate(dateRange.end) },
    merchants: merchantReport.sort((a, b) => b.grossSales - a.grossSales),
    summary: {
      totalGrossSales: Math.round(summary.totalGrossSales * 100) / 100,
      totalCommissions: Math.round(summary.totalCommissions * 100) / 100,
      totalNetPayable: Math.round(summary.totalNetPayable * 100) / 100,
    },
  };
}

/**
 * Generate financial reconciliation report
 */
async function generateFinancialReconciliation(dateRange: { start: Date; end: Date }) {
  const financial = await getFinancialKPIs('custom', { customRange: dateRange });

  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('payment_method, payment_status, total_amount, delivery_fee')
    .gte('created_at', dateRange.start.toISOString())
    .lte('created_at', dateRange.end.toISOString());

  // Payment status breakdown
  const paymentStatusBreakdown: Record<string, { count: number; amount: number }> = {};
  orders?.forEach((o) => {
    const status = o.payment_status || 'unknown';
    if (!paymentStatusBreakdown[status]) {
      paymentStatusBreakdown[status] = { count: 0, amount: 0 };
    }
    paymentStatusBreakdown[status].count++;
    paymentStatusBreakdown[status].amount += o.total_amount || 0;
  });

  return {
    period: { start: formatDate(dateRange.start), end: formatDate(dateRange.end) },
    summary: {
      grossRevenue: financial.grossRevenue,
      netRevenue: financial.netRevenue,
      totalDeliveryFees: financial.totalDeliveryFees,
      totalCommissions: financial.totalCommissions,
    },
    revenueByPaymentMethod: financial.revenueByPaymentMethod,
    paymentStatusBreakdown,
    cod: {
      collected: financial.codCollected,
      pending: financial.codPending,
    },
    dailyRevenue: financial.dailyRevenue,
  };
}

/**
 * Generate COD collection report
 */
async function generateCODCollectionReport(
  dateRange: { start: Date; end: Date },
  driverId?: string
) {
  let query = supabaseAdmin
    .from('orders')
    .select('id, driver_id, total_amount, status, delivered_at, drivers(users(full_name))')
    .eq('is_cod', true)
    .gte('created_at', dateRange.start.toISOString())
    .lte('created_at', dateRange.end.toISOString());

  if (driverId) {
    query = query.eq('driver_id', driverId);
  }

  const { data: orders } = await query;

  // Group by driver
  const driverCOD: Record<string, {
    name: string;
    collected: number;
    pending: number;
    deposited: number;
    orders: number;
  }> = {};

  orders?.forEach((o) => {
    const id = o.driver_id || 'unassigned';
    if (!driverCOD[id]) {
      const driver = o.drivers as { users: { full_name: string } } | null;
      driverCOD[id] = {
        name: driver?.users?.full_name || 'Unassigned',
        collected: 0,
        pending: 0,
        deposited: 0,
        orders: 0,
      };
    }

    driverCOD[id].orders++;
    if (o.status === 'delivered') {
      driverCOD[id].collected += o.total_amount || 0;
    } else if (o.status !== 'cancelled') {
      driverCOD[id].pending += o.total_amount || 0;
    }
  });

  const totalCollected = Object.values(driverCOD).reduce((sum, d) => sum + d.collected, 0);
  const totalPending = Object.values(driverCOD).reduce((sum, d) => sum + d.pending, 0);

  return {
    period: { start: formatDate(dateRange.start), end: formatDate(dateRange.end) },
    summary: {
      totalCollected: Math.round(totalCollected * 100) / 100,
      totalPending: Math.round(totalPending * 100) / 100,
      totalOrders: orders?.length || 0,
    },
    byDriver: Object.entries(driverCOD).map(([id, stats]) => ({
      driverId: id,
      ...stats,
      collected: Math.round(stats.collected * 100) / 100,
      pending: Math.round(stats.pending * 100) / 100,
    })),
  };
}

/**
 * Generate delivery analysis report
 */
async function generateDeliveryAnalysisReport(
  dateRange: { start: Date; end: Date },
  filters?: { merchantId?: string; zoneId?: string }
) {
  const deliveryKPIs = await getDeliveryKPIs('custom', {
    customRange: dateRange,
    merchantId: filters?.merchantId,
    zoneId: filters?.zoneId,
  });

  return {
    period: { start: formatDate(dateRange.start), end: formatDate(dateRange.end) },
    overview: {
      totalOrders: deliveryKPIs.totalOrders,
      completedOrders: deliveryKPIs.completedOrders,
      cancelledOrders: deliveryKPIs.cancelledOrders,
      completionRate: Math.round(deliveryKPIs.completionRate * 10) / 10,
      cancellationRate: Math.round(deliveryKPIs.cancellationRate * 10) / 10,
    },
    performance: {
      avgDeliveryTime: deliveryKPIs.avgDeliveryTime,
      onTimeDeliveryRate: Math.round(deliveryKPIs.onTimeDeliveryRate * 10) / 10,
    },
    revenue: {
      totalRevenue: deliveryKPIs.totalRevenue,
      avgOrderValue: deliveryKPIs.avgOrderValue,
      totalDeliveryFees: deliveryKPIs.totalDeliveryFees,
    },
    hourlyDistribution: deliveryKPIs.ordersPerHour,
    statusBreakdown: deliveryKPIs.ordersByStatus,
  };
}

/**
 * Generate zone performance report
 */
async function generateZonePerformanceReport(
  dateRange: { start: Date; end: Date },
  zoneId?: string
) {
  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('zone_id, total_amount, status, created_at, delivered_at')
    .gte('created_at', dateRange.start.toISOString())
    .lte('created_at', dateRange.end.toISOString())
    .not('zone_id', 'is', null);

  // Get zone info
  const zoneIds = zoneId ? [zoneId] : [...new Set(orders?.map((o) => o.zone_id) || [])];
  const { data: zones } = await supabaseAdmin
    .from('geofence_zones')
    .select('id, name, type')
    .in('id', zoneIds);

  // Calculate per-zone stats
  const zoneStats: Record<string, {
    orders: number;
    completed: number;
    revenue: number;
    deliveryTimes: number[];
  }> = {};

  orders?.forEach((o) => {
    if (!zoneStats[o.zone_id]) {
      zoneStats[o.zone_id] = { orders: 0, completed: 0, revenue: 0, deliveryTimes: [] };
    }
    zoneStats[o.zone_id].orders++;
    zoneStats[o.zone_id].revenue += o.total_amount || 0;

    if (o.status === 'delivered') {
      zoneStats[o.zone_id].completed++;
      if (o.delivered_at && o.created_at) {
        const time = (new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) / 60000;
        if (time > 0 && time < 180) {
          zoneStats[o.zone_id].deliveryTimes.push(time);
        }
      }
    }
  });

  const zoneReport = zones?.map((z) => {
    const stats = zoneStats[z.id] || { orders: 0, completed: 0, revenue: 0, deliveryTimes: [] };
    const avgTime = stats.deliveryTimes.length > 0
      ? stats.deliveryTimes.reduce((a, b) => a + b, 0) / stats.deliveryTimes.length
      : 0;

    return {
      id: z.id,
      name: z.name,
      type: z.type,
      totalOrders: stats.orders,
      completedOrders: stats.completed,
      completionRate: stats.orders > 0 ? Math.round((stats.completed / stats.orders) * 1000) / 10 : 0,
      revenue: Math.round(stats.revenue * 100) / 100,
      avgDeliveryTime: Math.round(avgTime),
    };
  }) || [];

  return {
    period: { start: formatDate(dateRange.start), end: formatDate(dateRange.end) },
    zones: zoneReport.sort((a, b) => b.totalOrders - a.totalOrders),
  };
}

/**
 * Schedule a report for automatic generation
 */
export async function scheduleReport(config: {
  type: ReportType;
  format: ExportFormat;
  schedule: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  filters?: Record<string, unknown>;
}): Promise<ScheduledReport> {
  const nextRun = calculateNextRun(config.schedule);

  const { data, error } = await supabaseAdmin
    .from('scheduled_reports')
    .insert({
      type: config.type,
      format: config.format,
      schedule: config.schedule,
      recipients: config.recipients,
      filters: config.filters || {},
      is_active: true,
      next_run_at: nextRun.toISOString(),
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to schedule report', { error });
    throw new Error('Failed to schedule report');
  }

  return {
    id: data.id,
    type: data.type,
    format: data.format,
    schedule: data.schedule,
    recipients: data.recipients,
    filters: data.filters,
    isActive: data.is_active,
    nextRunAt: new Date(data.next_run_at),
  };
}

/**
 * Get scheduled reports
 */
export async function getScheduledReports(): Promise<ScheduledReport[]> {
  const { data } = await supabaseAdmin
    .from('scheduled_reports')
    .select('*')
    .eq('is_active', true);

  return (data || []).map((r) => ({
    id: r.id,
    type: r.type,
    format: r.format,
    schedule: r.schedule,
    recipients: r.recipients,
    filters: r.filters,
    isActive: r.is_active,
    lastRunAt: r.last_run_at ? new Date(r.last_run_at) : undefined,
    nextRunAt: new Date(r.next_run_at),
  }));
}

/**
 * Run scheduled reports that are due
 */
export async function runDueReports(): Promise<number> {
  const now = new Date();

  const { data: dueReports } = await supabaseAdmin
    .from('scheduled_reports')
    .select('*')
    .eq('is_active', true)
    .lte('next_run_at', now.toISOString());

  let generated = 0;

  for (const report of dueReports || []) {
    try {
      const dateRange = getReportDateRange(report.schedule);

      await generateReport({
        type: report.type,
        format: report.format,
        dateRange,
        filters: report.filters,
        recipients: report.recipients,
        scheduleId: report.id,
      });

      // Update schedule
      const nextRun = calculateNextRun(report.schedule);
      await supabaseAdmin
        .from('scheduled_reports')
        .update({
          last_run_at: now.toISOString(),
          next_run_at: nextRun.toISOString(),
        })
        .eq('id', report.id);

      generated++;
    } catch (error) {
      logger.error('Failed to run scheduled report', { reportId: report.id, error });
    }
  }

  return generated;
}

// Helper functions

function generateReportId(): string {
  return `rpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function calculateNextRun(schedule: 'daily' | 'weekly' | 'monthly'): Date {
  const next = new Date();
  next.setHours(6, 0, 0, 0); // Run at 6 AM

  switch (schedule) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + (8 - next.getDay()) % 7 || 7); // Next Monday
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
      break;
  }

  return next;
}

function getReportDateRange(schedule: 'daily' | 'weekly' | 'monthly'): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() - 1); // Yesterday

  const start = new Date(end);
  start.setHours(0, 0, 0, 0);

  switch (schedule) {
    case 'daily':
      break;
    case 'weekly':
      start.setDate(start.getDate() - 6);
      break;
    case 'monthly':
      start.setMonth(start.getMonth() - 1);
      start.setDate(start.getDate() + 1);
      break;
  }

  return { start, end };
}

function convertToCSV(data: unknown, reportType: string): string {
  // Simplified CSV conversion - would need proper implementation per report type
  const rows: string[][] = [];

  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;

    // Handle arrays
    if (Array.isArray(obj)) {
      if (obj.length > 0 && typeof obj[0] === 'object') {
        rows.push(Object.keys(obj[0] as object));
        obj.forEach((item) => {
          rows.push(Object.values(item as object).map(String));
        });
      }
    } else {
      // Handle nested objects by flattening
      Object.entries(obj).forEach(([key, value]) => {
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
          rows.push([`--- ${key} ---`]);
          rows.push(Object.keys(value[0] as object));
          value.forEach((item) => {
            rows.push(Object.values(item as object).map(String));
          });
          rows.push([]);
        } else if (typeof value === 'object' && value !== null) {
          Object.entries(value as object).forEach(([k, v]) => {
            rows.push([`${key}.${k}`, String(v)]);
          });
        } else {
          rows.push([key, String(value)]);
        }
      });
    }
  }

  return rows.map((row) => row.join(',')).join('\n');
}

async function uploadReport(content: string, fileName: string, contentType: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from('reports')
    .upload(`generated/${fileName}`, content, { contentType });

  if (error) {
    logger.error('Failed to upload report', { error, fileName });
    throw new Error('Failed to upload report');
  }

  const { data: urlData } = supabaseAdmin.storage
    .from('reports')
    .getPublicUrl(`generated/${fileName}`);

  return urlData.publicUrl;
}
