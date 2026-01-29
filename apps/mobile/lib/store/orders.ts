import { create } from 'zustand';
import { supabase } from '../supabase';

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  product: {
    name: string;
    image_url: string | null;
  };
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  subtotal: number;
  delivery_fee: number;
  delivery_address: {
    street: string;
    city: string;
    state: string;
    postal_code: string;
  };
  delivery_instructions: string | null;
  created_at: string;
  estimated_delivery_time: string | null;
  delivered_at: string | null;
  merchant: {
    id: string;
    name: string;
    logo_url: string | null;
    contact_phone: string;
  };
  driver: {
    id: string;
    full_name: string;
    phone: string;
    current_location: { lat: number; lng: number } | null;
  } | null;
  items: OrderItem[];
}

interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  postal_code: string;
  is_default: boolean;
}

interface OrdersState {
  orders: Order[];
  currentOrder: Order | null;
  addresses: Address[];
  defaultAddress: Address | null;
  loading: boolean;
  fetchOrders: (userId: string) => Promise<void>;
  fetchOrderById: (orderId: string) => Promise<void>;
  fetchAddresses: (userId: string) => Promise<void>;
  createOrder: (orderData: CreateOrderData) => Promise<{ orderId: string | null; error: Error | null }>;
  addAddress: (userId: string, address: Omit<Address, 'id'>) => Promise<{ error: Error | null }>;
  setDefaultAddress: (addressId: string, userId: string) => Promise<void>;
  subscribeToOrder: (orderId: string) => () => void;
}

interface CreateOrderData {
  userId: string;
  merchantId: string;
  items: { productId: string; quantity: number; price: number }[];
  addressId: string;
  deliveryInstructions?: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  orders: [],
  currentOrder: null,
  addresses: [],
  defaultAddress: null,
  loading: false,

  fetchOrders: async (userId) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total_amount,
          subtotal,
          delivery_fee,
          delivery_address,
          created_at,
          estimated_delivery_time,
          delivered_at,
          merchant:merchants(id, name, logo_url)
        `)
        .eq('customer_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ orders: data || [] });
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      set({ loading: false });
    }
  },

  fetchOrderById: async (orderId) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total_amount,
          subtotal,
          delivery_fee,
          delivery_address,
          delivery_instructions,
          created_at,
          estimated_delivery_time,
          delivered_at,
          merchant:merchants(id, name, logo_url, contact_phone),
          driver:drivers(id, full_name, phone, current_location),
          items:order_items(id, quantity, unit_price, product:products(name, image_url))
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      set({ currentOrder: data });
    } catch (error) {
      console.error('Error fetching order:', error);
    } finally {
      set({ loading: false });
    }
  },

  fetchAddresses: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false });

      if (error) throw error;

      const addresses = data || [];
      const defaultAddress = addresses.find((a) => a.is_default) || addresses[0] || null;

      set({ addresses, defaultAddress });
    } catch (error) {
      console.error('Error fetching addresses:', error);
    }
  },

  createOrder: async (orderData) => {
    try {
      // Get the address
      const { data: address } = await supabase
        .from('addresses')
        .select('*')
        .eq('id', orderData.addressId)
        .single();

      if (!address) throw new Error('Address not found');

      // Generate order number
      const orderNumber = `LMA${Date.now().toString(36).toUpperCase()}`;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          customer_id: orderData.userId,
          merchant_id: orderData.merchantId,
          status: 'pending',
          subtotal: orderData.subtotal,
          delivery_fee: orderData.deliveryFee,
          total_amount: orderData.total,
          delivery_address: {
            street: address.street,
            city: address.city,
            state: address.state,
            postal_code: address.postal_code,
          },
          delivery_instructions: orderData.deliveryInstructions || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = orderData.items.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      return { orderId: order.id, error: null };
    } catch (error) {
      return { orderId: null, error: error as Error };
    }
  },

  addAddress: async (userId, addressData) => {
    try {
      // If setting as default, unset other defaults first
      if (addressData.is_default) {
        await supabase
          .from('addresses')
          .update({ is_default: false })
          .eq('user_id', userId);
      }

      const { error } = await supabase.from('addresses').insert({
        user_id: userId,
        ...addressData,
      });

      if (error) throw error;

      await get().fetchAddresses(userId);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  setDefaultAddress: async (addressId, userId) => {
    try {
      // Unset all defaults
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', userId);

      // Set new default
      await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', addressId);

      await get().fetchAddresses(userId);
    } catch (error) {
      console.error('Error setting default address:', error);
    }
  },

  subscribeToOrder: (orderId) => {
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        () => {
          get().fetchOrderById(orderId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
}));
