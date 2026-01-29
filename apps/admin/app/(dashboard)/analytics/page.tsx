'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Users,
  Star,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  totalCustomers: number;
  rating: number;
  totalReviews: number;
  revenueChange: number;
  ordersChange: number;
}

interface DailyData {
  date: string;
  revenue: number;
  orders: number;
}

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

interface OrdersByStatus {
  status: string;
  count: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    totalCustomers: 0,
    rating: 0,
    totalReviews: 0,
    revenueChange: 0,
    ordersChange: 0,
  });
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [ordersByStatus, setOrdersByStatus] = useState<OrdersByStatus[]>([]);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: merchant } = await supabase
        .from('merchants')
        .select('id, rating, total_reviews')
        .eq('owner_id', user.id)
        .single();

      if (!merchant) return;

      const daysAgo = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      const startDateStr = startDate.toISOString();

      const previousStartDate = new Date(startDate);
      previousStartDate.setDate(previousStartDate.getDate() - daysAgo);
      const previousStartDateStr = previousStartDate.toISOString();

      // Fetch current period orders
      const { data: currentOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id, total_amount, status, created_at, customer_id')
        .eq('merchant_id', merchant.id)
        .gte('created_at', startDateStr);

      if (ordersError) throw ordersError;

      // Fetch previous period orders for comparison
      const { data: previousOrders } = await supabase
        .from('orders')
        .select('id, total_amount')
        .eq('merchant_id', merchant.id)
        .gte('created_at', previousStartDateStr)
        .lt('created_at', startDateStr);

      // Calculate metrics
      const completedOrders = currentOrders?.filter(o => o.status === 'delivered') || [];
      const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total_amount, 0);
      const totalOrders = currentOrders?.length || 0;
      const averageOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

      const uniqueCustomers = new Set(currentOrders?.map(o => o.customer_id) || []);
      const totalCustomers = uniqueCustomers.size;

      // Previous period metrics
      const previousCompletedOrders = previousOrders?.filter(o => true) || [];
      const previousRevenue = previousCompletedOrders.reduce((sum, o) => sum + o.total_amount, 0);
      const previousOrderCount = previousOrders?.length || 0;

      const revenueChange = previousRevenue > 0
        ? ((totalRevenue - previousRevenue) / previousRevenue) * 100
        : 0;
      const ordersChange = previousOrderCount > 0
        ? ((totalOrders - previousOrderCount) / previousOrderCount) * 100
        : 0;

      setAnalytics({
        totalRevenue,
        totalOrders,
        averageOrderValue,
        totalCustomers,
        rating: merchant.rating || 0,
        totalReviews: merchant.total_reviews || 0,
        revenueChange,
        ordersChange,
      });

      // Calculate daily data for chart
      const dailyMap = new Map<string, { revenue: number; orders: number }>();
      for (let i = 0; i < daysAgo; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyMap.set(dateStr, { revenue: 0, orders: 0 });
      }

      currentOrders?.forEach(order => {
        const dateStr = order.created_at.split('T')[0];
        if (dailyMap.has(dateStr)) {
          const current = dailyMap.get(dateStr)!;
          dailyMap.set(dateStr, {
            revenue: current.revenue + (order.status === 'delivered' ? order.total_amount : 0),
            orders: current.orders + 1,
          });
        }
      });

      const sortedDailyData = Array.from(dailyMap.entries())
        .map(([date, data]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          ...data,
        }))
        .reverse();

      setDailyData(sortedDailyData);

      // Fetch top products
      const { data: orderItems } = await supabase
        .from('order_items')
        .select(`
          quantity,
          unit_price,
          product:products(name),
          order:orders!inner(merchant_id, created_at, status)
        `)
        .eq('order.merchant_id', merchant.id)
        .gte('order.created_at', startDateStr);

      const productMap = new Map<string, { quantity: number; revenue: number }>();
      orderItems?.forEach(item => {
        const productName = item.product?.name || 'Unknown';
        const current = productMap.get(productName) || { quantity: 0, revenue: 0 };
        productMap.set(productName, {
          quantity: current.quantity + item.quantity,
          revenue: current.revenue + (item.unit_price * item.quantity),
        });
      });

      const sortedProducts = Array.from(productMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setTopProducts(sortedProducts);

      // Orders by status
      const statusMap = new Map<string, number>();
      currentOrders?.forEach(order => {
        statusMap.set(order.status, (statusMap.get(order.status) || 0) + 1);
      });

      setOrdersByStatus(
        Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }))
      );

    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load analytics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => `₹${value.toFixed(0)}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Track your store's performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as '7d' | '30d' | '90d')}
            className="h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Revenue</span>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-2">
            ₹{analytics.totalRevenue.toLocaleString()}
          </p>
          <div className={`flex items-center gap-1 text-xs mt-1 ${
            analytics.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {analytics.revenueChange >= 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {Math.abs(analytics.revenueChange).toFixed(1)}% from last period
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-2">{analytics.totalOrders}</p>
          <div className={`flex items-center gap-1 text-xs mt-1 ${
            analytics.ordersChange >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {analytics.ordersChange >= 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {Math.abs(analytics.ordersChange).toFixed(1)}% from last period
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Avg Order Value</span>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-2">
            ₹{analytics.averageOrderValue.toFixed(0)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {analytics.totalCustomers} unique customers
          </p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Rating</span>
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          </div>
          <p className="text-2xl font-bold mt-2">
            {analytics.rating.toFixed(1)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {analytics.totalReviews} reviews
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-4">Revenue Over Time</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  tickFormatter={formatCurrency}
                />
                <Tooltip
                  formatter={(value: number) => [`₹${value.toFixed(2)}`, 'Revenue']}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders Chart */}
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-4">Orders Over Time</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                <Tooltip />
                <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-4">Top Products</h3>
          {topProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No product data available
            </div>
          ) : (
            <div className="space-y-3">
              {topProducts.map((product, index) => (
                <div key={product.name} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-medium">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.quantity} sold
                    </p>
                  </div>
                  <span className="font-semibold">
                    ₹{product.revenue.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Orders by Status */}
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-4">Orders by Status</h3>
          {ordersByStatus.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No order data available
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ordersByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="status"
                    label={({ status, count }) => `${status}: ${count}`}
                  >
                    {ordersByStatus.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
