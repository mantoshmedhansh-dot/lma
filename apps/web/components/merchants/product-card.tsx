'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Plus, Minus, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@lma/shared';
import { useCartStore } from '@/lib/store/cart';
import { useToast } from '@/hooks/use-toast';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    price: number;
    compare_at_price: number | null;
    is_vegetarian: boolean;
    is_vegan: boolean;
    product_variants?: Array<{
      id: string;
      name: string;
      price_modifier: number;
      is_default: boolean;
      is_available: boolean;
    }>;
    product_addons?: Array<{
      id: string;
      name: string;
      price: number;
      max_quantity: number;
      is_required: boolean;
      is_available: boolean;
    }>;
  };
  merchant: {
    id: string;
    name: string;
    logo: string | null;
  };
}

export function ProductCard({ product, merchant }: ProductCardProps) {
  const { toast } = useToast();
  const addItem = useCartStore((state) => state.addItem);
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const merchantId = useCartStore((state) => state.merchantId);

  // Find if this product is already in cart
  const cartItem = items.find((item) => item.productId === product.id);
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCart = () => {
    // Check if cart has items from different merchant
    if (merchantId && merchantId !== merchant.id) {
      toast({
        title: 'Different restaurant',
        description: 'Your cart contains items from another restaurant. Would you like to clear it?',
        variant: 'destructive',
      });
      return;
    }

    // For products with variants/addons, we'd show a modal
    // For now, just add the base product
    addItem(merchant.id, merchant.name, merchant.logo, {
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: product.image_url || undefined,
    });

    toast({
      title: 'Added to cart',
      description: `${product.name} added to your cart`,
    });
  };

  const handleIncrement = () => {
    if (cartItem) {
      updateQuantity(product.id, cartItem.quantity + 1);
    }
  };

  const handleDecrement = () => {
    if (cartItem && cartItem.quantity > 1) {
      updateQuantity(product.id, cartItem.quantity - 1);
    } else if (cartItem) {
      updateQuantity(product.id, 0);
    }
  };

  const discount = product.compare_at_price
    ? Math.round((1 - product.price / product.compare_at_price) * 100)
    : 0;

  return (
    <div className="flex gap-4 p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow">
      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          {/* Veg/Non-veg indicator */}
          {(product.is_vegetarian || product.is_vegan) && (
            <div className={`shrink-0 h-5 w-5 border-2 flex items-center justify-center ${
              product.is_vegan ? 'border-green-600' : 'border-green-600'
            }`}>
              <div className={`h-2.5 w-2.5 rounded-full ${
                product.is_vegan ? 'bg-green-600' : 'bg-green-600'
              }`} />
            </div>
          )}
          <h3 className="font-medium truncate">{product.name}</h3>
        </div>

        {product.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {product.description}
          </p>
        )}

        <div className="flex items-center gap-2 mt-2">
          <span className="font-semibold">{formatCurrency(product.price)}</span>
          {product.compare_at_price && product.compare_at_price > product.price && (
            <>
              <span className="text-sm text-muted-foreground line-through">
                {formatCurrency(product.compare_at_price)}
              </span>
              <span className="text-xs text-green-600 font-medium">
                {discount}% off
              </span>
            </>
          )}
        </div>
      </div>

      {/* Image and Add Button */}
      <div className="relative shrink-0">
        <div className="h-24 w-24 rounded-lg bg-muted overflow-hidden">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              width={96}
              height={96}
              className="object-cover h-full w-full"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-3xl">
              🍽️
            </div>
          )}
        </div>

        {/* Add to Cart / Quantity Controls */}
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
          {cartItem ? (
            <div className="flex items-center gap-1 bg-primary text-primary-foreground rounded-lg shadow">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 hover:bg-primary/90"
                onClick={handleDecrement}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-6 text-center text-sm font-medium">
                {cartItem.quantity}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 hover:bg-primary/90"
                onClick={handleIncrement}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="h-8 shadow"
              onClick={handleAddToCart}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
