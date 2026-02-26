'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DashboardHeader } from '@/components/dashboard/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, RefreshCw, Truck, User } from 'lucide-react';

interface ActiveRoute {
  id: string;
  route_name: string | null;
  status: string;
  total_stops: number;
  driver_id: string | null;
  driver_name?: string;
  completed_stops: number;
  failed_stops: number;
}

export default function TrackingPage() {
  const [routes, setRoutes] = useState<ActiveRoute[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActiveRoutes = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const today = new Date().toISOString().split('T')[0];

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/routes?route_date=${today}&status=in_progress`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        // Fetch details for each route
        const enriched: ActiveRoute[] = [];
        for (const route of data) {
          const detailRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/routes/${route.id}`,
            { headers: { Authorization: `Bearer ${session.access_token}` } }
          );
          if (detailRes.ok) {
            const detail = await detailRes.json();
            enriched.push({
              id: route.id,
              route_name: route.route_name,
              status: route.status,
              total_stops: route.total_stops,
              driver_id: route.driver_id,
              driver_name: detail.driver_name,
              completed_stops: (detail.stops || []).filter((s: any) => s.status === 'delivered').length,
              failed_stops: (detail.stops || []).filter((s: any) => s.status === 'failed').length,
            });
          }
        }
        setRoutes(enriched);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchActiveRoutes(); }, [fetchActiveRoutes]);

  return (
    <div>
      <DashboardHeader
        title="Live Tracking"
        subtitle="Track active routes and drivers"
        actions={
          <Button variant="outline" size="sm" onClick={fetchActiveRoutes}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Map placeholder */}
        <Card>
          <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <MapPin className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="mt-2">Live map will be shown here when Google Maps API is configured</p>
              <p className="text-xs mt-1">Configure NEXT_PUBLIC_GOOGLE_MAPS_KEY in environment</p>
            </div>
          </CardContent>
        </Card>

        {/* Active Routes */}
        <h2 className="text-lg font-semibold">Active Routes ({routes.length})</h2>

        {loading ? (
          <p className="text-muted-foreground text-center py-8">Loading...</p>
        ) : routes.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Truck className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="mt-2">No active routes right now</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {routes.map((route) => {
              const progress = route.total_stops > 0
                ? Math.round(((route.completed_stops + route.failed_stops) / route.total_stops) * 100)
                : 0;

              return (
                <Card key={route.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{route.route_name || 'Route'}</h3>
                      <span className="rounded-full bg-indigo-100 text-indigo-800 px-2 py-0.5 text-xs font-medium">
                        In Progress
                      </span>
                    </div>

                    {route.driver_name && (
                      <p className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                        <User className="h-3 w-3" /> {route.driver_name}
                      </p>
                    )}

                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span>{route.completed_stops}/{route.total_stops} delivered</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
                        <div className="h-full bg-green-500" style={{ width: `${(route.completed_stops / Math.max(route.total_stops, 1)) * 100}%` }} />
                        <div className="h-full bg-red-500" style={{ width: `${(route.failed_stops / Math.max(route.total_stops, 1)) * 100}%` }} />
                      </div>
                    </div>

                    {route.failed_stops > 0 && (
                      <p className="text-xs text-red-600 mt-1">{route.failed_stops} failed</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
