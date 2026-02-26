'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { DashboardHeader } from '@/components/dashboard/header';
import { StatCard } from '@/components/dashboard/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Package,
  Search,
  Upload,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_city: string;
  product_description: string;
  total_weight_kg: number | null;
  status: string;
  priority: string;
  source: string;
  scheduled_date: string | null;
  route_id: string | null;
  driver_id: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  assigned: 'bg-blue-100 text-blue-800',
  out_for_delivery: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  returned_to_hub: 'bg-orange-100 text-orange-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800',
  normal: 'bg-gray-100 text-gray-800',
  low: 'bg-gray-50 text-gray-600',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    out_for_delivery: 0,
    delivered: 0,
    failed: 0,
  });

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const params = new URLSearchParams({ page: String(page), page_size: '50' });
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/hub-orders?${params}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
    setLoading(false);
  }, [page, statusFilter, search]);

  const fetchStats = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Get user's hub
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    let hubId: string | null = null;
    if (profile?.role === 'hub_manager') {
      const { data: hub } = await supabase
        .from('hubs')
        .select('id')
        .eq('manager_id', session.user.id)
        .limit(1)
        .single();
      hubId = hub?.id || null;
    }

    if (hubId) {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/hubs/${hubId}/stats`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setStats({
            total: data.total_orders_today,
            pending: data.pending_orders,
            out_for_delivery: data.out_for_delivery,
            delivered: data.delivered_today,
            failed: data.failed_today,
          });
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchStats();
  }, [fetchOrders, fetchStats]);

  return (
    <div>
      <DashboardHeader
        title="Orders"
        subtitle="Manage delivery orders"
        actions={
          <div className="flex gap-2">
            <Link href="/orders/import">
              <Button variant="outline" size="sm">
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </Button>
            </Link>
            <Link href="/orders/new">
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New Order
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total Today" value={stats.total} />
          <StatCard label="Pending" value={stats.pending} />
          <StatCard label="Out for Delivery" value={stats.out_for_delivery} />
          <StatCard label="Delivered" value={stats.delivered} className="border-green-200" />
          <StatCard label="Failed" value={stats.failed} className="border-red-200" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by order #, name, phone..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchOrders()}
            />
          </div>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="returned_to_hub">Returned to Hub</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <Button variant="outline" size="sm" onClick={fetchOrders}>
            <Filter className="mr-2 h-4 w-4" />
            Apply
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Order #</th>
                  <th className="px-4 py-3 text-left font-medium">Customer</th>
                  <th className="px-4 py-3 text-left font-medium">Address</th>
                  <th className="px-4 py-3 text-left font-medium">Product</th>
                  <th className="px-4 py-3 text-left font-medium">Weight</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Priority</th>
                  <th className="px-4 py-3 text-left font-medium">Source</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      Loading orders...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      <Package className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                      <p>No orders found</p>
                      <p className="text-xs mt-1">Import orders via CSV or create one manually</p>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-muted/30 cursor-pointer">
                      <td className="px-4 py-3">
                        <Link href={`/orders/${order.id}`} className="font-medium text-primary hover:underline">
                          {order.order_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{order.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate text-muted-foreground">
                        {order.delivery_address}
                      </td>
                      <td className="px-4 py-3 max-w-[150px] truncate">
                        {order.product_description}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {order.total_weight_kg ? `${order.total_weight_kg} kg` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100'}`}>
                          {order.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${PRIORITY_COLORS[order.priority] || ''}`}>
                          {order.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground uppercase text-xs">
                        {order.source}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Showing {orders.length} orders
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={orders.length < 50}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
