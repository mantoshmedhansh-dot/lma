import { create } from 'zustand';
import type { DeliveryRoute, RouteStop } from '../types/route';
import * as deliveryApi from '../api/delivery';

interface RouteState {
  route: DeliveryRoute | null;
  currentStop: RouteStop | null;
  loading: boolean;
  error: string | null;
  fetchRoute: () => Promise<void>;
  markArrived: (stopId: string) => Promise<void>;
  markComplete: (stopId: string, status: 'delivered' | 'failed') => Promise<void>;
  refresh: () => Promise<void>;
}

function findCurrentStop(stops: RouteStop[]): RouteStop | null {
  return (
    stops.find((s) => s.status === 'arrived') ||
    stops.find((s) => s.status === 'pending') ||
    null
  );
}

export const useRouteStore = create<RouteState>((set, get) => ({
  route: null,
  currentStop: null,
  loading: false,
  error: null,

  fetchRoute: async () => {
    set({ loading: true, error: null });
    try {
      const route = await deliveryApi.fetchMyRoute();
      const currentStop = route ? findCurrentStop(route.stops) : null;
      set({ route, currentStop });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch route' });
    } finally {
      set({ loading: false });
    }
  },

  markArrived: async (stopId: string) => {
    try {
      await deliveryApi.arriveAtStop(stopId);
      const { route } = get();
      if (!route) return;

      const updatedStops = route.stops.map((s) =>
        s.id === stopId
          ? { ...s, status: 'arrived' as const, actual_arrival: new Date().toISOString() }
          : s,
      );
      const updatedRoute = { ...route, stops: updatedStops };
      set({
        route: updatedRoute,
        currentStop: findCurrentStop(updatedStops),
      });
    } catch (error: any) {
      throw error;
    }
  },

  markComplete: async (stopId: string, status: 'delivered' | 'failed') => {
    try {
      await deliveryApi.completeStop(stopId, status);
      const { route } = get();
      if (!route) return;

      const updatedStops = route.stops.map((s) =>
        s.id === stopId
          ? { ...s, status, actual_departure: new Date().toISOString() }
          : s,
      );
      const updatedRoute = { ...route, stops: updatedStops };
      set({
        route: updatedRoute,
        currentStop: findCurrentStop(updatedStops),
      });
    } catch (error: any) {
      throw error;
    }
  },

  refresh: async () => {
    await get().fetchRoute();
  },
}));
