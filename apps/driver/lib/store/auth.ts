import { create } from 'zustand';
import { supabase } from '../supabase';
import type { User, Session } from '@supabase/supabase-js';

interface Driver {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  email: string;
  vehicle_type: string;
  vehicle_number: string;
  license_number: string;
  status: 'pending' | 'approved' | 'suspended';
  is_online: boolean;
  current_location: { lat: number; lng: number } | null;
  rating: number;
  total_deliveries: number;
  created_at: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  driver: Driver | null;
  loading: boolean;
  initialized: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setDriver: (driver: Driver | null) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (data: SignUpData) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  fetchDriver: () => Promise<void>;
  updateOnlineStatus: (isOnline: boolean) => Promise<void>;
  updateLocation: (lat: number, lng: number) => Promise<void>;
}

interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  vehicleType: string;
  vehicleNumber: string;
  licenseNumber: string;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  driver: null,
  loading: true,
  initialized: false,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setDriver: (driver) => set({ driver }),
  setLoading: (loading) => set({ loading }),

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        set({ user: session.user, session });
        await get().fetchDriver();
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        set({ user: session?.user ?? null, session });

        if (session) {
          await get().fetchDriver();
        } else {
          set({ driver: null });
        }
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
    } finally {
      set({ loading: false, initialized: true });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Check if user is a driver
      const { data: driver, error: driverError } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', data.user.id)
        .single();

      if (driverError || !driver) {
        await supabase.auth.signOut();
        throw new Error('No driver account found. Please register as a driver.');
      }

      set({ user: data.user, session: data.session, driver });
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    } finally {
      set({ loading: false });
    }
  },

  signUp: async (data) => {
    set({ loading: true });
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            phone: data.phone,
            role: 'driver',
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create account');

      // Create driver record
      const { error: driverError } = await supabase.from('drivers').insert({
        user_id: authData.user.id,
        full_name: data.fullName,
        phone: data.phone,
        email: data.email,
        vehicle_type: data.vehicleType,
        vehicle_number: data.vehicleNumber,
        license_number: data.licenseNumber,
        status: 'pending',
        is_online: false,
        rating: 0,
        total_deliveries: 0,
      });

      if (driverError) throw driverError;

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    set({ loading: true });
    try {
      // Set offline before signing out
      const driver = get().driver;
      if (driver) {
        await supabase
          .from('drivers')
          .update({ is_online: false })
          .eq('id', driver.id);
      }

      await supabase.auth.signOut();
      set({ user: null, session: null, driver: null });
    } finally {
      set({ loading: false });
    }
  },

  fetchDriver: async () => {
    const user = get().user;
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      set({ driver: data });
    } catch (error) {
      console.error('Error fetching driver:', error);
    }
  },

  updateOnlineStatus: async (isOnline) => {
    const driver = get().driver;
    if (!driver) return;

    try {
      const { error } = await supabase
        .from('drivers')
        .update({ is_online: isOnline })
        .eq('id', driver.id);

      if (error) throw error;
      set({ driver: { ...driver, is_online: isOnline } });
    } catch (error) {
      console.error('Error updating online status:', error);
    }
  },

  updateLocation: async (lat, lng) => {
    const driver = get().driver;
    if (!driver) return;

    try {
      const { error } = await supabase
        .from('drivers')
        .update({ current_location: { lat, lng } })
        .eq('id', driver.id);

      if (error) throw error;
      set({ driver: { ...driver, current_location: { lat, lng } } });
    } catch (error) {
      console.error('Error updating location:', error);
    }
  },
}));
