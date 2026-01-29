/**
 * Geofencing Rules Engine
 *
 * Provides geofencing capabilities for:
 * - Delivery zone management with polygon boundaries
 * - Point-in-polygon checks for service availability
 * - Surge pricing based on zones and demand
 * - Driver tracking within geofenced areas
 * - Auto-assignment based on driver location
 */

import { supabaseAdmin } from '../../config/supabase.js';
import { logger } from '../../lib/logger.js';

// Coordinate types
interface Coordinate {
  latitude: number;
  longitude: number;
}

interface Polygon {
  coordinates: Coordinate[];
}

// Zone types
type ZoneType = 'delivery' | 'pickup' | 'restricted' | 'surge' | 'warehouse';

interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  polygon: Polygon;
  properties: ZoneProperties;
  isActive: boolean;
  merchantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ZoneProperties {
  baseDeliveryFee?: number;
  minOrderValue?: number;
  maxOrderValue?: number;
  surgeMultiplier?: number;
  estimatedDeliveryTime?: number;
  priority?: number;
  operatingHours?: {
    start: string; // HH:mm format
    end: string;
  };
  vehicleTypes?: string[];
  maxConcurrentOrders?: number;
}

interface SurgeRule {
  id: string;
  zoneId: string;
  condition: SurgeCondition;
  multiplier: number;
  isActive: boolean;
  priority: number;
}

interface SurgeCondition {
  type: 'time' | 'demand' | 'weather' | 'event' | 'driver_shortage';
  params: Record<string, unknown>;
}

interface GeofenceEvent {
  id: string;
  driverId: string;
  zoneId: string;
  eventType: 'enter' | 'exit' | 'dwell';
  timestamp: Date;
  location: Coordinate;
}

interface ZoneCheckResult {
  isInZone: boolean;
  zone?: Zone;
  deliveryFee?: number;
  estimatedTime?: number;
  surgeMultiplier?: number;
  restrictions?: string[];
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
export function isPointInPolygon(point: Coordinate, polygon: Polygon): boolean {
  const { latitude: y, longitude: x } = point;
  const vertices = polygon.coordinates;
  let inside = false;

  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].longitude;
    const yi = vertices[i].latitude;
    const xj = vertices[j].longitude;
    const yj = vertices[j].latitude;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Calculate the centroid of a polygon
 */
export function calculateCentroid(polygon: Polygon): Coordinate {
  let latSum = 0;
  let lngSum = 0;
  const n = polygon.coordinates.length;

  for (const coord of polygon.coordinates) {
    latSum += coord.latitude;
    lngSum += coord.longitude;
  }

  return {
    latitude: latSum / n,
    longitude: lngSum / n,
  };
}

/**
 * Calculate the area of a polygon (in square kilometers)
 */
export function calculatePolygonArea(polygon: Polygon): number {
  const coords = polygon.coordinates;
  const n = coords.length;
  let area = 0;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // Convert to approximate km (at equator)
    const lat1 = coords[i].latitude * 111;
    const lng1 = coords[i].longitude * 111 * Math.cos((coords[i].latitude * Math.PI) / 180);
    const lat2 = coords[j].latitude * 111;
    const lng2 = coords[j].longitude * 111 * Math.cos((coords[j].latitude * Math.PI) / 180);

    area += lat1 * lng2 - lat2 * lng1;
  }

  return Math.abs(area / 2);
}

/**
 * Create a new zone
 */
export async function createZone(
  zone: Omit<Zone, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Zone> {
  const { data, error } = await supabaseAdmin
    .from('geofence_zones')
    .insert({
      name: zone.name,
      type: zone.type,
      polygon: zone.polygon,
      properties: zone.properties,
      is_active: zone.isActive,
      merchant_id: zone.merchantId,
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create zone', { error, zone });
    throw new Error('Failed to create zone');
  }

  logger.info('Zone created', { zoneId: data.id, name: zone.name });

  return mapZoneFromDb(data);
}

/**
 * Update a zone
 */
export async function updateZone(
  zoneId: string,
  updates: Partial<Omit<Zone, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Zone> {
  const updateData: Record<string, unknown> = {};

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.type !== undefined) updateData.type = updates.type;
  if (updates.polygon !== undefined) updateData.polygon = updates.polygon;
  if (updates.properties !== undefined) updateData.properties = updates.properties;
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
  if (updates.merchantId !== undefined) updateData.merchant_id = updates.merchantId;

  const { data, error } = await supabaseAdmin
    .from('geofence_zones')
    .update(updateData)
    .eq('id', zoneId)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update zone', { error, zoneId });
    throw new Error('Failed to update zone');
  }

  return mapZoneFromDb(data);
}

/**
 * Delete a zone
 */
export async function deleteZone(zoneId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('geofence_zones')
    .delete()
    .eq('id', zoneId);

  if (error) {
    logger.error('Failed to delete zone', { error, zoneId });
    throw new Error('Failed to delete zone');
  }

  logger.info('Zone deleted', { zoneId });
}

/**
 * Get all zones
 */
export async function getZones(options: {
  type?: ZoneType;
  merchantId?: string;
  activeOnly?: boolean;
} = {}): Promise<Zone[]> {
  let query = supabaseAdmin.from('geofence_zones').select('*');

  if (options.type) {
    query = query.eq('type', options.type);
  }

  if (options.merchantId) {
    query = query.eq('merchant_id', options.merchantId);
  }

  if (options.activeOnly !== false) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Failed to get zones', { error, options });
    return [];
  }

  return data.map(mapZoneFromDb);
}

/**
 * Check if a location is serviceable
 */
export async function checkServiceability(
  location: Coordinate,
  options: {
    merchantId?: string;
    orderValue?: number;
    vehicleType?: string;
  } = {}
): Promise<ZoneCheckResult> {
  const zones = await getZones({
    type: 'delivery',
    merchantId: options.merchantId,
    activeOnly: true,
  });

  // Find matching zones
  const matchingZones = zones.filter((zone) =>
    isPointInPolygon(location, zone.polygon)
  );

  if (matchingZones.length === 0) {
    return {
      isInZone: false,
      restrictions: ['Location is outside delivery zones'],
    };
  }

  // Get the zone with highest priority
  const zone = matchingZones.sort(
    (a, b) => (b.properties.priority || 0) - (a.properties.priority || 0)
  )[0];

  const restrictions: string[] = [];

  // Check order value limits
  if (options.orderValue !== undefined) {
    if (zone.properties.minOrderValue && options.orderValue < zone.properties.minOrderValue) {
      restrictions.push(`Minimum order value is ${zone.properties.minOrderValue}`);
    }
    if (zone.properties.maxOrderValue && options.orderValue > zone.properties.maxOrderValue) {
      restrictions.push(`Maximum order value is ${zone.properties.maxOrderValue}`);
    }
  }

  // Check vehicle type
  if (options.vehicleType && zone.properties.vehicleTypes) {
    if (!zone.properties.vehicleTypes.includes(options.vehicleType)) {
      restrictions.push(`Vehicle type ${options.vehicleType} not allowed in this zone`);
    }
  }

  // Check operating hours
  if (zone.properties.operatingHours) {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const { start, end } = zone.properties.operatingHours;

    if (currentTime < start || currentTime > end) {
      restrictions.push(`Zone operates between ${start} and ${end}`);
    }
  }

  // Calculate surge pricing
  const surgeMultiplier = await calculateSurgeMultiplier(zone.id, location);

  // Calculate delivery fee
  const baseDeliveryFee = zone.properties.baseDeliveryFee || 0;
  const deliveryFee = baseDeliveryFee * surgeMultiplier;

  return {
    isInZone: true,
    zone,
    deliveryFee,
    estimatedTime: zone.properties.estimatedDeliveryTime,
    surgeMultiplier,
    restrictions: restrictions.length > 0 ? restrictions : undefined,
  };
}

/**
 * Check for restricted zones
 */
export async function checkRestrictedZones(
  location: Coordinate
): Promise<Zone[]> {
  const zones = await getZones({ type: 'restricted', activeOnly: true });
  return zones.filter((zone) => isPointInPolygon(location, zone.polygon));
}

/**
 * Create surge pricing rule
 */
export async function createSurgeRule(rule: Omit<SurgeRule, 'id'>): Promise<SurgeRule> {
  const { data, error } = await supabaseAdmin
    .from('surge_rules')
    .insert({
      zone_id: rule.zoneId,
      condition: rule.condition,
      multiplier: rule.multiplier,
      is_active: rule.isActive,
      priority: rule.priority,
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create surge rule', { error, rule });
    throw new Error('Failed to create surge rule');
  }

  return {
    id: data.id,
    zoneId: data.zone_id,
    condition: data.condition,
    multiplier: data.multiplier,
    isActive: data.is_active,
    priority: data.priority,
  };
}

/**
 * Calculate surge multiplier for a zone
 */
export async function calculateSurgeMultiplier(
  zoneId: string,
  location: Coordinate
): Promise<number> {
  // Get active surge rules for this zone
  const { data: rules } = await supabaseAdmin
    .from('surge_rules')
    .select('*')
    .eq('zone_id', zoneId)
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (!rules || rules.length === 0) {
    return 1.0;
  }

  let maxMultiplier = 1.0;
  const now = new Date();

  for (const rule of rules) {
    const condition = rule.condition as SurgeCondition;
    let applies = false;

    switch (condition.type) {
      case 'time':
        applies = checkTimeCondition(now, condition.params);
        break;
      case 'demand':
        applies = await checkDemandCondition(zoneId, condition.params);
        break;
      case 'weather':
        applies = await checkWeatherCondition(location, condition.params);
        break;
      case 'driver_shortage':
        applies = await checkDriverShortage(zoneId, condition.params);
        break;
      case 'event':
        applies = checkEventCondition(now, condition.params);
        break;
    }

    if (applies && rule.multiplier > maxMultiplier) {
      maxMultiplier = rule.multiplier;
    }
  }

  return maxMultiplier;
}

/**
 * Check time-based surge condition
 */
function checkTimeCondition(now: Date, params: Record<string, unknown>): boolean {
  const hour = now.getHours();
  const dayOfWeek = now.getDay();

  // Check hour range
  if (params.startHour !== undefined && params.endHour !== undefined) {
    const startHour = params.startHour as number;
    const endHour = params.endHour as number;

    if (startHour <= endHour) {
      if (hour < startHour || hour >= endHour) return false;
    } else {
      // Overnight range (e.g., 22-6)
      if (hour < startHour && hour >= endHour) return false;
    }
  }

  // Check days of week
  if (params.daysOfWeek) {
    const days = params.daysOfWeek as number[];
    if (!days.includes(dayOfWeek)) return false;
  }

  return true;
}

/**
 * Check demand-based surge condition
 */
async function checkDemandCondition(
  zoneId: string,
  params: Record<string, unknown>
): Promise<boolean> {
  const threshold = (params.orderThreshold as number) || 10;
  const timeWindowMinutes = (params.timeWindowMinutes as number) || 30;

  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - timeWindowMinutes);

  // Count recent orders in the zone
  const { count } = await supabaseAdmin
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('zone_id', zoneId)
    .gte('created_at', windowStart.toISOString())
    .in('status', ['pending', 'confirmed', 'preparing']);

  return (count || 0) >= threshold;
}

/**
 * Check weather-based surge condition (simplified)
 */
async function checkWeatherCondition(
  _location: Coordinate,
  params: Record<string, unknown>
): Promise<boolean> {
  // In production, this would call a weather API
  // For now, we'll use a simple check based on stored weather data
  const { data: weather } = await supabaseAdmin
    .from('weather_data')
    .select('condition')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .single();

  if (!weather) return false;

  const badWeatherConditions = (params.conditions as string[]) || ['rain', 'storm', 'snow'];
  return badWeatherConditions.includes(weather.condition);
}

/**
 * Check driver shortage condition
 */
async function checkDriverShortage(
  zoneId: string,
  params: Record<string, unknown>
): Promise<boolean> {
  const minDrivers = (params.minDrivers as number) || 3;
  const maxOrdersPerDriver = (params.maxOrdersPerDriver as number) || 3;

  // Get zone to find its polygon
  const { data: zone } = await supabaseAdmin
    .from('geofence_zones')
    .select('polygon')
    .eq('id', zoneId)
    .single();

  if (!zone) return false;

  // Count active drivers in zone
  const { data: drivers } = await supabaseAdmin
    .from('drivers')
    .select('id, current_latitude, current_longitude')
    .eq('status', 'online')
    .eq('is_active', true);

  if (!drivers) return true; // Assume shortage if can't get data

  const polygon = zone.polygon as Polygon;
  const driversInZone = drivers.filter((driver) =>
    driver.current_latitude &&
    driver.current_longitude &&
    isPointInPolygon(
      { latitude: driver.current_latitude, longitude: driver.current_longitude },
      polygon
    )
  );

  // Count pending orders in zone
  const { count: pendingOrders } = await supabaseAdmin
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('zone_id', zoneId)
    .in('status', ['pending', 'confirmed', 'ready_for_pickup']);

  const orderCount = pendingOrders || 0;
  const driverCount = driversInZone.length;

  // Shortage if too few drivers or too many orders per driver
  return driverCount < minDrivers || orderCount / Math.max(driverCount, 1) > maxOrdersPerDriver;
}

/**
 * Check event-based surge condition
 */
function checkEventCondition(now: Date, params: Record<string, unknown>): boolean {
  const events = (params.events as Array<{
    name: string;
    startDate: string;
    endDate: string;
  }>) || [];

  for (const event of events) {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    if (now >= start && now <= end) {
      return true;
    }
  }

  return false;
}

/**
 * Record a geofence event (driver entering/exiting zone)
 */
export async function recordGeofenceEvent(
  event: Omit<GeofenceEvent, 'id'>
): Promise<GeofenceEvent> {
  const { data, error } = await supabaseAdmin
    .from('geofence_events')
    .insert({
      driver_id: event.driverId,
      zone_id: event.zoneId,
      event_type: event.eventType,
      timestamp: event.timestamp.toISOString(),
      location: event.location,
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to record geofence event', { error, event });
    throw new Error('Failed to record geofence event');
  }

  logger.info('Geofence event recorded', {
    driverId: event.driverId,
    zoneId: event.zoneId,
    eventType: event.eventType,
  });

  return {
    id: data.id,
    driverId: data.driver_id,
    zoneId: data.zone_id,
    eventType: data.event_type,
    timestamp: new Date(data.timestamp),
    location: data.location,
  };
}

/**
 * Check driver zone transitions
 */
export async function checkDriverZoneTransitions(
  driverId: string,
  currentLocation: Coordinate
): Promise<GeofenceEvent[]> {
  const events: GeofenceEvent[] = [];

  // Get driver's previous location from last event
  const { data: lastEvent } = await supabaseAdmin
    .from('geofence_events')
    .select('zone_id, location')
    .eq('driver_id', driverId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();

  // Get all active zones
  const zones = await getZones({ activeOnly: true });

  // Track which zones the driver was in
  const previousZones = new Set<string>();
  if (lastEvent) {
    for (const zone of zones) {
      if (isPointInPolygon(lastEvent.location as Coordinate, zone.polygon)) {
        previousZones.add(zone.id);
      }
    }
  }

  // Check current zones
  const currentZones = new Set<string>();
  for (const zone of zones) {
    if (isPointInPolygon(currentLocation, zone.polygon)) {
      currentZones.add(zone.id);
    }
  }

  const now = new Date();

  // Record zone exits
  for (const zoneId of previousZones) {
    if (!currentZones.has(zoneId)) {
      const event = await recordGeofenceEvent({
        driverId,
        zoneId,
        eventType: 'exit',
        timestamp: now,
        location: currentLocation,
      });
      events.push(event);
    }
  }

  // Record zone entries
  for (const zoneId of currentZones) {
    if (!previousZones.has(zoneId)) {
      const event = await recordGeofenceEvent({
        driverId,
        zoneId,
        eventType: 'enter',
        timestamp: now,
        location: currentLocation,
      });
      events.push(event);
    }
  }

  return events;
}

/**
 * Get drivers in a specific zone
 */
export async function getDriversInZone(zoneId: string): Promise<Array<{
  driverId: string;
  location: Coordinate;
  status: string;
}>> {
  // Get zone polygon
  const { data: zone } = await supabaseAdmin
    .from('geofence_zones')
    .select('polygon')
    .eq('id', zoneId)
    .single();

  if (!zone) return [];

  const polygon = zone.polygon as Polygon;

  // Get all active drivers
  const { data: drivers } = await supabaseAdmin
    .from('drivers')
    .select('id, current_latitude, current_longitude, status')
    .eq('is_active', true)
    .not('current_latitude', 'is', null)
    .not('current_longitude', 'is', null);

  if (!drivers) return [];

  return drivers
    .filter((driver) =>
      isPointInPolygon(
        { latitude: driver.current_latitude, longitude: driver.current_longitude },
        polygon
      )
    )
    .map((driver) => ({
      driverId: driver.id,
      location: {
        latitude: driver.current_latitude,
        longitude: driver.current_longitude,
      },
      status: driver.status,
    }));
}

/**
 * Find the nearest zone to a location
 */
export async function findNearestZone(
  location: Coordinate,
  type?: ZoneType
): Promise<{ zone: Zone; distance: number } | null> {
  const zones = await getZones({ type, activeOnly: true });

  if (zones.length === 0) return null;

  let nearestZone: Zone | null = null;
  let minDistance = Infinity;

  for (const zone of zones) {
    const centroid = calculateCentroid(zone.polygon);
    const distance = calculateHaversineDistance(location, centroid);

    if (distance < minDistance) {
      minDistance = distance;
      nearestZone = zone;
    }
  }

  if (!nearestZone) return null;

  return { zone: nearestZone, distance: minDistance };
}

/**
 * Calculate Haversine distance between two points (in km)
 */
function calculateHaversineDistance(point1: Coordinate, point2: Coordinate): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(point2.latitude - point1.latitude);
  const dLng = toRad(point2.longitude - point1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.latitude)) *
      Math.cos(toRad(point2.latitude)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Map database zone to Zone type
 */
function mapZoneFromDb(data: Record<string, unknown>): Zone {
  return {
    id: data.id as string,
    name: data.name as string,
    type: data.type as ZoneType,
    polygon: data.polygon as Polygon,
    properties: (data.properties as ZoneProperties) || {},
    isActive: data.is_active as boolean,
    merchantId: data.merchant_id as string | undefined,
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}

/**
 * Assign zone to order based on delivery location
 */
export async function assignZoneToOrder(
  orderId: string,
  deliveryLocation: Coordinate
): Promise<Zone | null> {
  const zones = await getZones({ type: 'delivery', activeOnly: true });

  // Find matching zone
  const matchingZone = zones.find((zone) =>
    isPointInPolygon(deliveryLocation, zone.polygon)
  );

  if (!matchingZone) {
    logger.warn('No zone found for order delivery location', { orderId, deliveryLocation });
    return null;
  }

  // Update order with zone
  await supabaseAdmin
    .from('orders')
    .update({ zone_id: matchingZone.id })
    .eq('id', orderId);

  logger.info('Zone assigned to order', { orderId, zoneId: matchingZone.id });

  return matchingZone;
}

/**
 * Get zone statistics
 */
export async function getZoneStats(zoneId: string, daysBack: number = 7): Promise<{
  totalOrders: number;
  avgDeliveryTime: number;
  activeDrivers: number;
  avgSurgeMultiplier: number;
  peakHours: number[];
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  // Get orders in zone
  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('created_at, delivered_at')
    .eq('zone_id', zoneId)
    .eq('status', 'delivered')
    .gte('created_at', startDate.toISOString());

  const totalOrders = orders?.length || 0;

  // Calculate average delivery time
  let totalDeliveryTime = 0;
  const hourCounts: Record<number, number> = {};

  orders?.forEach((order) => {
    if (order.delivered_at && order.created_at) {
      const time = (new Date(order.delivered_at).getTime() - new Date(order.created_at).getTime()) / 60000;
      totalDeliveryTime += time;
    }

    const hour = new Date(order.created_at).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  const avgDeliveryTime = totalOrders > 0 ? totalDeliveryTime / totalOrders : 0;

  // Get active drivers in zone
  const driversInZone = await getDriversInZone(zoneId);
  const activeDrivers = driversInZone.filter((d) => d.status === 'online').length;

  // Find peak hours (top 3)
  const sortedHours = Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([hour]) => parseInt(hour));

  return {
    totalOrders,
    avgDeliveryTime: Math.round(avgDeliveryTime),
    activeDrivers,
    avgSurgeMultiplier: 1.0, // Simplified
    peakHours: sortedHours,
  };
}
