"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import { apiAuthFetch } from "@/lib/api";
import {
  Calendar,
  TrendingUp,
  Package,
  CheckCircle,
  XCircle,
  Building2,
} from "lucide-react";
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
  Legend,
} from "recharts";

interface Hub {
  id: string;
  name: string;
  code: string;
}

interface DailyRow {
  date: string;
  total: number;
  delivered: number;
  failed: number;
  success_rate: number;
  cod_collected: number;
}

const COLORS = ["#7c3aed", "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#ec4899"];

export default function AnalyticsPage() {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [selectedHubId, setSelectedHubId] = useState<string>("all");
  const [dailyData, setDailyData] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  // Hub comparison data (all hubs daily)
  const [hubComparison, setHubComparison] = useState<
    { hub_name: string; total: number; delivered: number; failed: number; success_rate: number }[]
  >([]);

  useEffect(() => {
    fetchHubs();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [selectedHubId, startDate, endDate]);

  const fetchHubs = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("hubs")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name");
      setHubs(data || []);
    } catch (err) {
      console.error("Failed to fetch hubs:", err);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      if (selectedHubId === "all") {
        // Fetch daily data for each hub and merge
        const allDaily: DailyRow[] = [];
        const comparison: typeof hubComparison = [];

        for (const hub of hubs) {
          try {
            const data = await apiAuthFetch<DailyRow[]>(
              `/api/v1/analytics/hub/${hub.id}/daily?start_date=${startDate}&end_date=${endDate}`,
            );
            // Merge into allDaily
            for (const row of data) {
              const existing = allDaily.find((d) => d.date === row.date);
              if (existing) {
                existing.total += row.total;
                existing.delivered += row.delivered;
                existing.failed += row.failed;
                existing.cod_collected += row.cod_collected;
              } else {
                allDaily.push({ ...row });
              }
            }
            // Hub comparison totals
            const hubTotal = data.reduce((s, r) => s + r.total, 0);
            const hubDelivered = data.reduce((s, r) => s + r.delivered, 0);
            const hubFailed = data.reduce((s, r) => s + r.failed, 0);
            const attempted = hubDelivered + hubFailed;
            comparison.push({
              hub_name: hub.code || hub.name,
              total: hubTotal,
              delivered: hubDelivered,
              failed: hubFailed,
              success_rate: attempted > 0 ? Math.round((hubDelivered / attempted) * 100) : 0,
            });
          } catch {
            // Hub might not have data
          }
        }

        // Recalculate success rates for merged data
        for (const row of allDaily) {
          const attempted = row.delivered + row.failed;
          row.success_rate = attempted > 0 ? Math.round((row.delivered / attempted) * 100) : 0;
        }

        setDailyData(allDaily.sort((a, b) => a.date.localeCompare(b.date)));
        setHubComparison(comparison);
      } else {
        // Single hub
        const data = await apiAuthFetch<DailyRow[]>(
          `/api/v1/analytics/hub/${selectedHubId}/daily?start_date=${startDate}&end_date=${endDate}`,
        );
        setDailyData(data);
        setHubComparison([]);
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  const totalOrders = dailyData.reduce((s, r) => s + r.total, 0);
  const totalDelivered = dailyData.reduce((s, r) => s + r.delivered, 0);
  const totalFailed = dailyData.reduce((s, r) => s + r.failed, 0);
  const overallSuccess =
    totalDelivered + totalFailed > 0
      ? Math.round((totalDelivered / (totalDelivered + totalFailed)) * 100)
      : 0;
  const totalCod = dailyData.reduce((s, r) => s + r.cod_collected, 0);

  return (
    <div>
      <Header
        title="Hub Analytics"
        description="Delivery performance across hubs"
      />

      <div className="p-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <input
            type="date"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span className="text-sm text-muted-foreground">to</span>
          <input
            type="date"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={selectedHubId}
            onChange={(e) => setSelectedHubId(e.target.value)}
          >
            <option value="all">All Hubs</option>
            {hubs.map((hub) => (
              <option key={hub.id} value={hub.id}>
                {hub.name}
              </option>
            ))}
          </select>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Orders</p>
                  <p className="text-xl font-bold">{formatNumber(totalOrders)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Delivered</p>
                  <p className="text-xl font-bold">{formatNumber(totalDelivered)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Failed</p>
                  <p className="text-xl font-bold">{formatNumber(totalFailed)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Success Rate</p>
                  <p className="text-xl font-bold">{overallSuccess}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">COD Collected</p>
                  <p className="text-xl font-bold">
                    Rs. {totalCod.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Daily Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Delivery Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading...
                </div>
              ) : dailyData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No data for selected period
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="delivered"
                        stroke="#22c55e"
                        strokeWidth={2}
                        name="Delivered"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="failed"
                        stroke="#ef4444"
                        strokeWidth={2}
                        name="Failed"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="total"
                        stroke="#7c3aed"
                        strokeWidth={2}
                        name="Total"
                        dot={false}
                        strokeDasharray="5 5"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hub Comparison Bar Chart (only when "All Hubs" selected) */}
          <Card>
            <CardHeader>
              <CardTitle>Hub Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              {hubComparison.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {selectedHubId === "all"
                    ? "No hub data available"
                    : "Select \"All Hubs\" to see comparison"}
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hubComparison}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="hub_name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
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
        </div>

        {/* Hub Performance Table (when "All Hubs" selected) */}
        {hubComparison.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Hub Performance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Hub</th>
                      <th className="px-4 py-3 text-right font-medium">
                        Total Orders
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        Delivered
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        Failed
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        Success Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {hubComparison.map((hub) => (
                      <tr key={hub.hub_name} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{hub.hub_name}</td>
                        <td className="px-4 py-3 text-right">{hub.total}</td>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daily Data Table */}
        {dailyData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Daily Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Date</th>
                      <th className="px-4 py-3 text-right font-medium">Total</th>
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
                        COD Collected
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyData.map((row) => (
                      <tr key={row.date} className="border-b">
                        <td className="px-4 py-3">{row.date}</td>
                        <td className="px-4 py-3 text-right">{row.total}</td>
                        <td className="px-4 py-3 text-right text-green-600">
                          {row.delivered}
                        </td>
                        <td className="px-4 py-3 text-right text-red-600">
                          {row.failed}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.success_rate}%
                        </td>
                        <td className="px-4 py-3 text-right">
                          Rs. {row.cod_collected.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
