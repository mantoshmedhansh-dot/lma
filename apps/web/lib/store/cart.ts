import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  quantity: number;
  image?: string;
  addons?: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  specialInstructions?: string;
}

export interface CartState {
  merchantId: string | null;
  merchantName: string | null;
  merchantLogo: string | null;
  items: CartItem[];

  // Actions
  addItem: (merchantId: string, merchantName: string, merchantLogo: string | null, item: CartItem) => void;
  removeItem: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      merchantId: null,
      merchantName: null,
      merchantLogo: null,
      items: [],

      addItem: (merchantId, merchantName, merchantLogo, item) => {
        const state = get();

        // If cart has items from different merchant, clear first
        if (state.merchantId && state.merchantId !== merchantId) {
          set({
            merchantId,
            merchantName,
            merchantLogo,
            items: [item],
          });
          return;
        }

        // Check if item already exists
        const existingIndex = state.items.findIndex(
          (i) => i.productId === item.productId && i.variantId === item.variantId
        );

        if (existingIndex > -1) {
          // Update quantity
          const newItems = [...state.items];
          newItems[existingIndex].quantity += item.quantity;
          set({ items: newItems });
        } else {
          // Add new item
          set({
            merchantId,
            merchantName,
            merchantLogo,
            items: [...state.items, item],
          });
        }
      },

      removeItem: (productId, variantId) => {
        const state = get();
        const newItems = state.items.filter(
          (item) => !(item.productId === productId && item.variantId === variantId)
        );

        if (newItems.length === 0) {
          set({
            merchantId: null,
            merchantName: null,
            merchantLogo: null,
            items: [],
          });
        } else {
          set({ items: newItems });
        }
      },

      updateQuantity: (productId, quantity, variantId) => {
        const state = get();

        if (quantity <= 0) {
          get().removeItem(productId, variantId);
          return;
        }

        const newItems = state.items.map((item) => {
          if (item.productId === productId && item.variantId === variantId) {
            return { ...item, quantity };
          }
          return item;
        });

        set({ items: newItems });
      },

      clearCart: () => {
        set({
          merchantId: null,
          merchantName: null,
          merchantLogo: null,
          items: [],
        });
      },

      getSubtotal: () => {
        const state = get();
        return state.items.reduce((total, item) => {
          const itemTotal = item.price * item.quantity;
          const addonsTotal = item.addons?.reduce(
            (sum, addon) => sum + addon.price * addon.quantity,
            0
          ) || 0;
          return total + itemTotal + addonsTotal;
        }, 0);
      },

      getItemCount: () => {
        const state = get();
        return state.items.reduce((count, item) => count + item.quantity, 0);
      },
    }),
    {
      name: 'lma-cart',
    }
  )
);
