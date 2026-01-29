import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image_url: string | null;
}

interface CartMerchant {
  id: string;
  name: string;
  slug: string;
  delivery_fee: number;
  minimum_order: number;
}

interface CartState {
  items: CartItem[];
  merchant: CartMerchant | null;
  addItem: (product: any, merchant: CartMerchant) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getItemCount: () => number;
  getSubtotal: () => number;
  getTotal: () => number;
}

const zustandStorage = {
  getItem: async (name: string) => {
    const value = await SecureStore.getItemAsync(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string) => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string) => {
    await SecureStore.deleteItemAsync(name);
  },
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      merchant: null,

      addItem: (product, merchant) => {
        const { items, merchant: currentMerchant } = get();

        // If cart has items from different merchant, clear first
        if (currentMerchant && currentMerchant.id !== merchant.id) {
          set({ items: [], merchant: null });
        }

        const existingItem = items.find((item) => item.productId === product.id);

        if (existingItem) {
          set({
            items: items.map((item) =>
              item.productId === product.id
                ? { ...item, quantity: item.quantity + 1 }
                : item
            ),
            merchant,
          });
        } else {
          set({
            items: [
              ...items,
              {
                id: `${product.id}-${Date.now()}`,
                productId: product.id,
                name: product.name,
                price: product.price,
                quantity: 1,
                image_url: product.image_url,
              },
            ],
            merchant,
          });
        }
      },

      removeItem: (productId) => {
        const { items } = get();
        const newItems = items.filter((item) => item.productId !== productId);
        set({
          items: newItems,
          merchant: newItems.length === 0 ? null : get().merchant,
        });
      },

      updateQuantity: (productId, quantity) => {
        const { items } = get();

        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }

        set({
          items: items.map((item) =>
            item.productId === productId ? { ...item, quantity } : item
          ),
        });
      },

      clearCart: () => set({ items: [], merchant: null }),

      getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      getSubtotal: () => {
        return get().items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
      },

      getTotal: () => {
        const subtotal = get().getSubtotal();
        const deliveryFee = get().merchant?.delivery_fee || 0;
        return subtotal + deliveryFee;
      },
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);
