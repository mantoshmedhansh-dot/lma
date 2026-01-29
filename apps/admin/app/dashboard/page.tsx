'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ShoppingBagIcon,
  TruckIcon,
  CurrencyRupeeIcon,
  ClockIcon,
  UsersIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline';
import {
  MetricCard,
  OrdersChart,
  LiveStatusPanel,
  DataTable,
  AlertsPanel,
} from '@/components/dashboard';

interface DashboardData {
  kpis: {
    totalOrders: number;
    totalRevenue: number;
    completionRate: number;
    avgDeliveryTime: number;
    activeDrivers: number;
    activeMerchants: number;
  };
  changes: {
    orders: number;
    revenue: number;
    completionRate: number;
    avgDeliveryTime: number;
  };
  chartData: Array<{ date: string; orders: number; revenue: number }>;
  liveStats: {
    totalActive: number;
    byStatus: Record<string, number>;
    avgWaitTime: number;
    oldestPendingMinutes: number;
    recentlyCompleted: number;
    recentlyCancelled: number;
  };
  driverStats: {
    totalOnline: number;
    totalOnDelivery: number;
    totalIdle: number;
    totalOffline: number;
  };
  topMerchants: Array<{
    id: string;
    name: string;
    orders: number;
    revenue: number;
    rating: number;
  }>;
  alerts: Array<{
    id: string;
    type: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    message: string;
    data?: Record<string, unknown>;
    timestamp: Date;
    acknowledged: boolean;
  }>;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [data, setData] = useState<DashboardData | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      // In production, these would be actual API calls
      // Simulating data for demo
      const mockData: DashboardData = {
        kpis: {
          totalOrders: 1247,
          totalRevenue: 485230,
          completionRate: 94.5,
          avgDeliveryTime: 32,
          activeDrivers: 45,
          activeMerchants: 128,
        },
        changes: {
          orders: 12.5,
          revenue: 8.3,
          completionRate: 2.1,
          avgDeliveryTime: -5.2,
        },
        chartData: generateMockChartData(period),
        liveStats: {
          totalActive: 23,
          byStatus: {
            pending: 5,
            confirmed: 4,
            preparing: 6,
            ready_for_pickup: 3,
            in_transit: 5,
          },
          avgWaitTime: 18,
          oldestPendingMinutes: 25,
          recentlyCompleted: 8,
          recentlyCancelled: 1,
        },
        driverStats: {
          totalOnline: 28,
          totalOnDelivery: 17,
          totalIdle: 8,
          totalOffline: 12,
        },
        topMerchants: [
          { id: '1', name: 'Biryani House', orders: 156, revenue: 78500, rating: 4.8 },
          { id: '2', name: 'Pizza Palace', orders: 134, revenue: 65200, rating: 4.6 },
          { id: '3', name: 'Burger King', orders: 128, revenue: 51200, rating: 4.5 },
          { id: '4', name: 'Dosa Corner', orders: 112, revenue: 33600, rating: 4.7 },
          { id: '5', name: 'Chinese Dragon', orders: 98, revenue: 58800, rating: 4.4 },
        ],
        alerts: [
          {
            id: '1',
            type: 'driver_shortage',
            severity: 'warning',
            title: 'Driver Shortage',
            message: '15 pending orders with only 8 available drivers',
            data: { pendingOrders: 15, availableDrivers: 8 },
            timestamp: new Date(Date.now() - 5 * 60 * 1000),
            acknowledged: false,
          },
          {
            id: '2',
            type: 'high_cancellation',
            severity: 'info',
            title: 'Cancellation Rate Normal',
            message: 'Cancellation rate has returned to normal levels',
            timestamp: new Date(Date.now() - 30 * 60 * 1000),
            acknowledged: true,
          },
        ],
      };

      setData(mockData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleAcknowledgeAlert = async (alertId: string) => {
    if (!data) return;

    setData({
      ...data,
      alerts: data.alerts.map((a) =>
        a.id === alertId ? { ...a, acknowledged: true } : a
      ),
    });

    // In production: await api.acknowledgeAlert(alertId);
  };

  const refreshLiveData = useCallback(async () => {
    // In production: fetch live stats
    console.log('Refreshing live data...');
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Welcome back! Here's what's happening.</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as 'today' | 'week' | 'month')}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <MetricCard
          title="Total Orders"
          value={data?.kpis.totalOrders.toLocaleString() || '-'}
          change={data?.changes.orders}
          changeLabel="vs last period"
          icon={<ShoppingBagIcon className="h-6 w-6" />}
          loading={loading}
        />
        <MetricCard
          title="Revenue"
          value={`₹${((data?.kpis.totalRevenue || 0) / 1000).toFixed(1)}K`}
          change={data?.changes.revenue}
          changeLabel="vs last period"
          icon={<CurrencyRupeeIcon className="h-6 w-6" />}
          variant="success"
          loading={loading}
        />
        <MetricCard
          title="Completion Rate"
          value={`${data?.kpis.completionRate || 0}%`}
          change={data?.changes.completionRate}
          changeLabel="vs last period"
          icon={<TruckIcon className="h-6 w-6" />}
          variant={
            (data?.kpis.completionRate || 0) > 90
              ? 'success'
              : (data?.kpis.completionRate || 0) > 80
              ? 'warning'
              : 'danger'
          }
          loading={loading}
        />
        <MetricCard
          title="Avg Delivery"
          value={`${data?.kpis.avgDeliveryTime || 0} min`}
          change={data?.changes.avgDeliveryTime}
          changeLabel="vs last period"
          icon={<ClockIcon className="h-6 w-6" />}
          loading={loading}
        />
        <MetricCard
          title="Active Drivers"
          value={data?.kpis.activeDrivers || 0}
          subtitle="Currently online"
          icon={<UsersIcon className="h-6 w-6" />}
          loading={loading}
        />
        <MetricCard
          title="Merchants"
          value={data?.kpis.activeMerchants || 0}
          subtitle="Active this period"
          icon={<BuildingStorefrontIcon className="h-6 w-6" />}
          loading={loading}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Chart */}
        <div className="lg:col-span-2">
          <OrdersChart
            data={data?.chartData || []}
            showRevenue
            height={350}
            loading={loading}
          />
        </div>

        {/* Live Status */}
        <div>
          {data && (
            <LiveStatusPanel
              orderStats={data.liveStats}
              driverStats={data.driverStats}
              onRefresh={refreshLiveData}
            />
          )}
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Merchants Table */}
        <DataTable
          title="Top Merchants"
          data={data?.topMerchants || []}
          keyField="id"
          loading={loading}
          columns={[
            { key: 'name', header: 'Merchant', sortable: true },
            {
              key: 'orders',
              header: 'Orders',
              sortable: true,
              render: (value) => <span className="font-medium">{String(value)}</span>,
            },
            {
              key: 'revenue',
              header: 'Revenue',
              sortable: true,
              render: (value) => `₹${(Number(value) / 1000).toFixed(1)}K`,
            },
            {
              key: 'rating',
              header: 'Rating',
              render: (value) => (
                <span className="inline-flex items-center">
                  <span className="text-yellow-500 mr-1">★</span>
                  {Number(value).toFixed(1)}
                </span>
              ),
            },
          ]}
          pagination={false}
        />

        {/* Alerts Panel */}
        <AlertsPanel
          alerts={data?.alerts || []}
          onAcknowledge={handleAcknowledgeAlert}
          loading={loading}
        />
      </div>
    </div>
  );
}

function generateMockChartData(period: string): Array<{ date: string; orders: number; revenue: number }> {
  const data: Array<{ date: string; orders: number; revenue: number }> = [];
  const days = period === 'today' ? 1 : period === 'week' ? 7 : 30;
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().split('T')[0],
      orders: Math.floor(Math.random() * 100) + 100,
      revenue: Math.floor(Math.random() * 50000) + 30000,
    });
  }

  return data;
}
