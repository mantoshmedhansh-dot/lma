import { create } from 'zustand';
import { supabase } from '../supabase';

interface Merchant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: string;
  logo_url: string | null;
  cover_image_url: string | null;
  rating: number;
  total_reviews: number;
  delivery_fee: number;
  minimum_order: number;
  preparation_time: number;
  is_open: boolean;
  address: {
    street: string;
    city: string;
    state: string;
  };
}

interface Category {
  id: string;
  name: string;
  image_url: string | null;
}

interface Product {
  id: string;
  merchant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  image_url: string | null;
  is_available: boolean;
  is_featured: boolean;
  preparation_time: number | null;
}

interface MerchantsState {
  merchants: Merchant[];
  featuredMerchants: Merchant[];
  categories: Category[];
  currentMerchant: Merchant | null;
  currentProducts: Product[];
  loading: boolean;
  searchQuery: string;
  searchResults: Merchant[];
  fetchMerchants: () => Promise<void>;
  fetchFeaturedMerchants: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchMerchantBySlug: (slug: string) => Promise<void>;
  fetchProducts: (merchantId: string) => Promise<void>;
  searchMerchants: (query: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
}

export const useMerchantsStore = create<MerchantsState>((set, get) => ({
  merchants: [],
  featuredMerchants: [],
  categories: [],
  currentMerchant: null,
  currentProducts: [],
  loading: false,
  searchQuery: '',
  searchResults: [],

  fetchMerchants: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .eq('status', 'active')
        .order('rating', { ascending: false });

      if (error) throw error;
      set({ merchants: data || [] });
    } catch (error) {
      console.error('Error fetching merchants:', error);
    } finally {
      set({ loading: false });
    }
  },

  fetchFeaturedMerchants: async () => {
    try {
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .eq('status', 'active')
        .eq('is_featured', true)
        .order('rating', { ascending: false })
        .limit(10);

      if (error) throw error;
      set({ featuredMerchants: data || [] });
    } catch (error) {
      console.error('Error fetching featured merchants:', error);
    }
  },

  fetchCategories: async () => {
    try {
      // Merchant types as categories
      const categories = [
        { id: 'restaurant', name: 'Restaurants', image_url: null },
        { id: 'grocery', name: 'Grocery', image_url: null },
        { id: 'pharmacy', name: 'Pharmacy', image_url: null },
        { id: 'bakery', name: 'Bakery', image_url: null },
        { id: 'cafe', name: 'Cafe', image_url: null },
        { id: 'convenience', name: 'Convenience', image_url: null },
      ];
      set({ categories });
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  },

  fetchMerchantBySlug: async (slug) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) throw error;
      set({ currentMerchant: data });

      if (data) {
        await get().fetchProducts(data.id);
      }
    } catch (error) {
      console.error('Error fetching merchant:', error);
    } finally {
      set({ loading: false });
    }
  },

  fetchProducts: async (merchantId) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('is_available', true)
        .order('name');

      if (error) throw error;
      set({ currentProducts: data || [] });
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  },

  searchMerchants: async (query) => {
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }

    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .eq('status', 'active')
        .ilike('name', `%${query}%`)
        .order('rating', { ascending: false })
        .limit(20);

      if (error) throw error;
      set({ searchResults: data || [] });
    } catch (error) {
      console.error('Error searching merchants:', error);
    } finally {
      set({ loading: false });
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
}));
