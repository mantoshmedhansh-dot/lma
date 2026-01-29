'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Users,
  Store,
  Calendar,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const COLORS = ['#7c3aed', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];

type Period = '7d' | '30d' | '90d';

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    previousRevenue: 0,
    totalOrders: 0,
    previousOrders: 0,
    avgOrderValue: 0,
    newCustomers: 0,
    newMerchants: 0,
    newDrivers: 0,
  });
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [topMerchants, setTopMerchants] = useState<any[]>([]);
  const [ordersByType, setOrdersByType] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const now = new Date();
      const startDate = new Date();
      startDate.setDate(now.getDate() - days);
      const previousStart = new Date(startDate);
      previousStart.setDate(previousStart.getDate() - days);

      // Fetch orders for current period
      const { data: currentOrders } = await supabase
        .from('orders')
        .select('total_amount, created_at, status, merchant_id')
        .gte('created_at', startDate.toISOString())
        .eq('status', 'delivered');

      // Fetch orders for previous period
      const { data: previousOrders } = await supabase
        .from('orders')
        .select('total_amount')
        .gte('created_at', previousStart.toISOString())
        .lt('created_at', startDate.toISOString())
        .eq('status', 'delivered');

      // Calculate stats
      const totalRevenue = currentOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
      const previousRevenue = previousOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
      const totalOrders = currentOrders?.length || 0;
      const previousOrderCount = previousOrders?.length || 0;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // New users counts
      const [usersRes, merchantsRes, driversRes] = await Promise.all([
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startDate.toISOString())
          .eq('role', 'customer'),
        supabase
          .from('merchants')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startDate.toISOString()),
        supabase
          .from('drivers')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startDate.toISOString()),
      ]);

      setStats({
        totalRevenue,
        previousRevenue,
        totalOrders,
        previousOrders: previousOrderCount,
        avgOrderValue,
        newCustomers: usersRes.count || 0,
        newMerchants: merchantsRes.count || 0,
        newDrivers: driversRes.count || 0,
      });

      // Daily data
      const dailyMap = new Map<string, { revenue: number; orders: number }>();
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyMap.set(dateStr, { revenue: 0, orders: 0 });
      }

      currentOrders?.forEach((order) => {
        const dateStr = order.created_at.split('T')[0];
        if (dailyMap.has(dateStr)) {
          const current = dailyMap.get(dateStr)!;
          dailyMap.set(dateStr, {
            revenue: current.revenue + (order.total_amount || 0),
            orders: current.orders + 1,
          });
        }
      });

      const dailyDataArray = Array.from(dailyMap.entries())
        .map(([date, data]) => ({
          date: new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
          ...data,
        }))
        .reverse();

      setDailyData(dailyDataArray);

      // Top merchants
      const merchantRevenue = new Map<string, number>();
      currentOrders?.forEach((order) => {
        if (order.merchant_id) {
          merchantRevenue.set(
            order.merchant_id,
            (merchantRevenue.get(order.merchant_id) || 0) + (order.total_amount || 0)
          );
        }
      });

      const topMerchantIds = Array.from(merchantRevenue.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id);

      if (topMerchantIds.length > 0) {
        const { data: merchantNames } = await supabase
          .from('merchants')
          .select('id, name, type')
          .in('id', topMerchantIds);

        const topMerchantsData = topMerchantIds.map((id) => {
          const merchant = merchantNames?.find((m) => m.id === id);
          return {
            name: merchant?.name || 'Unknown',
            type: merchant?.type || 'other',
            revenue: merchantRevenue.get(id) || 0,
          };
        });

        setTopMerchants(topMerchantsData);
      }

      // Orders by merchant type
      const { data: allMerchants } = await supabase.from('merchants').select('id, type');
      const merchantTypes = new Map<string, string>();
      allMerchants?.forEach((m) => merchantTypes.set(m.id, m.type));

      const typeRevenue = new Map<string, number>();
      currentOrders?.forEach((order) => {
        const type = merchantTypes.get(order.merchant_id) || 'other';
        typeRevenue.set(type, (typeRevenue.get(type) || 0) + (order.total_amount || 0));
      });

      setOrdersByType(
        Array.from(typeRevenue.entries()).map(([type, revenue]) => ({
          name: type.charAt(0).toUpperCase() + type.slice(1),
          value: revenue,
        }))
      );
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const revenueChange = stats.previousRevenue > 0
    ? ((stats.totalRevenue - stats.previousRevenue) / stats.previousRevenue) * 100
    : 0;

  const ordersChange = stats.previousOrders > 0
    ? ((stats.totalOrders - stats.previousOrders) / stats.previousOrders) * 100
    : 0;

  return (
    <div>
      <Header title="Analytics" description="Platform performance and insights" />

      <div className="p-6 space-y-6">
        {/* Period Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <div className="flex gap-2">
            {(['7d', '30d', '90d'] as Period[]).map((p) => (
              <Button
                key={p}
                variant={period === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p)}
              >
                {p === '7d' ? 'Last 7 Days' : p === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
              </Button>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                  <div className={`flex items-center text-sm mt-1 ${revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {revenueChange >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                    {Math.abs(revenueChange).toFixed(1)}% vs previous
                  </div>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold">{formatNumber(stats.totalOrders)}</p>
                  <div className={`flex items-center text-sm mt-1 ${ordersChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {ordersChange >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                    {Math.abs(ordersChange).toFixed(1)}% vs previous
                  </div>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <ShoppingBag className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Order Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.avgOrderValue)}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">New Customers</p>
                  <p className="text-2xl font-bold">{formatNumber(stats.newCustomers)}</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <Users className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                    <Tooltip formatter={(value: number) => [formatCurrency(value), 'Revenue']} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#7c3aed"
                      fill="#7c3aed"
                      fillOpacity={0.1}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Orders Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Orders Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="orders" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Merchants */}
          <Card>
            <CardHeader>
              <CardTitle>Top Merchants</CardTitle>
            </CardHeader>
            <CardContent>
              {topMerchants.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No data available
                </div>
              ) : (
                <div className="space-y-4">
                  {topMerchants.map((merchant, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{merchant.name}</p>
                        <p className="text-sm text-muted-foreground capitalize">{merchant.type}</p>
                      </div>
                      <p className="font-semibold">{formatCurrency(merchant.revenue)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Revenue by Category */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {ordersByType.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No data available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ordersByType}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {ordersByType.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Growth Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">New Customers</p>
                  <p className="text-2xl font-bold">{formatNumber(stats.newCustomers)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-full">
                  <Store className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">New Merchants</p>
                  <p className="text-2xl font-bold">{formatNumber(stats.newMerchants)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">New Drivers</p>
                  <p className="text-2xl font-bold">{formatNumber(stats.newDrivers)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
