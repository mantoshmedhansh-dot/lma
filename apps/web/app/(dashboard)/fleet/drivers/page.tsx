'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DashboardHeader } from '@/components/dashboard/header';
import { Users } from 'lucide-react';

interface Driver {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  user_phone: string;
  vehicle_type: string;
  vehicle_number: string | null;
  status: string;
  hub_id: string | null;
  is_verified: boolean;
  total_deliveries: number;
  daily_capacity_orders: number;
}

const STATUS_COLORS: Record<string, string> = {
  online: 'bg-green-100 text-green-800',
  on_delivery: 'bg-blue-100 text-blue-800',
  busy: 'bg-yellow-100 text-yellow-800',
  offline: 'bg-gray-100 text-gray-800',
};

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDrivers() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase.from('users').select('role').eq('id', session.user.id).single();
      let hubId: string | null = null;
      if (profile?.role === 'hub_manager') {
        const { data: hub } = await supabase.from('hubs').select('id').eq('manager_id', session.user.id).limit(1).single();
        hubId = hub?.id || null;
      }

      const params = hubId ? `?hub_id=${hubId}` : '';

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/fleet/drivers${params}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        if (res.ok) setDrivers(await res.json());
      } catch (err) { console.error(err); }
      setLoading(false);
    }
    fetchDrivers();
  }, []);

  return (
    <div>
      <DashboardHeader
        title="Drivers"
        subtitle="Manage drivers at your hub"
      />

      <div className="p-6">
        {loading ? (
          <p className="text-center text-muted-foreground py-12">Loading...</p>
        ) : drivers.length === 0 ? (
          <div className="text-center py-16">
            <Users className="mx-auto h-16 w-16 text-muted-foreground/30" />
            <p className="mt-4 text-muted-foreground">No drivers assigned to this hub</p>
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Phone</th>
                  <th className="px-4 py-3 text-left font-medium">Vehicle</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Deliveries</th>
                  <th className="px-4 py-3 text-left font-medium">Verified</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d) => (
                  <tr key={d.id} className="border-b">
                    <td className="px-4 py-3">
                      <p className="font-medium">{d.first_name} {d.last_name}</p>
                      <p className="text-xs text-muted-foreground">{d.email}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{d.user_phone || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="capitalize">{d.vehicle_type}</span>
                      {d.vehicle_number && <span className="text-muted-foreground ml-1">({d.vehicle_number})</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[d.status] || ''}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{d.total_deliveries}</td>
                    <td className="px-4 py-3">
                      {d.is_verified ? (
                        <span className="text-green-600 text-xs">Verified</span>
                      ) : (
                        <span className="text-yellow-600 text-xs">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
