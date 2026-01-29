import Link from 'next/link';
import Image from 'next/image';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  formatCurrency,
  formatDate,
  formatTime,
  ORDER_STATUS_DISPLAY,
  ORDER_STATUS_FLOW,
} from '@lma/shared';
import {
  MapPin,
  Phone,
  Clock,
  Package,
  CheckCircle2,
  Circle,
  ArrowLeft,
  RotateCcw,
  MessageCircle,
  Star,
} from 'lucide-react';

interface OrderPageProps {
  params: { id: string };
  searchParams: { new?: string };
}

export async function generateMetadata({ params }: OrderPageProps) {
  return {
    title: `Order Details`,
  };
}

export default async function OrderDetailPage({ params, searchParams }: OrderPageProps) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/orders/${params.id}`);
  }

  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      merchants (
        id,
        business_name,
        slug,
        logo_url,
        phone,
        address_line_1,
        city
      ),
      drivers (
        id,
        users (
          first_name,
          last_name,
          phone,
          avatar_url
        ),
        vehicle_type,
        vehicle_number,
        average_rating
      ),
      order_items (
        id,
        product_name,
        variant_name,
        unit_price,
        quantity,
        total_price,
        special_instructions,
        order_item_addons (
          addon_name,
          quantity,
          total_price
        )
      ),
      order_status_history (
        status,
        created_at,
        notes
      ),
      payments (
        payment_method,
        status
      )
    `)
    .eq('id', params.id)
    .eq('customer_id', user.id)
    .single();

  if (error || !order) {
    notFound();
  }

  const merchant = order.merchants as {
    id: string;
    business_name: string;
    slug: string;
    logo_url: string | null;
    phone: string;
    address_line_1: string;
    city: string;
  };

  const driver = order.drivers as {
    id: string;
    users: {
      first_name: string;
      last_name: string;
      phone: string;
      avatar_url: string | null;
    };
    vehicle_type: string;
    vehicle_number: string;
    average_rating: number;
  } | null;

  const items = order.order_items as Array<{
    id: string;
    product_name: string;
    variant_name: string | null;
    unit_price: number;
    quantity: number;
    total_price: number;
    special_instructions: string | null;
    order_item_addons: Array<{
      addon_name: string;
      quantity: number;
      total_price: number;
    }>;
  }>;

  const statusHistory = order.order_status_history as Array<{
    status: string;
    created_at: string;
    notes: string | null;
  }>;

  const payment = (order.payments as Array<{
    payment_method: string;
    status: string;
  }>)?.[0];

  const deliveryAddress = order.delivery_address_snapshot as {
    label: string;
    address_line_1: string;
    address_line_2: string | null;
    city: string;
    state: string;
    postal_code: string;
  };

  const statusInfo = ORDER_STATUS_DISPLAY[order.status] || { label: order.status, color: '#6B7280' };
  const isNew = searchParams.new === 'true';

  // Get current status index
  const currentStatusIndex = ORDER_STATUS_FLOW.indexOf(order.status as typeof ORDER_STATUS_FLOW[number]);

  return (
    <div className="container py-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Order {order.order_number}</h1>
          <p className="text-sm text-muted-foreground">
            Placed on {formatDate(order.created_at)} at {formatTime(order.created_at)}
          </p>
        </div>
      </div>

      {/* Order Placed Confirmation */}
      {isNew && (
        <Card className="mb-6 bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-700">Order Placed Successfully!</h3>
                <p className="text-sm text-green-600">
                  We&apos;ve sent the order confirmation to your email
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Banner */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${statusInfo.color}20` }}
            >
              <Package className="h-6 w-6" style={{ color: statusInfo.color }} />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-lg">{statusInfo.label}</h2>
              {order.estimated_delivery_time && order.status !== 'delivered' && (
                <p className="text-sm text-muted-foreground">
                  Estimated delivery in {order.estimated_delivery_time} minutes
                </p>
              )}
            </div>
          </div>

          {/* Status Timeline */}
          <div className="mt-6 relative">
            <div className="flex justify-between">
              {['pending', 'confirmed', 'preparing', 'picked_up', 'delivered'].map((status, index) => {
                const statusIndex = ORDER_STATUS_FLOW.indexOf(status as typeof ORDER_STATUS_FLOW[number]);
                const isPast = currentStatusIndex >= statusIndex;
                const isCurrent = order.status === status;
                const statusLabel = ORDER_STATUS_DISPLAY[status]?.label || status;

                return (
                  <div key={status} className="flex flex-col items-center flex-1">
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center z-10 ${
                        isPast
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isPast ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </div>
                    <span className={`text-xs mt-2 text-center ${
                      isCurrent ? 'font-medium' : 'text-muted-foreground'
                    }`}>
                      {statusLabel}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Progress Line */}
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-muted -z-10">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${(currentStatusIndex / 4) * 100}%`,
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Driver Info (if assigned) */}
      {driver && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-muted overflow-hidden">
                {driver.users.avatar_url ? (
                  <Image
                    src={driver.users.avatar_url}
                    alt={driver.users.first_name}
                    width={56}
                    height={56}
                    className="object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-lg font-medium">
                    {driver.users.first_name[0]}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">
                  {driver.users.first_name} {driver.users.last_name}
                </h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span>{driver.average_rating.toFixed(1)}</span>
                  <span>•</span>
                  <span>{driver.vehicle_number}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon">
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Merchant & Delivery Info */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {/* Merchant */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Order From
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Link href={`/merchants/${merchant.slug}`} className="flex items-center gap-3 hover:text-primary">
              <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden">
                {merchant.logo_url ? (
                  <Image
                    src={merchant.logo_url}
                    alt={merchant.business_name}
                    width={40}
                    height={40}
                    className="object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-lg">
                    🏪
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-medium">{merchant.business_name}</h3>
                <p className="text-sm text-muted-foreground">
                  {merchant.address_line_1}, {merchant.city}
                </p>
              </div>
            </Link>
          </CardContent>
        </Card>

        {/* Delivery Address */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Deliver To
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium">{deliveryAddress.label}</h3>
                <p className="text-sm text-muted-foreground">
                  {deliveryAddress.address_line_1}
                  {deliveryAddress.address_line_2 && `, ${deliveryAddress.address_line_2}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {deliveryAddress.city}, {deliveryAddress.state} - {deliveryAddress.postal_code}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Items */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Order Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.quantity}x</span>
                    <span>{item.product_name}</span>
                  </div>
                  {item.variant_name && (
                    <p className="text-sm text-muted-foreground ml-6">
                      {item.variant_name}
                    </p>
                  )}
                  {item.order_item_addons?.length > 0 && (
                    <p className="text-sm text-muted-foreground ml-6">
                      + {item.order_item_addons.map((a) => a.addon_name).join(', ')}
                    </p>
                  )}
                  {item.special_instructions && (
                    <p className="text-sm text-muted-foreground italic ml-6">
                      Note: {item.special_instructions}
                    </p>
                  )}
                </div>
                <span className="font-medium">{formatCurrency(item.total_price)}</span>
              </div>
            ))}
          </div>

          <Separator className="my-4" />

          {/* Price Breakdown */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery Fee</span>
              <span>
                {order.delivery_fee === 0 ? (
                  <span className="text-green-600">FREE</span>
                ) : (
                  formatCurrency(order.delivery_fee)
                )}
              </span>
            </div>
            {order.service_fee > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service Fee</span>
                <span>{formatCurrency(order.service_fee)}</span>
              </div>
            )}
            {order.tip_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tip</span>
                <span>{formatCurrency(order.tip_amount)}</span>
              </div>
            )}
            {order.discount_amount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>- {formatCurrency(order.discount_amount)}</span>
              </div>
            )}
          </div>

          <Separator className="my-4" />

          <div className="flex justify-between font-semibold text-lg">
            <span>Total</span>
            <span>{formatCurrency(order.total_amount)}</span>
          </div>

          {payment && (
            <p className="text-sm text-muted-foreground mt-2">
              Paid via {payment.payment_method === 'card' ? 'Card' :
                       payment.payment_method === 'upi' ? 'UPI' :
                       payment.payment_method === 'cash' ? 'Cash on Delivery' :
                       payment.payment_method}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        {order.status === 'delivered' && (
          <Button variant="outline" className="flex-1">
            <Star className="h-4 w-4 mr-2" />
            Rate Order
          </Button>
        )}
        <Link href={`/merchants/${merchant.slug}`} className="flex-1">
          <Button variant="outline" className="w-full">
            <RotateCcw className="h-4 w-4 mr-2" />
            Reorder
          </Button>
        </Link>
        <Button variant="outline" className="flex-1">
          Need Help?
        </Button>
      </div>
    </div>
  );
}
