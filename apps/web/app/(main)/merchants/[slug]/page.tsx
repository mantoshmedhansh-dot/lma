import Image from 'next/image';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Star, Clock, MapPin, Phone, Globe, Info } from 'lucide-react';
import { formatCurrency } from '@lma/shared';
import { ProductCard } from '@/components/merchants/product-card';
import { Button } from '@/components/ui/button';

interface MerchantPageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: MerchantPageProps) {
  const supabase = createClient();
  const { data: merchant } = await supabase
    .from('merchants')
    .select('business_name, description')
    .eq('slug', params.slug)
    .single();

  if (!merchant) {
    return { title: 'Merchant Not Found' };
  }

  return {
    title: merchant.business_name,
    description: merchant.description || `Order from ${merchant.business_name} on LMA`,
  };
}

export default async function MerchantPage({ params }: MerchantPageProps) {
  const supabase = createClient();

  // Fetch merchant details
  const { data: merchant, error } = await supabase
    .from('merchants')
    .select(`
      *,
      merchant_hours (*),
      product_categories (
        id,
        name,
        description,
        display_order,
        products (
          id,
          name,
          description,
          image_url,
          price,
          compare_at_price,
          is_vegetarian,
          is_vegan,
          is_available,
          is_featured,
          display_order,
          product_variants (
            id,
            name,
            price_modifier,
            is_default,
            is_available
          ),
          product_addons (
            id,
            name,
            price,
            max_quantity,
            is_required,
            is_available
          )
        )
      )
    `)
    .eq('slug', params.slug)
    .eq('status', 'active')
    .single();

  if (error || !merchant) {
    notFound();
  }

  // Sort and filter product categories
  const categories = merchant.product_categories
    ?.sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order)
    .map((cat: { products: Array<{ is_available: boolean; display_order: number }>; [key: string]: unknown }) => ({
      ...cat,
      products: cat.products
        ?.filter((p: { is_available: boolean }) => p.is_available)
        .sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order) || [],
    }))
    .filter((cat: { products: unknown[] }) => cat.products.length > 0) || [];

  // Check if merchant is currently open (simplified)
  const isOpen = true; // Would calculate from merchant_hours

  const merchantTypeLabels: Record<string, string> = {
    restaurant: 'Restaurant',
    grocery: 'Grocery Store',
    pharmacy: 'Pharmacy',
    retail: 'Retail Store',
    other: 'Store',
  };

  return (
    <div className="pb-20">
      {/* Cover Image */}
      <div className="relative h-48 md:h-64 bg-muted">
        {merchant.cover_image_url ? (
          <Image
            src={merchant.cover_image_url}
            alt={merchant.business_name}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/10" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      <div className="container -mt-16 relative">
        {/* Merchant Info Card */}
        <div className="bg-card rounded-lg border shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Logo */}
            {merchant.logo_url && (
              <div className="h-20 w-20 rounded-lg border bg-background overflow-hidden shrink-0">
                <Image
                  src={merchant.logo_url}
                  alt={merchant.business_name}
                  width={80}
                  height={80}
                  className="object-cover"
                />
              </div>
            )}

            {/* Details */}
            <div className="flex-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold">{merchant.business_name}</h1>
                  <p className="text-muted-foreground">
                    {merchantTypeLabels[merchant.merchant_type] || 'Store'}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  isOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {isOpen ? 'Open' : 'Closed'}
                </div>
              </div>

              {merchant.description && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {merchant.description}
                </p>
              )}

              {/* Stats */}
              <div className="flex flex-wrap items-center gap-4 mt-4">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">
                    {merchant.average_rating > 0 ? merchant.average_rating.toFixed(1) : 'New'}
                  </span>
                  {merchant.total_ratings > 0 && (
                    <span className="text-sm text-muted-foreground">
                      ({merchant.total_ratings} reviews)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{merchant.estimated_prep_time} min</span>
                </div>

                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{merchant.city}</span>
                </div>

                {merchant.min_order_amount > 0 && (
                  <span className="text-sm text-muted-foreground">
                    Min. {formatCurrency(merchant.min_order_amount)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
            {merchant.phone && (
              <a href={`tel:${merchant.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <Phone className="h-4 w-4" />
                {merchant.phone}
              </a>
            )}
            {merchant.website && (
              <a href={merchant.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <Globe className="h-4 w-4" />
                Website
              </a>
            )}
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <Info className="h-4 w-4" />
              More Info
            </button>
          </div>
        </div>

        {/* Menu */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Category Navigation (Desktop) */}
          <div className="hidden lg:block">
            <div className="sticky top-20">
              <h3 className="font-semibold mb-4">Menu</h3>
              <nav className="space-y-1">
                {categories.map((category: { id: string; name: string }) => (
                  <a
                    key={category.id}
                    href={`#category-${category.id}`}
                    className="block px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors"
                  >
                    {category.name}
                  </a>
                ))}
              </nav>
            </div>
          </div>

          {/* Products */}
          <div className="lg:col-span-3">
            {categories.length > 0 ? (
              categories.map((category: { id: string; name: string; description?: string; products: Array<{ id: string }> }) => (
                <div key={category.id} id={`category-${category.id}`} className="mb-8">
                  <h2 className="text-xl font-semibold mb-2">{category.name}</h2>
                  {category.description && (
                    <p className="text-sm text-muted-foreground mb-4">{category.description}</p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {category.products.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product as Parameters<typeof ProductCard>[0]['product']}
                        merchant={{
                          id: merchant.id,
                          name: merchant.business_name,
                          logo: merchant.logo_url,
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">📋</div>
                <h3 className="font-semibold mb-2">Menu coming soon</h3>
                <p className="text-muted-foreground">
                  This merchant hasn&apos;t added their menu yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
