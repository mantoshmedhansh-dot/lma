import { create } from 'zustand';
import { supabase } from '../supabase';

interface DailyEarning {
  date: string;
  amount: number;
  deliveries: number;
}

interface EarningsState {
  todayEarnings: number;
  todayDeliveries: number;
  weekEarnings: number;
  weekDeliveries: number;
  monthEarnings: number;
  monthDeliveries: number;
  dailyEarnings: DailyEarning[];
  loading: boolean;
  fetchEarnings: (driverId: string) => Promise<void>;
}

export const useEarningsStore = create<EarningsState>((set) => ({
  todayEarnings: 0,
  todayDeliveries: 0,
  weekEarnings: 0,
  weekDeliveries: 0,
  monthEarnings: 0,
  monthDeliveries: 0,
  dailyEarnings: [],
  loading: false,

  fetchEarnings: async (driverId) => {
    set({ loading: true });
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      const weekStartStr = weekStart.toISOString();

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Fetch all delivered orders for this driver in the past month
      const { data: orders, error } = await supabase
        .from('orders')
        .select('delivery_fee, delivered_at')
        .eq('driver_id', driverId)
        .eq('status', 'delivered')
        .gte('delivered_at', monthStart)
        .order('delivered_at', { ascending: false });

      if (error) throw error;

      // Calculate earnings
      let todayEarnings = 0;
      let todayDeliveries = 0;
      let weekEarnings = 0;
      let weekDeliveries = 0;
      let monthEarnings = 0;
      let monthDeliveries = 0;

      const dailyMap = new Map<string, { amount: number; deliveries: number }>();

      orders?.forEach((order) => {
        const deliveredAt = new Date(order.delivered_at);
        const dateStr = deliveredAt.toISOString().split('T')[0];
        const fee = order.delivery_fee || 0;

        // Monthly
        monthEarnings += fee;
        monthDeliveries++;

        // Weekly
        if (deliveredAt >= weekStart) {
          weekEarnings += fee;
          weekDeliveries++;
        }

        // Today
        if (deliveredAt >= new Date(todayStart)) {
          todayEarnings += fee;
          todayDeliveries++;
        }

        // Daily breakdown
        const existing = dailyMap.get(dateStr) || { amount: 0, deliveries: 0 };
        dailyMap.set(dateStr, {
          amount: existing.amount + fee,
          deliveries: existing.deliveries + 1,
        });
      });

      // Convert daily map to array
      const dailyEarnings = Array.from(dailyMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 7);

      set({
        todayEarnings,
        todayDeliveries,
        weekEarnings,
        weekDeliveries,
        monthEarnings,
        monthDeliveries,
        dailyEarnings,
      });
    } catch (error) {
      console.error('Error fetching earnings:', error);
    } finally {
      set({ loading: false });
    }
  },
}));
