'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatNumber } from '@/lib/utils';
import {
  Users,
  Store,
  Truck,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
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

interface Stats {
  totalUsers: number;
  totalMerchants: number;
  activeMerchants: number;
  pendingMerchants: number;
  totalDrivers: number;
  activeDrivers: number;
  totalOrders: number;
  todayOrders: number;
  totalRevenue: number;
  todayRevenue: number;
}

const COLORS = ['#7c3aed', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalMerchants: 0,
    activeMerchants: 0,
    pendingMerchants: 0,
    totalDrivers: 0,
    activeDrivers: 0,
    totalOrders: 0,
    todayOrders: 0,
    totalRevenue: 0,
    todayRevenue: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [ordersByStatus, setOrdersByStatus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();

      // Fetch counts
      const [usersRes, merchantsRes, driversRes, ordersRes, todayOrdersRes] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('merchants').select('id, status', { count: 'exact' }),
        supabase.from('drivers').select('id, status', { count: 'exact' }),
        supabase.from('orders').select('id, total_amount', { count: 'exact' }),
        supabase.from('orders').select('id, total_amount').gte('created_at', todayStr),
      ]);

      const merchants = merchantsRes.data || [];
      const drivers = driversRes.data || [];
      const orders = ordersRes.data || [];
      const todayOrders = todayOrdersRes.data || [];

      const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

      setStats({
        totalUsers: usersRes.count || 0,
        totalMerchants: merchantsRes.count || 0,
        activeMerchants: merchants.filter((m) => m.status === 'active').length,
        pendingMerchants: merchants.filter((m) => m.status === 'pending').length,
        totalDrivers: driversRes.count || 0,
        activeDrivers: drivers.filter((d) => d.status === 'online' || d.status === 'busy').length,
        totalOrders: ordersRes.count || 0,
        todayOrders: todayOrders.length,
        totalRevenue,
        todayRevenue,
      });

      // Fetch recent orders
      const { data: recent } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total_amount,
          created_at,
          merchant:merchants(name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentOrders(recent || []);

      // Fetch daily stats for last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: dailyOrders } = await supabase
        .from('orders')
        .select('total_amount, created_at')
        .gte('created_at', sevenDaysAgo.toISOString());

      // Group by day
      const dailyMap = new Map<string, { revenue: number; orders: number }>();
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyMap.set(dateStr, { revenue: 0, orders: 0 });
      }

      dailyOrders?.forEach((order) => {
        const dateStr = order.created_at.split('T')[0];
        if (dailyMap.has(dateStr)) {
          const current = dailyMap.get(dateStr)!;
          dailyMap.set(dateStr, {
            revenue: current.revenue + (order.total_amount || 0),
            orders: current.orders + 1,
          });
        }
      });

      const dailyData = Array.from(dailyMap.entries())
        .map(([date, data]) => ({
          date: new Date(date).toLocaleDateString('en', { weekday: 'short' }),
          ...data,
        }))
        .reverse();

      setDailyStats(dailyData);

      // Orders by status
      const { data: statusOrders } = await supabase
        .from('orders')
        .select('status');

      const statusMap = new Map<string, number>();
      statusOrders?.forEach((order) => {
        statusMap.set(order.status, (statusMap.get(order.status) || 0) + 1);
      });

      setOrdersByStatus(
        Array.from(statusMap.entries()).map(([status, count]) => ({
          name: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
          value: count,
        }))
      );
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Users',
      value: formatNumber(stats.totalUsers),
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Merchants',
      value: formatNumber(stats.totalMerchants),
      subtitle: `${stats.pendingMerchants} pending`,
      icon: Store,
      color: 'text-purple-500',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Drivers',
      value: formatNumber(stats.totalDrivers),
      subtitle: `${stats.activeDrivers} online`,
      icon: Truck,
      color: 'text-green-500',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Total Orders',
      value: formatNumber(stats.totalOrders),
      subtitle: `${stats.todayOrders} today`,
      icon: ShoppingBag,
      color: 'text-orange-500',
      bgColor: 'bg-orange-100',
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-100',
    },
    {
      title: "Today's Revenue",
      value: formatCurrency(stats.todayRevenue),
      icon: TrendingUp,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-100',
    },
  ];

  return (
    <div>
      <Header title="Dashboard" description="Platform overview and analytics" />

      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                      {stat.subtitle && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {stat.subtitle}
                        </p>
                      )}
                    </div>
                    <div className={`p-3 rounded-full ${stat.bgColor}`}>
                      <Icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Orders Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Orders (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
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
          {/* Recent Orders */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No orders yet
                  </p>
                ) : (
                  recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div>
                        <p className="font-medium text-sm">#{order.order_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.merchant?.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-sm">
                          {formatCurrency(order.total_amount)}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {order.status.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Orders by Status */}
          <Card>
            <CardHeader>
              <CardTitle>Orders by Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {ordersByStatus.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No data available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ordersByStatus}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
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
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {ordersByStatus.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-xs">{entry.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
