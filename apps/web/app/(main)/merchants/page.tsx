import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { MerchantCard } from '@/components/merchants/merchant-card';
import { Button } from '@/components/ui/button';
import { Filter, SlidersHorizontal } from 'lucide-react';

interface MerchantsPageProps {
  searchParams: {
    type?: string;
    sort?: string;
    featured?: string;
    q?: string;
  };
}

export const metadata = {
  title: 'Browse Merchants',
  description: 'Browse restaurants and stores near you',
};

export default async function MerchantsPage({ searchParams }: MerchantsPageProps) {
  const supabase = createClient();

  let query = supabase
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
    .eq('status', 'active');

  // Apply filters
  if (searchParams.type) {
    query = query.eq('merchant_type', searchParams.type);
  }

  if (searchParams.featured === 'true') {
    query = query.eq('is_featured', true);
  }

  if (searchParams.q) {
    query = query.or(`business_name.ilike.%${searchParams.q}%,description.ilike.%${searchParams.q}%`);
  }

  // Apply sorting
  if (searchParams.sort === 'popular') {
    query = query.order('total_ratings', { ascending: false });
  } else if (searchParams.sort === 'rating') {
    query = query.order('average_rating', { ascending: false });
  } else if (searchParams.sort === 'fast') {
    query = query.order('estimated_prep_time', { ascending: true });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data: merchants } = await query.limit(50);

  const typeLabels: Record<string, string> = {
    restaurant: 'Restaurants',
    grocery: 'Grocery Stores',
    pharmacy: 'Pharmacies',
    retail: 'Retail Stores',
  };

  const sortLabels: Record<string, string> = {
    popular: 'Most Popular',
    rating: 'Highest Rated',
    fast: 'Fastest Delivery',
  };

  const pageTitle = searchParams.type
    ? typeLabels[searchParams.type] || 'Merchants'
    : searchParams.featured === 'true'
    ? 'Featured'
    : searchParams.q
    ? `Search: "${searchParams.q}"`
    : 'All Merchants';

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{pageTitle}</h1>
          <p className="text-muted-foreground">
            {merchants?.length || 0} merchants found
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>

          {/* Sort Dropdown */}
          <select
            className="h-9 px-3 rounded-md border bg-background text-sm"
            defaultValue={searchParams.sort || ''}
          >
            <option value="">Sort by</option>
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="fast">Fastest Delivery</option>
          </select>
        </div>
      </div>

      {/* Type Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <a href="/merchants">
          <Button
            variant={!searchParams.type ? 'default' : 'outline'}
            size="sm"
          >
            All
          </Button>
        </a>
        {Object.entries(typeLabels).map(([type, label]) => (
          <a key={type} href={`/merchants?type=${type}`}>
            <Button
              variant={searchParams.type === type ? 'default' : 'outline'}
              size="sm"
            >
              {label}
            </Button>
          </a>
        ))}
      </div>

      {/* Merchants Grid */}
      {merchants && merchants.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {merchants.map((merchant) => (
            <MerchantCard key={merchant.id} merchant={merchant} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-semibold mb-2">No merchants found</h2>
          <p className="text-muted-foreground mb-6">
            Try adjusting your filters or search criteria
          </p>
          <a href="/merchants">
            <Button>View All Merchants</Button>
          </a>
        </div>
      )}
    </div>
  );
}
