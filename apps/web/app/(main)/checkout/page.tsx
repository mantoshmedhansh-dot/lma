'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useCartStore } from '@/lib/store/cart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  MapPin,
  CreditCard,
  Wallet,
  Banknote,
  Plus,
  Check,
  ArrowLeft,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { formatCurrency } from '@lma/shared';
import { useToast } from '@/hooks/use-toast';

interface Address {
  id: string;
  label: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  postal_code: string;
  is_default: boolean;
}

const paymentMethods = [
  { id: 'card', name: 'Credit/Debit Card', icon: CreditCard, description: 'Pay securely with card' },
  { id: 'upi', name: 'UPI', icon: Wallet, description: 'Google Pay, PhonePe, etc.' },
  { id: 'cash', name: 'Cash on Delivery', icon: Banknote, description: 'Pay when you receive' },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const {
    items,
    merchantId,
    merchantName,
    merchantLogo,
    getSubtotal,
    clearCart,
  } = useCartStore();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<string>('card');
  const [loading, setLoading] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [tipAmount, setTipAmount] = useState(0);

  const subtotal = getSubtotal();
  const deliveryFee = subtotal > 500 ? 0 : 40;
  const serviceFee = Math.round(subtotal * 0.05);
  const total = subtotal + deliveryFee + serviceFee + tipAmount;

  // Fetch user addresses
  useEffect(() => {
    async function fetchAddresses() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login?redirect=/checkout');
        return;
      }

      const { data } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });

      setAddresses(data || []);

      // Select default address
      const defaultAddress = data?.find((a) => a.is_default);
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
      } else if (data && data.length > 0) {
        setSelectedAddressId(data[0].id);
      }

      setLoadingAddresses(false);
    }

    fetchAddresses();
  }, [supabase, router]);

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0) {
      router.push('/cart');
    }
  }, [items, router]);

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      toast({
        title: 'Select address',
        description: 'Please select a delivery address',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login?redirect=/checkout');
        return;
      }

      // Get merchant details
      const { data: merchant } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', merchantId)
        .single();

      // Get address details
      const { data: address } = await supabase
        .from('addresses')
        .select('*')
        .eq('id', selectedAddressId)
        .single();

      if (!merchant || !address) {
        throw new Error('Invalid merchant or address');
      }

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: user.id,
          merchant_id: merchantId,
          status: 'pending',
          delivery_address_id: selectedAddressId,
          delivery_address_snapshot: {
            label: address.label,
            address_line_1: address.address_line_1,
            address_line_2: address.address_line_2,
            city: address.city,
            state: address.state,
            postal_code: address.postal_code,
            country: address.country,
          },
          delivery_latitude: address.latitude,
          delivery_longitude: address.longitude,
          pickup_address_snapshot: {
            address_line_1: merchant.address_line_1,
            address_line_2: merchant.address_line_2,
            city: merchant.city,
            state: merchant.state,
            postal_code: merchant.postal_code,
            country: merchant.country,
          },
          pickup_latitude: merchant.latitude,
          pickup_longitude: merchant.longitude,
          subtotal,
          delivery_fee: deliveryFee,
          service_fee: serviceFee,
          tax_amount: 0,
          discount_amount: 0,
          tip_amount: tipAmount,
          total_amount: total,
          estimated_prep_time: merchant.estimated_prep_time,
        })
        .select()
        .single();

      if (orderError || !order) {
        throw orderError || new Error('Failed to create order');
      }

      // Create order items
      for (const item of items) {
        const { error: itemError } = await supabase
          .from('order_items')
          .insert({
            order_id: order.id,
            product_id: item.productId,
            variant_id: item.variantId || null,
            product_name: item.name,
            variant_name: item.variantName || null,
            unit_price: item.price,
            quantity: item.quantity,
            total_price: item.price * item.quantity,
            special_instructions: item.specialInstructions || null,
          });

        if (itemError) {
          console.error('Error creating order item:', itemError);
        }
      }

      // Create payment record
      await supabase.from('payments').insert({
        order_id: order.id,
        user_id: user.id,
        amount: total,
        payment_method: selectedPayment,
        status: selectedPayment === 'cash' ? 'pending' : 'processing',
      });

      // Create order status history
      await supabase.from('order_status_history').insert({
        order_id: order.id,
        status: 'pending',
        changed_by: user.id,
      });

      // Clear cart
      clearCart();

      // Redirect to order confirmation
      router.push(`/orders/${order.id}?new=true`);
    } catch (error) {
      console.error('Error placing order:', error);
      toast({
        title: 'Error',
        description: 'Failed to place order. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="container py-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/cart">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Checkout</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Delivery Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Delivery Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAddresses ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : addresses.length > 0 ? (
                <div className="space-y-3">
                  {addresses.map((address) => (
                    <div
                      key={address.id}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                        selectedAddressId === address.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedAddressId(address.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                          selectedAddressId === address.id
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground'
                        }`}>
                          {selectedAddressId === address.id && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{address.label}</span>
                            {address.is_default && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {address.address_line_1}
                            {address.address_line_2 && `, ${address.address_line_2}`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {address.city}, {address.state} - {address.postal_code}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium mb-2">No addresses found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add a delivery address to continue
                  </p>
                </div>
              )}

              <Button variant="outline" className="w-full mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Add New Address
              </Button>
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      selectedPayment === method.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedPayment(method.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selectedPayment === method.id
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground'
                      }`}>
                        {selectedPayment === method.id && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                      </div>
                      <method.icon className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <span className="font-medium">{method.name}</span>
                        <p className="text-sm text-muted-foreground">
                          {method.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tip */}
          <Card>
            <CardHeader>
              <CardTitle>Add a tip for your delivery partner</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {[0, 20, 30, 50].map((amount) => (
                  <Button
                    key={amount}
                    variant={tipAmount === amount ? 'default' : 'outline'}
                    onClick={() => setTipAmount(amount)}
                    className="flex-1"
                  >
                    {amount === 0 ? 'No Tip' : `₹${amount}`}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Merchant & Items */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                {merchantLogo && (
                  <div className="h-10 w-10 rounded-lg bg-background overflow-hidden">
                    <Image
                      src={merchantLogo}
                      alt={merchantName || ''}
                      width={40}
                      height={40}
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium text-sm">{merchantName}</p>
                  <p className="text-xs text-muted-foreground">
                    {items.length} item{items.length > 1 ? 's' : ''}
                  </p>
                </div>
                <Link href="/cart" className="text-xs text-primary hover:underline">
                  Edit
                </Link>
              </div>

              <Separator />

              {/* Price Breakdown */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery Fee</span>
                  <span>
                    {deliveryFee === 0 ? (
                      <span className="text-green-600">FREE</span>
                    ) : (
                      formatCurrency(deliveryFee)
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service Fee</span>
                  <span>{formatCurrency(serviceFee)}</span>
                </div>
                {tipAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tip</span>
                    <span>{formatCurrency(tipAmount)}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
                <span>Your payment is secure and encrypted</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                size="lg"
                onClick={handlePlaceOrder}
                disabled={loading || !selectedAddressId}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Placing Order...
                  </>
                ) : (
                  `Place Order • ${formatCurrency(total)}`
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
