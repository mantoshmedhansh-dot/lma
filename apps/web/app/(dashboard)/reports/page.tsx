'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DashboardHeader } from '@/components/dashboard/header';
import { StatCard } from '@/components/dashboard/stat-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, RefreshCw } from 'lucide-react';

interface DashboardData {
  date: string;
  orders: {
    total: number;
    pending: number;
    assigned: number;
    out_for_delivery: number;
    delivered: number;
    failed: number;
    returned_to_hub: number;
    success_rate: number;
    cod_collected: number;
  };
  routes: { total: number; active: number; completed: number };
  drivers: { total: number; online: number };
}

interface DailyRow {
  date: string;
  total: number;
  delivered: number;
  failed: number;
  success_rate: number;
  cod_collected: number;
}

export default function ReportsPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [hubId, setHubId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profile } = await supabase.from('users').select('role').eq('id', session.user.id).single();
    let hId: string | null = null;
    if (profile?.role === 'hub_manager') {
      const { data: hub } = await supabase.from('hubs').select('id').eq('manager_id', session.user.id).limit(1).single();
      hId = hub?.id || null;
    } else {
      const { data: hubs } = await supabase.from('hubs').select('id').limit(1).single();
      hId = hubs?.id || null;
    }
    setHubId(hId);

    if (!hId) { setLoading(false); return; }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const headers = { Authorization: `Bearer ${session.access_token}` };

    // Dashboard
    try {
      const res = await fetch(`${apiUrl}/api/v1/analytics/hub/${hId}/dashboard`, { headers });
      if (res.ok) setDashboard(await res.json());
    } catch (err) { console.error(err); }

    // Daily report
    try {
      const res = await fetch(
        `${apiUrl}/api/v1/analytics/hub/${hId}/daily?start_date=${startDate}&end_date=${endDate}`,
        { headers }
      );
      if (res.ok) setDaily(await res.json());
    } catch (err) { console.error(err); }

    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div>
      <DashboardHeader
        title="Reports & Analytics"
        subtitle="Hub performance overview"
        actions={
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Today's KPIs */}
        {dashboard && (
          <>
            <h2 className="text-lg font-semibold">Today&apos;s Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <StatCard label="Total Orders" value={dashboard.orders.total} />
              <StatCard label="Delivered" value={dashboard.orders.delivered} className="border-green-200" />
              <StatCard label="Failed" value={dashboard.orders.failed} className="border-red-200" />
              <StatCard label="Success Rate" value={`${dashboard.orders.success_rate}%`} />
              <StatCard label="Drivers Online" value={`${dashboard.drivers.online}/${dashboard.drivers.total}`} />
              <StatCard label="COD Collected" value={`Rs. ${dashboard.orders.cod_collected.toLocaleString()}`} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Pending" value={dashboard.orders.pending} />
              <StatCard label="Assigned" value={dashboard.orders.assigned} />
              <StatCard label="Out for Delivery" value={dashboard.orders.out_for_delivery} />
              <StatCard label="Returned to Hub" value={dashboard.orders.returned_to_hub} />
            </div>
          </>
        )}

        {/* Daily Report */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Daily Report
              </CardTitle>
              <div className="flex gap-2">
                <input
                  type="date"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span className="flex items-center text-sm text-muted-foreground">to</span>
                <input
                  type="date"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : daily.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No data for selected period</p>
            ) : (
              <>
                {/* Simple bar visualization */}
                <div className="mb-6 space-y-2">
                  {daily.map((row) => {
                    const maxTotal = Math.max(...daily.map(d => d.total), 1);
                    return (
                      <div key={row.date} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-20 shrink-0">{row.date}</span>
                        <div className="flex-1 flex gap-0.5 h-6">
                          <div
                            className="bg-green-500 rounded-l"
                            style={{ width: `${(row.delivered / maxTotal) * 100}%` }}
                            title={`Delivered: ${row.delivered}`}
                          />
                          <div
                            className="bg-red-500 rounded-r"
                            style={{ width: `${(row.failed / maxTotal) * 100}%` }}
                            title={`Failed: ${row.failed}`}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">{row.total}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Table */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-3 py-2 text-left font-medium">Date</th>
                      <th className="px-3 py-2 text-left font-medium">Total</th>
                      <th className="px-3 py-2 text-left font-medium">Delivered</th>
                      <th className="px-3 py-2 text-left font-medium">Failed</th>
                      <th className="px-3 py-2 text-left font-medium">Success %</th>
                      <th className="px-3 py-2 text-left font-medium">COD Collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daily.map((row) => (
                      <tr key={row.date} className="border-b">
                        <td className="px-3 py-2">{row.date}</td>
                        <td className="px-3 py-2">{row.total}</td>
                        <td className="px-3 py-2 text-green-600">{row.delivered}</td>
                        <td className="px-3 py-2 text-red-600">{row.failed}</td>
                        <td className="px-3 py-2">{row.success_rate}%</td>
                        <td className="px-3 py-2">Rs. {row.cod_collected.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
