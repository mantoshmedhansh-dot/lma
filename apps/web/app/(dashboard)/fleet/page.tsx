'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DashboardHeader } from '@/components/dashboard/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Truck, Plus } from 'lucide-react';

interface Vehicle {
  id: string;
  hub_id: string;
  vehicle_type: string;
  plate_number: string;
  capacity_kg: number | null;
  capacity_volume_cft: number | null;
  make_model: string | null;
  status: string;
  assigned_driver_id: string | null;
  is_active: boolean;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-100 text-green-800',
  on_route: 'bg-blue-100 text-blue-800',
  maintenance: 'bg-orange-100 text-orange-800',
  inactive: 'bg-gray-100 text-gray-800',
};

export default function FleetPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [hubId, setHubId] = useState<string | null>(null);
  const [form, setForm] = useState({
    vehicle_type: 'bike',
    plate_number: '',
    capacity_kg: '',
    make_model: '',
  });

  const fetchVehicles = useCallback(async () => {
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

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/fleet/vehicles?hub_id=${hId}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (res.ok) setVehicles(await res.json());
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  const handleAdd = async () => {
    if (!hubId || !form.plate_number) return;
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/fleet/vehicles`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hub_id: hubId,
            vehicle_type: form.vehicle_type,
            plate_number: form.plate_number,
            capacity_kg: form.capacity_kg ? parseFloat(form.capacity_kg) : null,
            make_model: form.make_model || null,
          }),
        }
      );
      if (res.ok) {
        setShowDialog(false);
        setForm({ vehicle_type: 'bike', plate_number: '', capacity_kg: '', make_model: '' });
        fetchVehicles();
      }
    } catch (err) { alert('Failed to add vehicle'); }
  };

  return (
    <div>
      <DashboardHeader
        title="Fleet Management"
        subtitle="Manage vehicles at your hub"
        actions={
          <Button size="sm" onClick={() => setShowDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Vehicle
          </Button>
        }
      />

      <div className="p-6">
        {loading ? (
          <p className="text-center text-muted-foreground py-12">Loading...</p>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-16">
            <Truck className="mx-auto h-16 w-16 text-muted-foreground/30" />
            <p className="mt-4 text-muted-foreground">No vehicles added yet</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowDialog(true)}>
              Add First Vehicle
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Plate #</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Model</th>
                  <th className="px-4 py-3 text-left font-medium">Capacity (kg)</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id} className="border-b">
                    <td className="px-4 py-3 font-medium">{v.plate_number}</td>
                    <td className="px-4 py-3 capitalize">{v.vehicle_type.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.make_model || '-'}</td>
                    <td className="px-4 py-3">{v.capacity_kg || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[v.status] || ''}`}>
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Vehicle Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Vehicle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Vehicle Type</Label>
              <select
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form.vehicle_type}
                onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
              >
                <option value="bike">Bike</option>
                <option value="three_wheeler">Three Wheeler</option>
                <option value="mini_truck">Mini Truck</option>
                <option value="one_tonner">1 Tonner</option>
                <option value="two_tonner">2 Tonner</option>
              </select>
            </div>
            <div>
              <Label>Plate Number</Label>
              <Input
                className="mt-1"
                value={form.plate_number}
                onChange={(e) => setForm({ ...form, plate_number: e.target.value })}
                placeholder="e.g. DL 01 AB 1234"
              />
            </div>
            <div>
              <Label>Capacity (kg)</Label>
              <Input
                className="mt-1"
                type="number"
                value={form.capacity_kg}
                onChange={(e) => setForm({ ...form, capacity_kg: e.target.value })}
                placeholder="e.g. 500"
              />
            </div>
            <div>
              <Label>Make & Model</Label>
              <Input
                className="mt-1"
                value={form.make_model}
                onChange={(e) => setForm({ ...form, make_model: e.target.value })}
                placeholder="e.g. Tata Ace"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleAdd}>Add Vehicle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
