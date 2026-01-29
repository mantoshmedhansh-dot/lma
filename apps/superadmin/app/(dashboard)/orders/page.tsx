'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatCurrency } from '@/lib/utils';
import {
  Search,
  ShoppingBag,
  RefreshCw,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
} from 'lucide-react';

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  subtotal: number;
  delivery_fee: number;
  created_at: string;
  delivered_at: string | null;
  delivery_address: {
    street: string;
    city: string;
  };
  merchant: {
    name: string;
  };
  customer: {
    full_name: string;
    email: string;
  };
  driver: {
    full_name: string;
  } | null;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total_amount,
          subtotal,
          delivery_fee,
          created_at,
          delivered_at,
          delivery_address,
          merchant:merchants(name),
          customer:users!orders_customer_id_fkey(full_name, email),
          driver:drivers(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.merchant?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusColors: Record<string, 'success' | 'warning' | 'destructive' | 'info' | 'secondary' | 'default'> = {
    pending: 'warning',
    confirmed: 'info',
    preparing: 'info',
    ready: 'success',
    picked_up: 'info',
    delivered: 'success',
    cancelled: 'destructive',
  };

  const statusIcons: Record<string, typeof Clock> = {
    pending: Clock,
    confirmed: CheckCircle,
    preparing: ShoppingBag,
    ready: CheckCircle,
    picked_up: Truck,
    delivered: CheckCircle,
    cancelled: XCircle,
  };

  // Calculate stats
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayOrders = orders.filter((o) => new Date(o.created_at) >= todayStart);
  const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

  return (
    <div>
      <Header title="Orders" description="View and manage all orders" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Orders</p>
              <p className="text-2xl font-bold">{orders.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Today's Orders</p>
              <p className="text-2xl font-bold">{todayOrders.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Today's Revenue</p>
              <p className="text-2xl font-bold">{formatCurrency(todayRevenue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">
                {orders.filter((o) => o.status === 'pending').length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
            <option value="picked_up">Picked Up</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <Button variant="outline" onClick={fetchOrders}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Table */}
        <div className="bg-card border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No orders found
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => {
                  const StatusIcon = statusIcons[order.status] || Clock;
                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        <p className="font-medium">#{order.order_number}</p>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.customer?.full_name || 'N/A'}</p>
                          <p className="text-sm text-muted-foreground">
                            {order.delivery_address?.city}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{order.merchant?.name || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={statusColors[order.status] || 'secondary'}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {order.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{formatCurrency(order.total_amount)}</p>
                      </TableCell>
                      <TableCell>{formatDate(order.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="bg-card rounded-lg border max-w-lg w-full max-h-[80vh] overflow-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Order #{selectedOrder.order_number}</h2>
              <Badge variant={statusColors[selectedOrder.status]}>
                {selectedOrder.status.replace('_', ' ')}
              </Badge>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedOrder.customer?.full_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Merchant</p>
                  <p className="font-medium">{selectedOrder.merchant?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Driver</p>
                  <p className="font-medium">
                    {selectedOrder.driver?.full_name || 'Not assigned'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Delivery Address</p>
                  <p className="font-medium">
                    {selectedOrder.delivery_address?.street}, {selectedOrder.delivery_address?.city}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-2">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span>{formatCurrency(selectedOrder.delivery_fee)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-2">
                    <span>Total</span>
                    <span>{formatCurrency(selectedOrder.total_amount)}</span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatDate(selectedOrder.created_at)}</span>
                </div>
                {selectedOrder.delivered_at && (
                  <div className="flex justify-between mt-2">
                    <span className="text-muted-foreground">Delivered</span>
                    <span>{formatDate(selectedOrder.delivered_at)}</span>
                  </div>
                )}
              </div>

              <Button variant="outline" className="w-full" onClick={() => setSelectedOrder(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
