import { create } from 'zustand';
import { supabase } from '../supabase';

interface OrderItem {
  id: string;
  quantity: number;
  product: {
    name: string;
  };
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  delivery_fee: number;
  delivery_address: {
    street: string;
    city: string;
    state: string;
    postal_code: string;
    lat?: number;
    lng?: number;
  };
  delivery_instructions: string | null;
  created_at: string;
  estimated_delivery_time: string | null;
  merchant: {
    id: string;
    name: string;
    address: {
      street: string;
      city: string;
      lat?: number;
      lng?: number;
    };
    contact_phone: string;
  };
  customer: {
    full_name: string;
    phone: string;
  };
  items: OrderItem[];
}

interface ProofOfDelivery {
  delivery_type: 'standard' | 'contactless' | 'handed';
  photos: string[];
  signature: string | null;
  notes: string;
  cod_collected: boolean | null;
  cod_amount: number | null;
  completed_at: string;
}

interface OrdersState {
  availableOrders: Order[];
  activeOrder: Order | null;
  completedOrders: Order[];
  loading: boolean;
  fetchAvailableOrders: (driverId: string) => Promise<void>;
  fetchActiveOrder: (driverId: string) => Promise<void>;
  fetchCompletedOrders: (driverId: string) => Promise<void>;
  acceptOrder: (orderId: string, driverId: string) => Promise<{ error: Error | null }>;
  updateOrderStatus: (orderId: string, status: string) => Promise<{ error: Error | null }>;
  completeDelivery: (orderId: string, pod: ProofOfDelivery) => Promise<{ error: Error | null }>;
  subscribeToOrders: (driverId: string) => () => void;
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  availableOrders: [],
  activeOrder: null,
  completedOrders: [],
  loading: false,

  fetchAvailableOrders: async (driverId) => {
    set({ loading: true });
    try {
      // Fetch orders that are ready for pickup and not assigned
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total_amount,
          delivery_fee,
          delivery_address,
          delivery_instructions,
          created_at,
          estimated_delivery_time,
          merchant:merchants(id, name, address, contact_phone),
          customer:users!orders_customer_id_fkey(full_name, phone),
          items:order_items(id, quantity, product:products(name))
        `)
        .eq('status', 'ready')
        .is('driver_id', null)
        .order('created_at', { ascending: true })
        .limit(20);

      if (error) throw error;
      set({ availableOrders: data || [] });
    } catch (error) {
      console.error('Error fetching available orders:', error);
    } finally {
      set({ loading: false });
    }
  },

  fetchActiveOrder: async (driverId) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total_amount,
          delivery_fee,
          delivery_address,
          delivery_instructions,
          created_at,
          estimated_delivery_time,
          merchant:merchants(id, name, address, contact_phone),
          customer:users!orders_customer_id_fkey(full_name, phone),
          items:order_items(id, quantity, product:products(name))
        `)
        .eq('driver_id', driverId)
        .in('status', ['picked_up', 'ready'])
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      set({ activeOrder: data || null });
    } catch (error) {
      console.error('Error fetching active order:', error);
    }
  },

  fetchCompletedOrders: async (driverId) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total_amount,
          delivery_fee,
          delivery_address,
          created_at,
          merchant:merchants(id, name, address),
          customer:users!orders_customer_id_fkey(full_name)
        `)
        .eq('driver_id', driverId)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      set({ completedOrders: data || [] });
    } catch (error) {
      console.error('Error fetching completed orders:', error);
    } finally {
      set({ loading: false });
    }
  },

  acceptOrder: async (orderId, driverId) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          driver_id: driverId,
          status: 'picked_up',
        })
        .eq('id', orderId)
        .eq('status', 'ready')
        .is('driver_id', null);

      if (error) throw error;

      // Refresh orders
      await get().fetchAvailableOrders(driverId);
      await get().fetchActiveOrder(driverId);

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  updateOrderStatus: async (orderId, status) => {
    try {
      const updateData: any = { status };

      if (status === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      if (status === 'delivered') {
        set({ activeOrder: null });
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  completeDelivery: async (orderId, pod) => {
    try {
      // Upload photos to storage and get URLs
      const photoUrls: string[] = [];
      for (const photo of pod.photos) {
        // Convert file URI to blob for upload
        const response = await fetch(photo);
        const blob = await response.blob();
        const fileName = `pod/${orderId}/${Date.now()}-${photoUrls.length}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('deliveries')
          .upload(fileName, blob, {
            contentType: 'image/jpeg',
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('deliveries')
            .getPublicUrl(fileName);
          photoUrls.push(urlData.publicUrl);
        }
      }

      // Upload signature if present
      let signatureUrl: string | null = null;
      if (pod.signature) {
        // Signature is base64, convert to blob
        const signatureBlob = await fetch(pod.signature).then((r) => r.blob());
        const signatureFileName = `pod/${orderId}/signature.png`;

        const { error: sigUploadError } = await supabase.storage
          .from('deliveries')
          .upload(signatureFileName, signatureBlob, {
            contentType: 'image/png',
          });

        if (!sigUploadError) {
          const { data: sigUrlData } = supabase.storage
            .from('deliveries')
            .getPublicUrl(signatureFileName);
          signatureUrl = sigUrlData.publicUrl;
        }
      }

      // Create proof of delivery record
      const { error: podError } = await supabase.from('proof_of_delivery').insert({
        order_id: orderId,
        delivery_type: pod.delivery_type,
        photo_urls: photoUrls,
        signature_url: signatureUrl,
        notes: pod.notes,
        cod_collected: pod.cod_collected,
        cod_amount: pod.cod_amount,
        completed_at: pod.completed_at,
      });

      if (podError) throw podError;

      // Update order status
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'delivered',
          delivered_at: pod.completed_at,
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      set({ activeOrder: null });
      return { error: null };
    } catch (error) {
      console.error('Error completing delivery:', error);
      return { error: error as Error };
    }
  },

  subscribeToOrders: (driverId) => {
    const channel = supabase
      .channel('orders-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `status=eq.ready`,
        },
        () => {
          get().fetchAvailableOrders(driverId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
}));
