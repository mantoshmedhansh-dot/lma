import { createClient } from '@/lib/supabase/server';
import { MerchantCard } from '@/components/merchants/merchant-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import Link from 'next/link';

interface SearchPageProps {
  searchParams: {
    q?: string;
  };
}

export const metadata = {
  title: 'Search',
  description: 'Search for restaurants, dishes, and more',
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = searchParams.q || '';
  const supabase = createClient();

  let merchants: typeof merchantsData = [];
  let products: typeof productsData = [];

  // Search merchants
  const { data: merchantsData } = await supabase
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
    .or(`business_name.ilike.%${query}%,description.ilike.%${query}%`)
    .limit(20);

  // Search products
  const { data: productsData } = await supabase
    .from('products')
    .select(`
      id,
      name,
      description,
      image_url,
      price,
      is_vegetarian,
      merchants!inner (
        id,
        business_name,
        slug,
        status
      )
    `)
    .eq('is_available', true)
    .eq('merchants.status', 'active')
    .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
    .limit(20);

  merchants = merchantsData || [];
  products = productsData || [];

  return (
    <div className="container py-8">
      {/* Search Form */}
      <form className="max-w-2xl mx-auto mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            name="q"
            placeholder="Search for restaurants, dishes, groceries..."
            defaultValue={query}
            className="h-14 pl-12 pr-4 text-lg"
          />
        </div>
      </form>

      {query ? (
        <>
          {/* Results Summary */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold">
              Search results for &quot;{query}&quot;
            </h1>
            <p className="text-muted-foreground">
              {merchants.length + products.length} results found
            </p>
          </div>

          {/* Merchants Section */}
          {merchants.length > 0 && (
            <section className="mb-12">
              <h2 className="text-xl font-semibold mb-4">
                Restaurants & Stores ({merchants.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {merchants.map((merchant) => (
                  <MerchantCard key={merchant.id} merchant={merchant} />
                ))}
              </div>
            </section>
          )}

          {/* Products Section */}
          {products.length > 0 && (
            <section className="mb-12">
              <h2 className="text-xl font-semibold mb-4">
                Dishes & Items ({products.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((product) => {
                  const merchant = product.merchants as unknown as {
                    id: string;
                    business_name: string;
                    slug: string;
                  };
                  return (
                    <Link
                      key={product.id}
                      href={`/merchants/${merchant.slug}`}
                      className="flex gap-4 p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                    >
                      <div className="h-20 w-20 rounded-lg bg-muted overflow-hidden shrink-0">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-2xl">
                            🍽️
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          {product.is_vegetarian && (
                            <div className="shrink-0 h-4 w-4 border-2 border-green-600 flex items-center justify-center mt-1">
                              <div className="h-2 w-2 rounded-full bg-green-600" />
                            </div>
                          )}
                          <h3 className="font-medium truncate">{product.name}</h3>
                        </div>
                        {product.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {product.description}
                          </p>
                        )}
                        <p className="text-sm text-primary mt-1">
                          {merchant.business_name}
                        </p>
                        <p className="font-semibold mt-1">
                          ₹{product.price}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* No Results */}
          {merchants.length === 0 && products.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🔍</div>
              <h2 className="text-xl font-semibold mb-2">No results found</h2>
              <p className="text-muted-foreground mb-6">
                Try searching for something else
              </p>
              <Link href="/explore">
                <Button>Browse All</Button>
              </Link>
            </div>
          )}
        </>
      ) : (
        /* No Query - Show suggestions */
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-semibold mb-2">What are you looking for?</h2>
          <p className="text-muted-foreground mb-6">
            Search for restaurants, dishes, groceries, and more
          </p>

          {/* Popular Searches */}
          <div className="max-w-md mx-auto">
            <h3 className="text-sm font-medium mb-3">Popular Searches</h3>
            <div className="flex flex-wrap justify-center gap-2">
              {['Pizza', 'Biryani', 'Burger', 'Chinese', 'Ice Cream', 'Coffee'].map((term) => (
                <Link key={term} href={`/search?q=${term}`}>
                  <Button variant="outline" size="sm">
                    {term}
                  </Button>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
