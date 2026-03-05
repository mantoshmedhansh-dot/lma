import { create } from "zustand";
import type { ReversePickup } from "../types/pickup";
import * as pickupApi from "../api/pickup";

interface PickupState {
  pickups: ReversePickup[];
  loading: boolean;
  error: string | null;
  fetchPickups: () => Promise<void>;
  markArrived: (pickupId: string) => Promise<void>;
  markComplete: (pickupId: string) => void;
  refresh: () => Promise<void>;
}

export const usePickupStore = create<PickupState>((set, get) => ({
  pickups: [],
  loading: false,
  error: null,

  fetchPickups: async () => {
    set({ loading: true, error: null });
    try {
      const pickups = await pickupApi.fetchMyPickups();
      set({ pickups });
    } catch (error: any) {
      set({ error: error.message || "Failed to fetch pickups" });
    } finally {
      set({ loading: false });
    }
  },

  markArrived: async (pickupId: string) => {
    try {
      await pickupApi.arriveAtPickup(pickupId);
      const { pickups } = get();
      const updated = pickups.map((p) =>
        p.id === pickupId
          ? {
              ...p,
              status: "out_for_pickup",
              out_for_pickup_at: new Date().toISOString(),
            }
          : p,
      );
      set({ pickups: updated });
    } catch (error: any) {
      throw error;
    }
  },

  markComplete: (pickupId: string) => {
    const { pickups } = get();
    const updated = pickups.map((p) =>
      p.id === pickupId
        ? { ...p, status: "picked_up", picked_up_at: new Date().toISOString() }
        : p,
    );
    set({ pickups: updated });
  },

  refresh: async () => {
    await get().fetchPickups();
  },
}));
