import { useState, useCallback } from 'react';
import { supabase } from '../supabase';

interface Location {
  id: string;
  latitude: number;
  longitude: number;
  type: 'pickup' | 'delivery';
  orderId?: string;
  address?: string;
}

interface OptimizedStop {
  sequence: number;
  location: Location;
  distanceFromPrevious: number;
  durationFromPrevious: number;
  cumulativeDistance: number;
  cumulativeDuration: number;
  estimatedArrival: string;
  orderNumber?: string;
  merchantName?: string;
  customerName?: string;
}

interface RouteData {
  driverLocation: { latitude: number; longitude: number };
  stops: OptimizedStop[];
  totalDistance: number;
  totalDuration: number;
  savings: {
    distanceSaved: number;
    timeSaved: number;
    percentageSaved: number;
  };
  orderCount: number;
}

interface ETAData {
  distance: number;
  duration: number;
  eta: string;
  trafficMultiplier: number;
  trafficStatus: 'light' | 'moderate' | 'heavy';
}

interface DeliveryEstimate {
  pickupTime: number;
  transitTime: number;
  deliveryTime: number;
  totalTime: number;
  estimatedDelivery: string;
  distance: number;
  trafficMultiplier: number;
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export function useRouteOptimization() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getAuthHeader = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};
  };

  /**
   * Get optimized route for driver's current active orders
   */
  const getMyRoute = useCallback(async (): Promise<RouteData | null> => {
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_BASE}/api/v1/deliveries/route/my-route`, {
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to get route');
      }

      return result.data;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Optimize route for custom locations
   */
  const optimizeRoute = useCallback(
    async (
      locations: Location[],
      options?: {
        vehicleType?: 'bicycle' | 'motorcycle' | 'car' | 'van';
        respectPickupDeliveryOrder?: boolean;
      }
    ): Promise<RouteData | null> => {
      setLoading(true);
      setError(null);

      try {
        const headers = await getAuthHeader();
        const response = await fetch(`${API_BASE}/api/v1/deliveries/route/optimize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({
            locations,
            ...options,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error?.message || 'Failed to optimize route');
        }

        return result.data.optimizedRoute;
      } catch (err) {
        setError(err as Error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Calculate ETA between two points
   */
  const calculateETA = useCallback(
    async (
      from: { latitude: number; longitude: number },
      to: { latitude: number; longitude: number },
      vehicleType?: 'bicycle' | 'motorcycle' | 'car' | 'van'
    ): Promise<ETAData | null> => {
      setLoading(true);
      setError(null);

      try {
        const headers = await getAuthHeader();
        const response = await fetch(`${API_BASE}/api/v1/deliveries/route/eta`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({ from, to, vehicleType }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error?.message || 'Failed to calculate ETA');
        }

        return result.data;
      } catch (err) {
        setError(err as Error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Get delivery time estimate
   */
  const getDeliveryEstimate = useCallback(
    async (
      pickup: { latitude: number; longitude: number },
      delivery: { latitude: number; longitude: number },
      options?: {
        prepTime?: number;
        vehicleType?: 'bicycle' | 'motorcycle' | 'car' | 'van';
      }
    ): Promise<DeliveryEstimate | null> => {
      setLoading(true);
      setError(null);

      try {
        const headers = await getAuthHeader();
        const response = await fetch(`${API_BASE}/api/v1/deliveries/route/estimate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({ pickup, delivery, ...options }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error?.message || 'Failed to get estimate');
        }

        return result.data;
      } catch (err) {
        setError(err as Error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    getMyRoute,
    optimizeRoute,
    calculateETA,
    getDeliveryEstimate,
  };
}

/**
 * Calculate distance between two coordinates (client-side)
 * Uses Haversine formula
 */
export function calculateDistanceLocal(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Format duration in minutes to human readable string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (mins === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${mins} min`;
}

/**
 * Format distance in km
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}
