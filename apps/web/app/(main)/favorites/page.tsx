'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, ArrowLeft, Star, Clock, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FavoriteMerchant {
  id: string;
  merchant_id: string;
  merchants: {
    id: string;
    business_name: string;
    slug: string;
    logo_url: string | null;
    merchant_type: string;
    average_rating: number | null;
    estimated_prep_time: number | null;
    status: string;
  };
}

export default function FavoritesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClient();
  const [favorites, setFavorites] = useState<FavoriteMerchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login?redirect=/favorites');
      return;
    }

    const { data } = await supabase
      .from('user_favorites')
      .select(`
        id,
        merchant_id,
        merchants (
          id,
          business_name,
          slug,
          logo_url,
          merchant_type,
          average_rating,
          estimated_prep_time,
          status
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setFavorites((data as unknown as FavoriteMerchant[]) || []);
    setLoading(false);
  };

  const handleRemove = async (favoriteId: string) => {
    setRemoving(favoriteId);
    const { error } = await supabase
      .from('user_favorites')
      .delete()
      .eq('id', favoriteId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove favorite',
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Removed from favorites' });
      setFavorites((prev) => prev.filter((f) => f.id !== favoriteId));
    }
    setRemoving(null);
  };

  return (
    <div className="container py-8 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/profile">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Favorites</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : favorites.length > 0 ? (
        <div className="space-y-4">
          {favorites.map((fav) => (
            <Card key={fav.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {fav.merchants.logo_url ? (
                      <img
                        src={fav.merchants.logo_url}
                        alt={fav.merchants.business_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl">🏪</span>
                    )}
                  </div>
                  <Link
                    href={`/merchants/${fav.merchants.slug}`}
                    className="flex-1 min-w-0"
                  >
                    <h3 className="font-semibold truncate">
                      {fav.merchants.business_name}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      <span className="capitalize">{fav.merchants.merchant_type}</span>
                      {fav.merchants.average_rating && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {fav.merchants.average_rating.toFixed(1)}
                        </span>
                      )}
                      {fav.merchants.estimated_prep_time && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {fav.merchants.estimated_prep_time} min
                        </span>
                      )}
                    </div>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(fav.id)}
                    disabled={removing === fav.id}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    {removing === fav.id ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Heart className="h-5 w-5 fill-current" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No favorites yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Save your favorite restaurants and stores for quick access
            </p>
            <Link href="/explore">
              <Button>Browse Merchants</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
