'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { DashboardHeader } from '@/components/dashboard/header';
import { Button } from '@/components/ui/button';
import { Route, Plus, Play, CheckCircle, Clock, XCircle } from 'lucide-react';

interface RouteItem {
  id: string;
  route_name: string | null;
  route_date: string;
  status: string;
  total_stops: number;
  total_distance_km: number | null;
  estimated_duration_mins: number | null;
  total_weight_kg: number | null;
  driver_id: string | null;
  vehicle_id: string | null;
  created_at: string;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  planned: <Clock className="h-4 w-4 text-yellow-500" />,
  assigned: <Clock className="h-4 w-4 text-blue-500" />,
  in_progress: <Play className="h-4 w-4 text-indigo-500" />,
  completed: <CheckCircle className="h-4 w-4 text-green-500" />,
  cancelled: <XCircle className="h-4 w-4 text-gray-400" />,
};

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-yellow-100 text-yellow-800',
  assigned: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

export default function RoutesPage() {
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const params = new URLSearchParams();
    if (dateFilter) params.set('route_date', dateFilter);
    if (statusFilter) params.set('status', statusFilter);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/routes?${params}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (res.ok) setRoutes(await res.json());
    } catch (err) {
      console.error('Failed to fetch routes:', err);
    }
    setLoading(false);
  }, [dateFilter, statusFilter]);

  useEffect(() => { fetchRoutes(); }, [fetchRoutes]);

  return (
    <div>
      <DashboardHeader
        title="Routes"
        subtitle={`Routes for ${dateFilter}`}
        actions={
          <Link href="/routes/plan">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Plan Routes
            </Button>
          </Link>
        }
      />

      <div className="p-6 space-y-6">
        {/* Filters */}
        <div className="flex gap-3">
          <input
            type="date"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="planned">Planned</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {/* Routes Grid */}
        {loading ? (
          <p className="text-center text-muted-foreground py-12">Loading routes...</p>
        ) : routes.length === 0 ? (
          <div className="text-center py-16">
            <Route className="mx-auto h-16 w-16 text-muted-foreground/30" />
            <p className="mt-4 text-muted-foreground">No routes for this date</p>
            <Link href="/routes/plan" className="mt-2 inline-block">
              <Button variant="outline" size="sm">Plan Routes</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {routes.map((route) => (
              <Link key={route.id} href={`/routes/${route.id}`}>
                <div className="rounded-lg border bg-card p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{route.route_name || 'Unnamed Route'}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[route.status] || ''}`}>
                      {route.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Stops</p>
                      <p className="font-medium">{route.total_stops}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Weight</p>
                      <p className="font-medium">{route.total_weight_kg ? `${route.total_weight_kg} kg` : '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Duration</p>
                      <p className="font-medium">{route.estimated_duration_mins ? `${route.estimated_duration_mins} min` : '-'}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    {STATUS_ICONS[route.status]}
                    <span>{route.route_date}</span>
                    {route.driver_id && <span className="ml-auto">Driver assigned</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
