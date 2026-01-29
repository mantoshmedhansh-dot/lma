/**
 * Route Optimization Service
 *
 * Provides basic route optimization for multiple delivery stops.
 * Uses a greedy nearest-neighbor algorithm with distance matrix.
 */

interface Location {
  id: string;
  latitude: number;
  longitude: number;
  type: 'pickup' | 'delivery';
  orderId?: string;
  address?: string;
  estimatedTime?: number; // minutes at stop
}

interface OptimizedRoute {
  stops: OptimizedStop[];
  totalDistance: number; // km
  totalDuration: number; // minutes
  savings: RouteSavings;
}

interface OptimizedStop {
  sequence: number;
  location: Location;
  distanceFromPrevious: number; // km
  durationFromPrevious: number; // minutes
  cumulativeDistance: number; // km
  cumulativeDuration: number; // minutes
  estimatedArrival?: Date;
}

interface RouteSavings {
  distanceSaved: number; // km
  timeSaved: number; // minutes
  percentageSaved: number;
}

interface RouteMetrics {
  averageSpeed: number; // km/h
  stopTime: number; // minutes per stop
}

// Default metrics for different vehicle types
const VEHICLE_METRICS: Record<string, RouteMetrics> = {
  bicycle: { averageSpeed: 15, stopTime: 5 },
  motorcycle: { averageSpeed: 25, stopTime: 3 },
  car: { averageSpeed: 30, stopTime: 4 },
  van: { averageSpeed: 28, stopTime: 5 },
  default: { averageSpeed: 25, stopTime: 4 },
};

/**
 * Calculate distance between two points using Haversine formula
 */
export function calculateDistance(
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
 * Build distance matrix for all locations
 */
function buildDistanceMatrix(locations: Location[]): number[][] {
  const n = locations.length;
  const matrix: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        matrix[i][j] = calculateDistance(
          locations[i].latitude,
          locations[i].longitude,
          locations[j].latitude,
          locations[j].longitude
        );
      }
    }
  }

  return matrix;
}

/**
 * Nearest Neighbor Algorithm for route optimization
 * Greedy algorithm that always visits the nearest unvisited location
 */
function nearestNeighbor(
  distanceMatrix: number[][],
  startIndex: number,
  mustVisitInOrder: Map<number, number[]> // Map of location index to indices that must come after it
): number[] {
  const n = distanceMatrix.length;
  const visited = new Set<number>();
  const route: number[] = [startIndex];
  visited.add(startIndex);

  let current = startIndex;

  while (visited.size < n) {
    let nearest = -1;
    let nearestDistance = Infinity;

    for (let i = 0; i < n; i++) {
      if (visited.has(i)) continue;

      // Check if this location can be visited now (respecting pickup->delivery order)
      let canVisit = true;
      for (const [prerequisite, dependents] of mustVisitInOrder) {
        if (dependents.includes(i) && !visited.has(prerequisite)) {
          canVisit = false;
          break;
        }
      }

      if (canVisit && distanceMatrix[current][i] < nearestDistance) {
        nearest = i;
        nearestDistance = distanceMatrix[current][i];
      }
    }

    if (nearest === -1) {
      // No valid next location found, visit any remaining in order
      for (let i = 0; i < n; i++) {
        if (!visited.has(i)) {
          nearest = i;
          break;
        }
      }
    }

    if (nearest !== -1) {
      route.push(nearest);
      visited.add(nearest);
      current = nearest;
    }
  }

  return route;
}

/**
 * 2-opt improvement for route optimization
 * Iteratively improves the route by reversing segments
 */
function twoOptImprovement(
  route: number[],
  distanceMatrix: number[][],
  maxIterations: number = 100
): number[] {
  let improved = true;
  let iterations = 0;
  let bestRoute = [...route];

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 1; i < bestRoute.length - 2; i++) {
      for (let j = i + 1; j < bestRoute.length - 1; j++) {
        // Calculate current distance
        const currentDist =
          distanceMatrix[bestRoute[i - 1]][bestRoute[i]] +
          distanceMatrix[bestRoute[j]][bestRoute[j + 1]];

        // Calculate new distance after reversal
        const newDist =
          distanceMatrix[bestRoute[i - 1]][bestRoute[j]] +
          distanceMatrix[bestRoute[i]][bestRoute[j + 1]];

        if (newDist < currentDist) {
          // Reverse the segment between i and j
          const newRoute = [
            ...bestRoute.slice(0, i),
            ...bestRoute.slice(i, j + 1).reverse(),
            ...bestRoute.slice(j + 1),
          ];
          bestRoute = newRoute;
          improved = true;
        }
      }
    }
  }

  return bestRoute;
}

/**
 * Calculate total route distance
 */
function calculateTotalDistance(route: number[], distanceMatrix: number[][]): number {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += distanceMatrix[route[i]][route[i + 1]];
  }
  return total;
}

/**
 * Calculate estimated travel time based on distance and vehicle type
 */
function calculateTravelTime(distance: number, vehicleType: string = 'default'): number {
  const metrics = VEHICLE_METRICS[vehicleType] || VEHICLE_METRICS.default;
  return (distance / metrics.averageSpeed) * 60; // Convert to minutes
}

/**
 * Main route optimization function
 */
export function optimizeRoute(
  driverLocation: { latitude: number; longitude: number },
  locations: Location[],
  options: {
    vehicleType?: string;
    startTime?: Date;
    respectPickupDeliveryOrder?: boolean;
  } = {}
): OptimizedRoute {
  const { vehicleType = 'default', startTime = new Date(), respectPickupDeliveryOrder = true } =
    options;

  // Add driver location as the starting point
  const allLocations: Location[] = [
    {
      id: 'driver-start',
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude,
      type: 'pickup',
    },
    ...locations,
  ];

  // Build distance matrix
  const distanceMatrix = buildDistanceMatrix(allLocations);

  // Build pickup-delivery constraints
  const mustVisitInOrder = new Map<number, number[]>();
  if (respectPickupDeliveryOrder) {
    const pickupIndices: Map<string, number> = new Map();

    allLocations.forEach((loc, index) => {
      if (loc.type === 'pickup' && loc.orderId) {
        pickupIndices.set(loc.orderId, index);
      }
    });

    allLocations.forEach((loc, index) => {
      if (loc.type === 'delivery' && loc.orderId) {
        const pickupIndex = pickupIndices.get(loc.orderId);
        if (pickupIndex !== undefined) {
          const existing = mustVisitInOrder.get(pickupIndex) || [];
          mustVisitInOrder.set(pickupIndex, [...existing, index]);
        }
      }
    });
  }

  // Calculate original (unoptimized) route distance for comparison
  const originalOrder = allLocations.map((_, i) => i);
  const originalDistance = calculateTotalDistance(originalOrder, distanceMatrix);

  // Find optimized route using nearest neighbor
  let optimizedOrder = nearestNeighbor(distanceMatrix, 0, mustVisitInOrder);

  // Improve with 2-opt (only if not respecting strict pickup-delivery order)
  if (!respectPickupDeliveryOrder) {
    optimizedOrder = twoOptImprovement(optimizedOrder, distanceMatrix);
  }

  // Calculate optimized distance
  const optimizedDistance = calculateTotalDistance(optimizedOrder, distanceMatrix);

  // Build optimized stops with timing
  const metrics = VEHICLE_METRICS[vehicleType] || VEHICLE_METRICS.default;
  const stops: OptimizedStop[] = [];
  let cumulativeDistance = 0;
  let cumulativeDuration = 0;
  let currentTime = new Date(startTime);

  for (let i = 0; i < optimizedOrder.length; i++) {
    const locationIndex = optimizedOrder[i];
    const location = allLocations[locationIndex];

    const distanceFromPrevious =
      i === 0 ? 0 : distanceMatrix[optimizedOrder[i - 1]][locationIndex];
    const durationFromPrevious = calculateTravelTime(distanceFromPrevious, vehicleType);

    cumulativeDistance += distanceFromPrevious;
    cumulativeDuration += durationFromPrevious;

    // Add stop time
    const stopTime = location.estimatedTime || metrics.stopTime;
    cumulativeDuration += stopTime;

    const estimatedArrival = new Date(currentTime.getTime() + cumulativeDuration * 60 * 1000);

    stops.push({
      sequence: i,
      location,
      distanceFromPrevious: Math.round(distanceFromPrevious * 100) / 100,
      durationFromPrevious: Math.round(durationFromPrevious),
      cumulativeDistance: Math.round(cumulativeDistance * 100) / 100,
      cumulativeDuration: Math.round(cumulativeDuration),
      estimatedArrival,
    });
  }

  // Calculate savings
  const distanceSaved = originalDistance - optimizedDistance;
  const timeSaved = calculateTravelTime(distanceSaved, vehicleType);
  const percentageSaved = originalDistance > 0 ? (distanceSaved / originalDistance) * 100 : 0;

  return {
    stops: stops.slice(1), // Remove driver start position from stops
    totalDistance: Math.round(optimizedDistance * 100) / 100,
    totalDuration: Math.round(cumulativeDuration),
    savings: {
      distanceSaved: Math.round(distanceSaved * 100) / 100,
      timeSaved: Math.round(timeSaved),
      percentageSaved: Math.round(percentageSaved * 10) / 10,
    },
  };
}

/**
 * Calculate ETA for a single destination
 */
export function calculateETA(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  vehicleType: string = 'default',
  trafficMultiplier: number = 1.0
): {
  distance: number;
  duration: number;
  eta: Date;
} {
  const distance = calculateDistance(fromLat, fromLon, toLat, toLon);
  const baseDuration = calculateTravelTime(distance, vehicleType);
  const adjustedDuration = baseDuration * trafficMultiplier;

  return {
    distance: Math.round(distance * 100) / 100,
    duration: Math.round(adjustedDuration),
    eta: new Date(Date.now() + adjustedDuration * 60 * 1000),
  };
}

/**
 * Estimate delivery time based on historical data
 */
export function estimateDeliveryTime(
  pickupLat: number,
  pickupLon: number,
  deliveryLat: number,
  deliveryLon: number,
  options: {
    vehicleType?: string;
    prepTime?: number; // minutes
    pickupTime?: number; // minutes
    deliveryTime?: number; // minutes
    trafficMultiplier?: number;
  } = {}
): {
  pickupTime: number;
  transitTime: number;
  deliveryTime: number;
  totalTime: number;
  estimatedDelivery: Date;
} {
  const {
    vehicleType = 'default',
    prepTime = 15,
    pickupTime = 5,
    deliveryTime = 5,
    trafficMultiplier = 1.0,
  } = options;

  const distance = calculateDistance(pickupLat, pickupLon, deliveryLat, deliveryLon);
  const transitTime = calculateTravelTime(distance, vehicleType) * trafficMultiplier;

  const totalTime = prepTime + pickupTime + transitTime + deliveryTime;

  return {
    pickupTime: prepTime + pickupTime,
    transitTime: Math.round(transitTime),
    deliveryTime,
    totalTime: Math.round(totalTime),
    estimatedDelivery: new Date(Date.now() + totalTime * 60 * 1000),
  };
}

/**
 * Get traffic multiplier based on time of day (simplified)
 */
export function getTrafficMultiplier(date: Date = new Date()): number {
  const hour = date.getHours();

  // Peak hours
  if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19)) {
    return 1.5;
  }

  // Semi-peak
  if ((hour >= 7 && hour <= 11) || (hour >= 16 && hour <= 20)) {
    return 1.25;
  }

  // Night (less traffic)
  if (hour >= 22 || hour <= 5) {
    return 0.8;
  }

  // Normal hours
  return 1.0;
}

/**
 * Cluster deliveries by zone for efficient batching
 */
export function clusterDeliveries(
  deliveries: Location[],
  maxClusterRadius: number = 3 // km
): Location[][] {
  if (deliveries.length === 0) return [];

  const clusters: Location[][] = [];
  const assigned = new Set<string>();

  // Sort by latitude for consistent clustering
  const sorted = [...deliveries].sort((a, b) => a.latitude - b.latitude);

  for (const delivery of sorted) {
    if (assigned.has(delivery.id)) continue;

    // Start a new cluster
    const cluster: Location[] = [delivery];
    assigned.add(delivery.id);

    // Find nearby deliveries
    for (const other of sorted) {
      if (assigned.has(other.id)) continue;

      const distance = calculateDistance(
        delivery.latitude,
        delivery.longitude,
        other.latitude,
        other.longitude
      );

      if (distance <= maxClusterRadius) {
        cluster.push(other);
        assigned.add(other.id);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}
