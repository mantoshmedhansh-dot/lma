'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { createClient } from '@/lib/supabase/client';
import { useCartStore } from '@/lib/store/cart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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

// Initialize Stripe outside component to avoid re-creating on every render
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

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

/** Helper to get Supabase auth token for API calls */
async function getAuthToken(): Promise<string | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/** Inner component that uses Stripe hooks (must be inside <Elements>) */
function StripePaymentForm({
  orderId,
  onSuccess,
  onError,
}: {
  orderId: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setPaying(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/orders/${orderId}?payment=success`,
      },
    });

    // If we get here, there was an error (success redirects)
    if (error) {
      onError(error.message || 'Payment failed. Please try again.');
    }
    setPaying(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={!stripe || !elements || paying}
      >
        {paying ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Processing Payment...
          </>
        ) : (
          'Pay Now'
        )}
      </Button>
    </form>
  );
}

type CheckoutStep = 'details' | 'payment';

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

  const [step, setStep] = useState<CheckoutStep>('details');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<string>('card');
  const [loading, setLoading] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [tipAmount, setTipAmount] = useState(0);

  // Stripe payment state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

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
    if (items.length === 0 && step === 'details') {
      router.push('/cart');
    }
  }, [items, router, step]);

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
      const token = await getAuthToken();
      if (!token) {
        router.push('/login?redirect=/checkout');
        return;
      }

      // Step 1: Create the order via API
      const orderPayload = {
        merchant_id: merchantId,
        delivery_address_id: selectedAddressId,
        items: items.map((item) => ({
          product_id: item.productId,
          variant_id: item.variantId || null,
          quantity: item.quantity,
          special_instructions: item.specialInstructions || null,
        })),
        payment_method: selectedPayment,
        tip_amount: tipAmount,
      };

      const orderRes = await fetch(`${API_URL}/orders/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(orderPayload),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => null);
        throw new Error(err?.detail || 'Failed to create order');
      }

      const order = await orderRes.json();
      const newOrderId = order.id;
      setOrderId(newOrderId);

      // Step 2: For cash — redirect immediately
      if (selectedPayment === 'cash') {
        clearCart();
        router.push(`/orders/${newOrderId}?new=true`);
        return;
      }

      // Step 3: For card/UPI — create Stripe PaymentIntent
      const intentRes = await fetch(`${API_URL}/payments/create-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          order_id: newOrderId,
          payment_method: selectedPayment,
        }),
      });

      if (!intentRes.ok) {
        const err = await intentRes.json().catch(() => null);
        throw new Error(err?.detail || 'Failed to create payment intent');
      }

      const intentData = await intentRes.json();
      setClientSecret(intentData.client_secret);

      // Clear cart now (order is created)
      clearCart();

      // Transition to payment step
      setStep('payment');
    } catch (error: any) {
      console.error('Error placing order:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to place order. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0 && step === 'details') {
    return null;
  }

  // --- PAYMENT STEP: Stripe Elements ---
  if (step === 'payment' && clientSecret && orderId) {
    return (
      <div className="container py-8 max-w-lg mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              // Go back to details step (order already created, so just redirect to order)
              router.push(`/orders/${orderId}`);
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Complete Payment</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Secure Payment
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter your card details to complete the order
            </p>
          </CardHeader>
          <CardContent>
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                },
              }}
            >
              <StripePaymentForm
                orderId={orderId}
                onSuccess={() => {
                  router.push(`/orders/${orderId}?payment=success`);
                }}
                onError={(msg) => {
                  toast({
                    title: 'Payment Error',
                    description: msg,
                    variant: 'destructive',
                  });
                }}
              />
            </Elements>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- DETAILS STEP: Address, Payment method, Tip, Summary ---
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
