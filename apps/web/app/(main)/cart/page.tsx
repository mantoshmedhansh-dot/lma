'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/lib/store/cart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Plus, Minus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@lma/shared';
import { useState } from 'react';

export default function CartPage() {
  const router = useRouter();
  const {
    items,
    merchantId,
    merchantName,
    merchantLogo,
    updateQuantity,
    removeItem,
    clearCart,
    getSubtotal,
  } = useCartStore();

  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount: number;
  } | null>(null);

  const subtotal = getSubtotal();
  const deliveryFee = subtotal > 500 ? 0 : 40; // Free delivery above ₹500
  const discount = appliedCoupon?.discount || 0;
  const total = subtotal + deliveryFee - discount;

  const handleApplyCoupon = () => {
    setCouponError(null);
    // Simple coupon validation - in production, this would call an API
    if (couponCode.toUpperCase() === 'FIRST50') {
      setAppliedCoupon({
        code: 'FIRST50',
        discount: Math.min(50, subtotal * 0.5),
      });
    } else if (couponCode.toUpperCase() === 'SAVE100') {
      if (subtotal >= 500) {
        setAppliedCoupon({
          code: 'SAVE100',
          discount: 100,
        });
      } else {
        setCouponError('Minimum order ₹500 required for this coupon');
      }
    } else {
      setCouponError('Invalid coupon code');
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  if (items.length === 0) {
    return (
      <div className="container py-16">
        <div className="max-w-md mx-auto text-center">
          <div className="text-6xl mb-4">🛒</div>
          <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
          <p className="text-muted-foreground mb-6">
            Add items from a restaurant or store to get started
          </p>
          <Link href="/explore">
            <Button size="lg">
              <ShoppingBag className="mr-2 h-5 w-5" />
              Browse Restaurants
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Your Cart</h1>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2">
          {/* Merchant Info */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {merchantLogo && (
                  <div className="h-12 w-12 rounded-lg bg-muted overflow-hidden">
                    <Image
                      src={merchantLogo}
                      alt={merchantName || ''}
                      width={48}
                      height={48}
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="font-semibold">{merchantName}</h2>
                  <p className="text-sm text-muted-foreground">
                    {items.length} item{items.length > 1 ? 's' : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCart}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardContent className="divide-y">
              {items.map((item) => (
                <div key={`${item.productId}-${item.variantId}`} className="py-4 first:pt-4 last:pb-4">
                  <div className="flex gap-4">
                    {/* Image */}
                    <div className="h-16 w-16 rounded-lg bg-muted overflow-hidden shrink-0">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.name}
                          width={64}
                          height={64}
                          className="object-cover h-full w-full"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-2xl">
                          🍽️
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium">{item.name}</h3>
                      {item.variantName && (
                        <p className="text-sm text-muted-foreground">
                          {item.variantName}
                        </p>
                      )}
                      {item.addons && item.addons.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          + {item.addons.map((a) => a.name).join(', ')}
                        </p>
                      )}
                      {item.specialInstructions && (
                        <p className="text-sm text-muted-foreground italic">
                          Note: {item.specialInstructions}
                        </p>
                      )}
                    </div>

                    {/* Price & Quantity */}
                    <div className="flex flex-col items-end gap-2">
                      <span className="font-semibold">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                      <div className="flex items-center gap-1 border rounded-lg">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Special Instructions */}
          <Card className="mt-4">
            <CardContent className="p-4">
              <label className="text-sm font-medium mb-2 block">
                Special Instructions (Optional)
              </label>
              <Input
                placeholder="Add a note for the restaurant..."
                className="w-full"
              />
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
              {/* Coupon */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Have a coupon?
                </label>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div>
                      <span className="font-medium text-green-700">
                        {appliedCoupon.code}
                      </span>
                      <span className="text-sm text-green-600 ml-2">
                        - {formatCurrency(appliedCoupon.discount)}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveCoupon}
                      className="text-red-600 hover:text-red-700 h-auto p-1"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter coupon code"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                    />
                    <Button variant="outline" onClick={handleApplyCoupon}>
                      Apply
                    </Button>
                  </div>
                )}
                {couponError && (
                  <p className="text-sm text-red-600 mt-1">{couponError}</p>
                )}
              </div>

              <Separator />

              {/* Price Breakdown */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery Fee</span>
                  <span>
                    {deliveryFee === 0 ? (
                      <span className="text-green-600">FREE</span>
                    ) : (
                      formatCurrency(deliveryFee)
                    )}
                  </span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>- {formatCurrency(discount)}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>

              {deliveryFee > 0 && (
                <p className="text-xs text-muted-foreground">
                  Add {formatCurrency(500 - subtotal)} more for free delivery
                </p>
              )}
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                size="lg"
                onClick={() => router.push('/checkout')}
              >
                Proceed to Checkout
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
