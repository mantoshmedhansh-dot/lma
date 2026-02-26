'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { DashboardHeader } from '@/components/dashboard/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, MapPin, Phone, Package, User, Clock, Camera } from 'lucide-react';

interface OrderDetail {
  id: string;
  order_number: string;
  hub_id: string;
  source: string;
  status: string;
  priority: string;
  customer_name: string;
  customer_phone: string;
  customer_alt_phone: string | null;
  customer_email: string | null;
  delivery_address: string;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_postal_code: string | null;
  product_description: string;
  product_sku: string | null;
  product_category: string | null;
  package_count: number;
  total_weight_kg: number | null;
  total_volume_cft: number | null;
  is_cod: boolean;
  cod_amount: number | null;
  declared_value: number | null;
  seller_name: string | null;
  seller_order_ref: string | null;
  marketplace: string | null;
  scheduled_date: string | null;
  delivery_slot: string | null;
  route_name: string | null;
  driver_name: string | null;
  created_at: string;
  assigned_at: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  returned_at: string | null;
  attempts: Attempt[];
}

interface Attempt {
  id: string;
  attempt_number: number;
  status: string;
  failure_reason: string | null;
  failure_notes: string | null;
  otp_verified: boolean;
  recipient_name: string | null;
  cod_collected: boolean;
  cod_amount: number | null;
  photo_urls: string[] | null;
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

export default function OrderDetailPage() {
  const params = useParams();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrder() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/hub-orders/${params.id}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        if (res.ok) {
          setOrder(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch order:', err);
      }
      setLoading(false);
    }
    fetchOrder();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading order...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Order not found</p>
      </div>
    );
  }

  return (
    <div>
      <DashboardHeader
        title={`Order ${order.order_number}`}
        actions={
          <Link href="/orders">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Orders
            </Button>
          </Link>
        }
      />

      <div className="p-6 space-y-6">
        {/* Status Banner */}
        <div className="flex items-center justify-between rounded-lg border bg-card p-4">
          <div className="flex items-center gap-4">
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100'}`}>
              {order.status.replace(/_/g, ' ').toUpperCase()}
            </span>
            <span className="text-sm text-muted-foreground">Priority: {order.priority}</span>
            {order.is_cod && (
              <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-medium">
                COD: Rs. {order.cod_amount}
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            Source: {order.source.toUpperCase()}
            {order.marketplace && ` | ${order.marketplace}`}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Customer */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" /> Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-medium">{order.customer_name}</p>
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" /> {order.customer_phone}
                  {order.customer_alt_phone && ` / ${order.customer_alt_phone}`}
                </p>
                {order.customer_email && (
                  <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                )}
              </div>
              <div>
                <p className="flex items-center gap-1 text-sm font-medium">
                  <MapPin className="h-3 w-3" /> Delivery Address
                </p>
                <p className="text-sm text-muted-foreground">{order.delivery_address}</p>
                <p className="text-sm text-muted-foreground">
                  {[order.delivery_city, order.delivery_state, order.delivery_postal_code].filter(Boolean).join(', ')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Product */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" /> Product Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium">{order.product_description}</p>
              {order.product_sku && <p className="text-sm text-muted-foreground">SKU: {order.product_sku}</p>}
              {order.product_category && <p className="text-sm text-muted-foreground">Category: {order.product_category}</p>}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="rounded border p-2 text-center">
                  <p className="text-xs text-muted-foreground">Packages</p>
                  <p className="font-medium">{order.package_count}</p>
                </div>
                <div className="rounded border p-2 text-center">
                  <p className="text-xs text-muted-foreground">Weight</p>
                  <p className="font-medium">{order.total_weight_kg ? `${order.total_weight_kg} kg` : '-'}</p>
                </div>
                <div className="rounded border p-2 text-center">
                  <p className="text-xs text-muted-foreground">Value</p>
                  <p className="font-medium">{order.declared_value ? `Rs. ${order.declared_value}` : '-'}</p>
                </div>
              </div>
              {order.seller_name && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground">Seller: {order.seller_name}</p>
                  {order.seller_order_ref && <p className="text-sm text-muted-foreground">Ref: {order.seller_order_ref}</p>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" /> Assignment & Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {order.route_name && <p className="text-sm">Route: <span className="font-medium">{order.route_name}</span></p>}
              {order.driver_name && <p className="text-sm">Driver: <span className="font-medium">{order.driver_name}</span></p>}
              {order.scheduled_date && <p className="text-sm">Scheduled: <span className="font-medium">{order.scheduled_date}</span></p>}
              {order.delivery_slot && <p className="text-sm">Slot: <span className="font-medium">{order.delivery_slot}</span></p>}

              <div className="pt-3 border-t space-y-1">
                <p className="text-xs text-muted-foreground">Created: {new Date(order.created_at).toLocaleString()}</p>
                {order.assigned_at && <p className="text-xs text-muted-foreground">Assigned: {new Date(order.assigned_at).toLocaleString()}</p>}
                {order.out_for_delivery_at && <p className="text-xs text-muted-foreground">Out for delivery: {new Date(order.out_for_delivery_at).toLocaleString()}</p>}
                {order.delivered_at && <p className="text-xs text-green-600">Delivered: {new Date(order.delivered_at).toLocaleString()}</p>}
                {order.failed_at && <p className="text-xs text-red-600">Failed: {new Date(order.failed_at).toLocaleString()}</p>}
                {order.returned_at && <p className="text-xs text-orange-600">Returned: {new Date(order.returned_at).toLocaleString()}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Attempts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Camera className="h-4 w-4" /> Delivery Attempts ({order.attempts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {order.attempts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No delivery attempts yet</p>
              ) : (
                <div className="space-y-3">
                  {order.attempts.map((attempt) => (
                    <div key={attempt.id} className="rounded border p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Attempt #{attempt.attempt_number}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          attempt.status === 'delivered' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {attempt.status}
                        </span>
                      </div>
                      {attempt.failure_reason && (
                        <p className="text-sm text-red-600 mt-1">
                          Reason: {attempt.failure_reason.replace(/_/g, ' ')}
                        </p>
                      )}
                      {attempt.failure_notes && (
                        <p className="text-sm text-muted-foreground mt-1">{attempt.failure_notes}</p>
                      )}
                      {attempt.recipient_name && (
                        <p className="text-sm text-muted-foreground mt-1">Received by: {attempt.recipient_name}</p>
                      )}
                      {attempt.otp_verified && (
                        <p className="text-xs text-green-600 mt-1">OTP Verified</p>
                      )}
                      {attempt.cod_collected && (
                        <p className="text-xs text-amber-600 mt-1">COD Collected: Rs. {attempt.cod_amount}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(attempt.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
