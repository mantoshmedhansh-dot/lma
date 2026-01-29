import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { MerchantCard } from '@/components/merchants/merchant-card';
import { CategoryCard } from '@/components/merchants/category-card';
import { Search, MapPin, ChevronRight } from 'lucide-react';

// Categories with icons
const categories = [
  { name: 'Restaurants', slug: 'restaurant', icon: '🍽️', color: 'bg-orange-100' },
  { name: 'Grocery', slug: 'grocery', icon: '🛒', color: 'bg-green-100' },
  { name: 'Pharmacy', slug: 'pharmacy', icon: '💊', color: 'bg-blue-100' },
  { name: 'Retail', slug: 'retail', icon: '🛍️', color: 'bg-purple-100' },
];

export default async function ExplorePage() {
  const supabase = createClient();

  // Fetch featured merchants
  const { data: featuredMerchants } = await supabase
    .from('merchants')
    .select(`
      id,
      business_name,
      slug,
      logo_url,
      cover_image_url,
      merchant_type,
      average_rating,
      total_ratings,
      estimated_prep_time,
      min_order_amount,
      city
    `)
    .eq('status', 'active')
    .eq('is_featured', true)
    .limit(8);

  // Fetch popular merchants
  const { data: popularMerchants } = await supabase
    .from('merchants')
    .select(`
      id,
      business_name,
      slug,
      logo_url,
      cover_image_url,
      merchant_type,
      average_rating,
      total_ratings,
      estimated_prep_time,
      min_order_amount,
      city
    `)
    .eq('status', 'active')
    .order('total_ratings', { ascending: false })
    .limit(8);

  // Fetch nearby merchants (simplified - would use geolocation in production)
  const { data: nearbyMerchants } = await supabase
    .from('merchants')
    .select(`
      id,
      business_name,
      slug,
      logo_url,
      cover_image_url,
      merchant_type,
      average_rating,
      total_ratings,
      estimated_prep_time,
      min_order_amount,
      city
    `)
    .eq('status', 'active')
    .limit(8);

  return (
    <div className="pb-12">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary/10 to-primary/5 py-12">
        <div className="container">
          <div className="max-w-2xl">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              What would you like to order today?
            </h1>
            <p className="text-muted-foreground mb-6">
              Order from your favorite restaurants and stores
            </p>

            {/* Search Box */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search for restaurants, dishes, groceries..."
                  className="w-full h-12 pl-10 pr-4 rounded-lg border bg-background"
                />
              </div>
              <Button size="lg" className="h-12 px-6">
                Search
              </Button>
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>Delivering to:</span>
              <Button variant="link" className="p-0 h-auto text-primary">
                Select your location
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-8">
        <div className="container">
          <h2 className="text-xl font-semibold mb-4">Categories</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map((category) => (
              <CategoryCard key={category.slug} {...category} />
            ))}
          </div>
        </div>
      </section>

      {/* Featured Merchants */}
      {featuredMerchants && featuredMerchants.length > 0 && (
        <section className="py-8">
          <div className="container">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Featured</h2>
              <Link href="/merchants?featured=true">
                <Button variant="ghost" className="text-primary">
                  View all
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {featuredMerchants.map((merchant) => (
                <MerchantCard key={merchant.id} merchant={merchant} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Popular Merchants */}
      {popularMerchants && popularMerchants.length > 0 && (
        <section className="py-8">
          <div className="container">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Popular Near You</h2>
              <Link href="/merchants?sort=popular">
                <Button variant="ghost" className="text-primary">
                  View all
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {popularMerchants.map((merchant) => (
                <MerchantCard key={merchant.id} merchant={merchant} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* All Merchants */}
      {nearbyMerchants && nearbyMerchants.length > 0 && (
        <section className="py-8">
          <div className="container">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">All Restaurants & Stores</h2>
              <Link href="/merchants">
                <Button variant="ghost" className="text-primary">
                  View all
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {nearbyMerchants.map((merchant) => (
                <MerchantCard key={merchant.id} merchant={merchant} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Empty State */}
      {(!nearbyMerchants || nearbyMerchants.length === 0) && (
        <section className="py-16">
          <div className="container text-center">
            <div className="max-w-md mx-auto">
              <div className="text-6xl mb-4">🏪</div>
              <h2 className="text-xl font-semibold mb-2">No merchants yet</h2>
              <p className="text-muted-foreground mb-6">
                We&apos;re working on bringing merchants to your area. Check back soon!
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
