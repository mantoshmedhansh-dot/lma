'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { DashboardHeader } from '@/components/dashboard/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Play, CheckCircle, MapPin, Truck, User, Clock, Package } from 'lucide-react';

interface RouteDetail {
  id: string;
  hub_id: string;
  route_name: string | null;
  route_date: string;
  status: string;
  total_stops: number;
  total_distance_km: number | null;
  estimated_duration_mins: number | null;
  total_weight_kg: number | null;
  total_volume_cft: number | null;
  driver_name: string | null;
  driver_id: string | null;
  vehicle_id: string | null;
  vehicle: {
    plate_number: string;
    vehicle_type: string;
    capacity_kg: number | null;
    make_model: string | null;
  } | null;
  stops: Array<{
    id: string;
    sequence: number;
    status: string;
    planned_eta: string | null;
    actual_arrival: string | null;
    order: {
      id: string;
      order_number: string;
      customer_name: string;
      customer_phone: string;
      delivery_address: string;
      product_description: string;
      status: string;
      is_cod: boolean;
      cod_amount: number | null;
    } | null;
  }>;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
}

const STOP_STATUS_COLORS: Record<string, string> = {
  pending: 'border-gray-300 bg-gray-50 text-gray-600',
  arrived: 'border-blue-300 bg-blue-50 text-blue-600',
  delivered: 'border-green-300 bg-green-50 text-green-600',
  failed: 'border-red-300 bg-red-50 text-red-600',
  skipped: 'border-gray-300 bg-gray-50 text-gray-400',
};

export default function RouteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRoute = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/routes/${params.id}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (res.ok) setRoute(await res.json());
    } catch (err) {
      console.error('Failed to fetch route:', err);
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchRoute(); }, [fetchRoute]);

  const handleDispatch = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/routes/${params.id}/dispatch`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      if (res.ok) {
        fetchRoute();
      } else {
        const err = await res.json();
        alert(err.detail || 'Dispatch failed');
      }
    } catch (err) {
      alert('Dispatch failed');
    }
  }, [params.id, fetchRoute]);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><p className="text-muted-foreground">Loading route...</p></div>;
  }

  if (!route) {
    return <div className="flex items-center justify-center h-96"><p className="text-muted-foreground">Route not found</p></div>;
  }

  const deliveredStops = route.stops.filter(s => s.status === 'delivered').length;
  const failedStops = route.stops.filter(s => s.status === 'failed').length;

  return (
    <div>
      <DashboardHeader
        title={route.route_name || 'Route Detail'}
        actions={
          <div className="flex gap-2">
            <Link href="/routes">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            {route.status === 'assigned' && (
              <Button size="sm" onClick={handleDispatch}>
                <Play className="mr-2 h-4 w-4" />
                Dispatch
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Status Bar */}
        <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4">
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${
            route.status === 'in_progress' ? 'bg-indigo-100 text-indigo-800' :
            route.status === 'completed' ? 'bg-green-100 text-green-800' :
            route.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {route.status.replace(/_/g, ' ').toUpperCase()}
          </span>
          <span className="text-sm text-muted-foreground">Date: {route.route_date}</span>
          <span className="text-sm text-muted-foreground">
            Progress: {deliveredStops}/{route.total_stops} delivered
            {failedStops > 0 && `, ${failedStops} failed`}
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Route Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4" /> Vehicle & Driver
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {route.vehicle ? (
                <>
                  <p><span className="text-muted-foreground">Vehicle:</span> {route.vehicle.plate_number}</p>
                  <p><span className="text-muted-foreground">Type:</span> {route.vehicle.vehicle_type}</p>
                  <p><span className="text-muted-foreground">Capacity:</span> {route.vehicle.capacity_kg || '?'} kg</p>
                  {route.vehicle.make_model && <p><span className="text-muted-foreground">Model:</span> {route.vehicle.make_model}</p>}
                </>
              ) : (
                <p className="text-muted-foreground">No vehicle assigned</p>
              )}
              <div className="border-t pt-2 mt-2">
                {route.driver_name ? (
                  <p className="flex items-center gap-1"><User className="h-3 w-3" /> {route.driver_name}</p>
                ) : (
                  <p className="text-muted-foreground">No driver assigned</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Route Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Stops:</span> {route.total_stops}</p>
              <p><span className="text-muted-foreground">Total Weight:</span> {route.total_weight_kg || 0} kg</p>
              <p><span className="text-muted-foreground">Distance:</span> {route.total_distance_km ? `${route.total_distance_km} km` : '-'}</p>
              <p><span className="text-muted-foreground">Est. Duration:</span> {route.estimated_duration_mins ? `${route.estimated_duration_mins} min` : '-'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" /> Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Delivered: {deliveredStops}</span>
                  <span className="text-red-600">Failed: {failedStops}</span>
                </div>
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
                  {route.total_stops > 0 && (
                    <>
                      <div className="h-full bg-green-500" style={{ width: `${(deliveredStops / route.total_stops) * 100}%` }} />
                      <div className="h-full bg-red-500" style={{ width: `${(failedStops / route.total_stops) * 100}%` }} />
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {route.total_stops > 0 ? Math.round(((deliveredStops + failedStops) / route.total_stops) * 100) : 0}% complete
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stops List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Stops ({route.stops.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {route.stops.map((stop) => (
                <div key={stop.id} className={`flex items-start gap-3 rounded-lg border p-3 ${STOP_STATUS_COLORS[stop.status] || ''}`}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold">
                    {stop.sequence}
                  </div>
                  <div className="flex-1 min-w-0">
                    {stop.order ? (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/orders/${stop.order.id}`} className="font-medium text-primary hover:underline text-sm">
                            {stop.order.order_number}
                          </Link>
                          <span className="text-sm">{stop.order.customer_name}</span>
                          <span className="text-xs text-muted-foreground">{stop.order.customer_phone}</span>
                          {stop.order.is_cod && (
                            <span className="rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-xs">
                              COD Rs.{stop.order.cod_amount}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{stop.order.delivery_address}</p>
                        <p className="text-xs text-muted-foreground">{stop.order.product_description}</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Order details unavailable</p>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    stop.status === 'delivered' ? 'bg-green-100 text-green-800' :
                    stop.status === 'failed' ? 'bg-red-100 text-red-800' :
                    stop.status === 'arrived' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {stop.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
