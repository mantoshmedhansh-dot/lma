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

      // Fetch delivered orders from delivery_orders table
      const { data: orders, error } = await supabase
        .from('delivery_orders')
        .select('cod_amount, is_cod, delivered_at, updated_at')
        .eq('driver_id', driverId)
        .eq('status', 'delivered')
        .gte('updated_at', monthStart)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      let todayEarnings = 0;
      let todayDeliveries = 0;
      let weekEarnings = 0;
      let weekDeliveries = 0;
      let monthEarnings = 0;
      let monthDeliveries = 0;

      const dailyMap = new Map<string, { amount: number; deliveries: number }>();

      orders?.forEach((order) => {
        const completedAt = new Date(order.delivered_at || order.updated_at);
        const dateStr = completedAt.toISOString().split('T')[0];
        const amount = order.is_cod ? (order.cod_amount || 0) : 0;

        monthEarnings += amount;
        monthDeliveries++;

        if (completedAt >= weekStart) {
          weekEarnings += amount;
          weekDeliveries++;
        }

        if (completedAt >= new Date(todayStart)) {
          todayEarnings += amount;
          todayDeliveries++;
        }

        const existing = dailyMap.get(dateStr) || { amount: 0, deliveries: 0 };
        dailyMap.set(dateStr, {
          amount: existing.amount + amount,
          deliveries: existing.deliveries + 1,
        });
      });

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
