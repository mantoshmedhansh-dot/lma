"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import { apiAuthFetch } from "@/lib/api";
import {
  Building2,
  Package,
  CheckCircle,
  XCircle,
  TrendingUp,
  Truck,
  Users,
  Activity,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface HubStat {
  hub_id: string;
  hub_name: string;
  hub_code: string;
  total_orders: number;
  delivered: number;
  failed: number;
  success_rate: number;
  drivers_online: number;
}

interface OverviewData {
  date: string;
  total_hubs: number;
  hubs: HubStat[];
  total_orders: number;
  total_delivered: number;
  total_failed: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    try {
      const result = await apiAuthFetch<OverviewData>(
        "/api/v1/analytics/overview",
      );
      setData(result);
    } catch (error) {
      console.error("Error fetching overview:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Header
          title="Hub Operations Dashboard"
          description="Cross-hub delivery operations overview"
        />
        <div className="p-6 text-center text-muted-foreground py-12">
          Loading dashboard...
        </div>
      </div>
    );
  }

  const totalDriversOnline =
    data?.hubs.reduce((sum, h) => sum + h.drivers_online, 0) || 0;
  const overallSuccessRate =
    data && data.total_delivered + data.total_failed > 0
      ? Math.round(
          (data.total_delivered / (data.total_delivered + data.total_failed)) *
            100,
        )
      : 0;

  const statCards = [
    {
      title: "Total Hubs",
      value: formatNumber(data?.total_hubs || 0),
      icon: Building2,
      color: "text-purple-500",
      bgColor: "bg-purple-100",
    },
    {
      title: "Orders Today",
      value: formatNumber(data?.total_orders || 0),
      icon: Package,
      color: "text-blue-500",
      bgColor: "bg-blue-100",
    },
    {
      title: "Delivered",
      value: formatNumber(data?.total_delivered || 0),
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-100",
    },
    {
      title: "Failed",
      value: formatNumber(data?.total_failed || 0),
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-100",
    },
    {
      title: "Success Rate",
      value: `${overallSuccessRate}%`,
      icon: TrendingUp,
      color: "text-emerald-500",
      bgColor: "bg-emerald-100",
    },
    {
      title: "Drivers Online",
      value: formatNumber(totalDriversOnline),
      icon: Users,
      color: "text-cyan-500",
      bgColor: "bg-cyan-100",
    },
  ];

  const chartData = (data?.hubs || []).map((hub) => ({
    name: hub.hub_code || hub.hub_name,
    orders: hub.total_orders,
    delivered: hub.delivered,
    failed: hub.failed,
  }));

  return (
    <div>
      <Header
        title="Hub Operations Dashboard"
        description="Cross-hub delivery operations overview"
      />

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
                      <p className="text-sm text-muted-foreground">
                        {stat.title}
                      </p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
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

        {/* Hub Comparison Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Hub Delivery Comparison (Today)</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hub data available
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar
                      dataKey="delivered"
                      fill="#22c55e"
                      name="Delivered"
                      radius={[4, 4, 0, 0]}
                      stackId="a"
                    />
                    <Bar
                      dataKey="failed"
                      fill="#ef4444"
                      name="Failed"
                      radius={[4, 4, 0, 0]}
                      stackId="a"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hub Comparison Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Hub Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.hubs || []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hubs found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Hub</th>
                      <th className="px-4 py-3 text-left font-medium">Code</th>
                      <th className="px-4 py-3 text-right font-medium">
                        Orders
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        Delivered
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        Failed
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        Success %
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        Drivers Online
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.hubs.map((hub) => (
                      <tr
                        key={hub.hub_id}
                        className="border-b hover:bg-muted/30"
                      >
                        <td className="px-4 py-3 font-medium">
                          {hub.hub_name}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {hub.hub_code}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {hub.total_orders}
                        </td>
                        <td className="px-4 py-3 text-right text-green-600">
                          {hub.delivered}
                        </td>
                        <td className="px-4 py-3 text-right text-red-600">
                          {hub.failed}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              hub.success_rate >= 90
                                ? "bg-green-100 text-green-800"
                                : hub.success_rate >= 70
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                            }`}
                          >
                            {hub.success_rate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {hub.drivers_online}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
