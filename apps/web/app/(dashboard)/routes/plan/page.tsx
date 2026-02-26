'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DashboardHeader } from '@/components/dashboard/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Zap, Plus, Trash2, Truck, Package } from 'lucide-react';
import Link from 'next/link';

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  delivery_address: string;
  delivery_city: string | null;
  delivery_postal_code: string | null;
  product_description: string;
  total_weight_kg: number | null;
  priority: string;
}

interface Vehicle {
  id: string;
  plate_number: string;
  vehicle_type: string;
  capacity_kg: number | null;
  make_model: string | null;
  status: string;
}

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
}

export default function RoutePlanningPage() {
  const router = useRouter();
  const [unassignedOrders, setUnassignedOrders] = useState<Order[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [routeDate, setRouteDate] = useState(new Date().toISOString().split('T')[0]);
  const [hubId, setHubId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get hub
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

      const headers = { Authorization: `Bearer ${session.access_token}` };
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

      // Fetch unassigned orders
      try {
        const res = await fetch(`${apiUrl}/api/v1/hub-orders?status=pending&page_size=200`, { headers });
        if (res.ok) setUnassignedOrders(await res.json());
      } catch (err) { console.error(err); }

      // Fetch vehicles
      try {
        const res = await fetch(`${apiUrl}/api/v1/fleet/vehicles?hub_id=${hId}&status=available`, { headers });
        if (res.ok) setVehicles(await res.json());
      } catch (err) { console.error(err); }

      // Fetch drivers
      try {
        const res = await fetch(`${apiUrl}/api/v1/fleet/drivers?hub_id=${hId}`, { headers });
        if (res.ok) setDrivers(await res.json());
      } catch (err) { console.error(err); }

      setLoading(false);
    }
    init();
  }, []);

  const toggleOrder = (id: string) => {
    const next = new Set(selectedOrders);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedOrders(next);
  };

  const selectAll = () => {
    if (selectedOrders.size === unassignedOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(unassignedOrders.map(o => o.id)));
    }
  };

  const totalWeight = Array.from(selectedOrders).reduce((sum, id) => {
    const order = unassignedOrders.find(o => o.id === id);
    return sum + (order?.total_weight_kg || 0);
  }, 0);

  const vehicleCapacity = vehicles.find(v => v.id === selectedVehicle)?.capacity_kg || 0;

  const handleCreateRoute = useCallback(async () => {
    if (!hubId || selectedOrders.size === 0) return;
    setPlanning(true);

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/routes`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            hub_id: hubId,
            route_date: routeDate,
            vehicle_id: selectedVehicle || null,
            driver_id: selectedDriver || null,
            order_ids: Array.from(selectedOrders),
          }),
        }
      );

      if (res.ok) {
        const route = await res.json();
        router.push(`/routes/${route.id}`);
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to create route');
      }
    } catch (err) {
      alert('Failed to create route');
    }
    setPlanning(false);
  }, [hubId, selectedOrders, selectedVehicle, selectedDriver, routeDate, router]);

  const handleAutoPlan = useCallback(async () => {
    if (!hubId) return;
    setPlanning(true);

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/routes/auto-plan`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            hub_id: hubId,
            route_date: routeDate,
          }),
        }
      );

      if (res.ok) {
        const result = await res.json();
        alert(`Auto-plan complete: ${result.routes_created} routes created, ${result.total_orders_assigned} orders assigned, ${result.unassigned_orders} unassigned`);
        router.push('/routes');
      } else {
        const err = await res.json();
        alert(err.detail || 'Auto-plan failed');
      }
    } catch (err) {
      alert('Auto-plan failed');
    }
    setPlanning(false);
  }, [hubId, routeDate, router]);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div>
      <DashboardHeader
        title="Route Planning"
        subtitle={`Plan routes for ${routeDate}`}
        actions={
          <div className="flex gap-2">
            <Link href="/routes">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <Button size="sm" variant="outline" onClick={handleAutoPlan} disabled={planning}>
              <Zap className="mr-2 h-4 w-4" />
              Auto-Plan All
            </Button>
          </div>
        }
      />

      <div className="p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Unassigned Orders */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Unassigned Orders ({unassignedOrders.length})
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    {selectedOrders.size === unassignedOrders.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {unassignedOrders.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No unassigned orders</p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {unassignedOrders.map((order) => (
                      <div
                        key={order.id}
                        onClick={() => toggleOrder(order.id)}
                        className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                          selectedOrders.has(order.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedOrders.has(order.id)}
                          onChange={() => {}}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{order.order_number}</span>
                            <span className="text-xs text-muted-foreground">{order.customer_name}</span>
                            {order.priority === 'urgent' && (
                              <span className="rounded bg-red-100 text-red-800 px-1.5 py-0.5 text-xs">urgent</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{order.delivery_address}</p>
                          <p className="text-xs text-muted-foreground">{order.product_description} {order.total_weight_kg ? `| ${order.total_weight_kg} kg` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Route Builder */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Route Builder
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Route Date</label>
                  <input
                    type="date"
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={routeDate}
                    onChange={(e) => setRouteDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Vehicle</label>
                  <select
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedVehicle}
                    onChange={(e) => setSelectedVehicle(e.target.value)}
                  >
                    <option value="">Select vehicle...</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plate_number} - {v.vehicle_type} ({v.capacity_kg || '?'} kg)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Driver</label>
                  <select
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedDriver}
                    onChange={(e) => setSelectedDriver(e.target.value)}
                  >
                    <option value="">Select driver...</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.first_name} {d.last_name} ({d.status})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Capacity Bar */}
                {selectedVehicle && vehicleCapacity > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Weight: {totalWeight.toFixed(1)} kg</span>
                      <span>Capacity: {vehicleCapacity} kg</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          totalWeight > vehicleCapacity ? 'bg-red-500' : 'bg-primary'
                        }`}
                        style={{ width: `${Math.min((totalWeight / vehicleCapacity) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm font-medium">{selectedOrders.size} orders selected</p>
                  <p className="text-xs text-muted-foreground">Total weight: {totalWeight.toFixed(1)} kg</p>
                </div>

                <Button
                  className="w-full"
                  disabled={selectedOrders.size === 0 || planning}
                  onClick={handleCreateRoute}
                >
                  {planning ? 'Creating...' : `Create Route (${selectedOrders.size} stops)`}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
