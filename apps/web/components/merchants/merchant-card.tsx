import Link from 'next/link';
import Image from 'next/image';
import { Star, Clock, MapPin } from 'lucide-react';
import { formatCurrency } from '@lma/shared';

interface MerchantCardProps {
  merchant: {
    id: string;
    business_name: string;
    slug: string;
    logo_url: string | null;
    cover_image_url: string | null;
    merchant_type: string;
    average_rating: number;
    total_ratings: number;
    estimated_prep_time: number;
    min_order_amount: number;
    city?: string;
  };
}

export function MerchantCard({ merchant }: MerchantCardProps) {
  const merchantTypeLabels: Record<string, string> = {
    restaurant: 'Restaurant',
    grocery: 'Grocery',
    pharmacy: 'Pharmacy',
    retail: 'Retail',
    other: 'Store',
  };

  return (
    <Link href={`/merchants/${merchant.slug}`}>
      <div className="group rounded-lg border bg-card overflow-hidden hover:shadow-md transition-shadow">
        {/* Cover Image */}
        <div className="relative h-36 bg-muted">
          {merchant.cover_image_url ? (
            <Image
              src={merchant.cover_image_url}
              alt={merchant.business_name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10">
              <span className="text-4xl">
                {merchant.merchant_type === 'restaurant' ? '🍽️' :
                 merchant.merchant_type === 'grocery' ? '🛒' :
                 merchant.merchant_type === 'pharmacy' ? '💊' : '🏪'}
              </span>
            </div>
          )}

          {/* Logo overlay */}
          {merchant.logo_url && (
            <div className="absolute -bottom-6 left-4">
              <div className="h-14 w-14 rounded-lg border-2 border-background bg-background overflow-hidden shadow-sm">
                <Image
                  src={merchant.logo_url}
                  alt={merchant.business_name}
                  width={56}
                  height={56}
                  className="object-cover"
                />
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className={`p-4 ${merchant.logo_url ? 'pt-8' : ''}`}>
          <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
            {merchant.business_name}
          </h3>

          <p className="text-xs text-muted-foreground mt-1">
            {merchantTypeLabels[merchant.merchant_type] || 'Store'}
            {merchant.city && ` • ${merchant.city}`}
          </p>

          <div className="flex items-center gap-3 mt-3 text-sm">
            {/* Rating */}
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">
                {merchant.average_rating > 0 ? merchant.average_rating.toFixed(1) : 'New'}
              </span>
              {merchant.total_ratings > 0 && (
                <span className="text-muted-foreground">
                  ({merchant.total_ratings})
                </span>
              )}
            </div>

            {/* Prep Time */}
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{merchant.estimated_prep_time} min</span>
            </div>
          </div>

          {/* Min Order */}
          {merchant.min_order_amount > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Min. order: {formatCurrency(merchant.min_order_amount)}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
