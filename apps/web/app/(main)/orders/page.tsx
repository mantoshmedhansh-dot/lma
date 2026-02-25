import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, formatDate, ORDER_STATUS_DISPLAY } from '@lma/shared';
import { Package, ChevronRight, ShoppingBag } from 'lucide-react';

export const metadata = {
  title: 'Orders',
  description: 'View your order history',
};

export default async function OrdersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/orders');
  }

  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      status,
      total_amount,
      created_at,
      delivered_at,
      merchants (
        id,
        business_name,
        logo_url
      ),
      order_items (
        id,
        product_name,
        quantity
      )
    `)
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Your Orders</h1>

      {orders && orders.length > 0 ? (
        <div className="space-y-4">
          {orders.map((order) => {
            const merchant = order.merchants as unknown as { id: string; business_name: string; logo_url: string | null };
            const items = order.order_items as unknown as Array<{ id: string; product_name: string; quantity: number }>;
            const statusInfo = ORDER_STATUS_DISPLAY[order.status] || { label: order.status, color: '#6B7280' };

            return (
              <Link key={order.id} href={`/orders/${order.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {/* Merchant Logo */}
                      <div className="h-16 w-16 rounded-lg bg-muted overflow-hidden shrink-0">
                        {merchant?.logo_url ? (
                          <Image
                            src={merchant.logo_url}
                            alt={merchant.business_name}
                            width={64}
                            height={64}
                            className="object-cover h-full w-full"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <Package className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Order Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold">
                              {merchant?.business_name || 'Unknown Restaurant'}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {order.order_number} • {formatDate(order.created_at)}
                            </p>
                          </div>
                          <div
                            className="px-2 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `${statusInfo.color}20`,
                              color: statusInfo.color,
                            }}
                          >
                            {statusInfo.label}
                          </div>
                        </div>

                        {/* Items */}
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-1">
                          {items.map((item) => `${item.quantity}x ${item.product_name}`).join(', ')}
                        </p>

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-3">
                          <span className="font-semibold">
                            {formatCurrency(order.total_amount)}
                          </span>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📦</div>
          <h2 className="text-xl font-semibold mb-2">No orders yet</h2>
          <p className="text-muted-foreground mb-6">
            When you place orders, they will appear here
          </p>
          <Link href="/explore">
            <Button size="lg">
              <ShoppingBag className="mr-2 h-5 w-5" />
              Start Ordering
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
