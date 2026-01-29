/**
 * Caching Layer Service
 *
 * Features:
 * - Multi-tier caching (memory + database)
 * - TTL support with automatic expiration
 * - Cache tags for bulk invalidation
 * - Cache-aside pattern helpers
 * - Cache statistics and monitoring
 */

import { supabaseAdmin } from '../../config/supabase.js';
import { logger } from '../../lib/logger.js';

// In-memory cache store
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  tags: string[];
  createdAt: number;
  hits: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

// Cache configuration
const CONFIG = {
  defaultTTL: 300, // 5 minutes
  maxMemoryEntries: 10000,
  cleanupInterval: 60000, // 1 minute
  enableDatabaseCache: true,
};

// Cache statistics
const stats = {
  hits: 0,
  misses: 0,
  memoryHits: 0,
  databaseHits: 0,
  sets: 0,
  deletes: 0,
  evictions: 0,
};

// ============================================
// CORE CACHE OPERATIONS
// ============================================

/**
 * Get value from cache
 */
export async function get<T>(key: string): Promise<T | null> {
  // Check memory cache first
  const memEntry = memoryCache.get(key) as CacheEntry<T> | undefined;

  if (memEntry) {
    if (Date.now() < memEntry.expiresAt) {
      memEntry.hits++;
      stats.hits++;
      stats.memoryHits++;
      return memEntry.value;
    } else {
      // Expired, remove from memory
      memoryCache.delete(key);
    }
  }

  // Check database cache
  if (CONFIG.enableDatabaseCache) {
    try {
      const { data } = await supabaseAdmin
        .from('cache_entries')
        .select('value, expires_at')
        .eq('key', key)
        .single();

      if (data && new Date(data.expires_at) > new Date()) {
        const value = data.value as T;

        // Populate memory cache
        setMemoryCache(key, value, new Date(data.expires_at).getTime() - Date.now(), []);

        stats.hits++;
        stats.databaseHits++;
        return value;
      }
    } catch {
      // Cache miss or error
    }
  }

  stats.misses++;
  return null;
}

/**
 * Set value in cache
 */
export async function set<T>(
  key: string,
  value: T,
  ttlSeconds: number = CONFIG.defaultTTL,
  tags: string[] = []
): Promise<void> {
  const expiresAt = Date.now() + ttlSeconds * 1000;

  // Set in memory cache
  setMemoryCache(key, value, ttlSeconds * 1000, tags);

  // Set in database cache
  if (CONFIG.enableDatabaseCache) {
    try {
      await supabaseAdmin.from('cache_entries').upsert(
        {
          key,
          value: value as Record<string, unknown>,
          expires_at: new Date(expiresAt).toISOString(),
          tags,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
    } catch (error) {
      logger.warn('Failed to set database cache', { key, error });
    }
  }

  stats.sets++;
}

/**
 * Delete value from cache
 */
export async function del(key: string): Promise<void> {
  memoryCache.delete(key);

  if (CONFIG.enableDatabaseCache) {
    try {
      await supabaseAdmin.from('cache_entries').delete().eq('key', key);
    } catch (error) {
      logger.warn('Failed to delete database cache', { key, error });
    }
  }

  stats.deletes++;
}

/**
 * Delete values by tag
 */
export async function deleteByTag(tag: string): Promise<number> {
  let count = 0;

  // Delete from memory cache
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.tags.includes(tag)) {
      memoryCache.delete(key);
      count++;
    }
  }

  // Delete from database cache
  if (CONFIG.enableDatabaseCache) {
    try {
      const { count: dbCount } = await supabaseAdmin
        .from('cache_entries')
        .delete()
        .contains('tags', [tag]);

      count += dbCount || 0;
    } catch (error) {
      logger.warn('Failed to delete by tag from database cache', { tag, error });
    }
  }

  stats.deletes += count;
  return count;
}

/**
 * Check if key exists
 */
export async function has(key: string): Promise<boolean> {
  const value = await get(key);
  return value !== null;
}

/**
 * Clear all cache
 */
export async function clear(): Promise<void> {
  const memoryCount = memoryCache.size;
  memoryCache.clear();

  if (CONFIG.enableDatabaseCache) {
    try {
      await supabaseAdmin.from('cache_entries').delete().neq('key', '');
    } catch (error) {
      logger.warn('Failed to clear database cache', { error });
    }
  }

  stats.deletes += memoryCount;
  logger.info('Cache cleared', { memoryEntries: memoryCount });
}

// ============================================
// CACHE PATTERNS
// ============================================

/**
 * Cache-aside pattern: Get from cache or execute function
 */
export async function getOrSet<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = CONFIG.defaultTTL,
  tags: string[] = []
): Promise<T> {
  const cached = await get<T>(key);

  if (cached !== null) {
    return cached;
  }

  const value = await fn();
  await set(key, value, ttlSeconds, tags);
  return value;
}

/**
 * Memoize function with cache
 */
export function memoize<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  keyGenerator: (...args: Args) => string,
  ttlSeconds: number = CONFIG.defaultTTL
): (...args: Args) => Promise<T> {
  return async (...args: Args): Promise<T> => {
    const key = keyGenerator(...args);
    return getOrSet(key, () => fn(...args), ttlSeconds);
  };
}

/**
 * Cache with stampede protection
 */
const pendingRequests = new Map<string, Promise<unknown>>();

export async function getOrSetWithLock<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = CONFIG.defaultTTL,
  tags: string[] = []
): Promise<T> {
  const cached = await get<T>(key);

  if (cached !== null) {
    return cached;
  }

  // Check if there's already a pending request
  const pending = pendingRequests.get(key);
  if (pending) {
    return pending as Promise<T>;
  }

  // Execute function with lock
  const promise = fn()
    .then(async (value) => {
      await set(key, value, ttlSeconds, tags);
      pendingRequests.delete(key);
      return value;
    })
    .catch((error) => {
      pendingRequests.delete(key);
      throw error;
    });

  pendingRequests.set(key, promise);
  return promise;
}

// ============================================
// SPECIFIC CACHE HELPERS
// ============================================

/**
 * Cache user data
 */
export async function cacheUser(userId: string, userData: Record<string, unknown>): Promise<void> {
  await set(`user:${userId}`, userData, 600, ['users', `user:${userId}`]); // 10 minutes
}

/**
 * Get cached user
 */
export async function getCachedUser(userId: string): Promise<Record<string, unknown> | null> {
  return get(`user:${userId}`);
}

/**
 * Invalidate user cache
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  await deleteByTag(`user:${userId}`);
}

/**
 * Cache merchant data
 */
export async function cacheMerchant(merchantId: string, merchantData: Record<string, unknown>): Promise<void> {
  await set(`merchant:${merchantId}`, merchantData, 300, ['merchants', `merchant:${merchantId}`]); // 5 minutes
}

/**
 * Get cached merchant
 */
export async function getCachedMerchant(merchantId: string): Promise<Record<string, unknown> | null> {
  return get(`merchant:${merchantId}`);
}

/**
 * Invalidate merchant cache
 */
export async function invalidateMerchantCache(merchantId: string): Promise<void> {
  await deleteByTag(`merchant:${merchantId}`);
}

/**
 * Cache order tracking data
 */
export async function cacheOrderTracking(orderId: string, trackingData: Record<string, unknown>): Promise<void> {
  await set(`tracking:${orderId}`, trackingData, 30, ['tracking', `order:${orderId}`]); // 30 seconds
}

/**
 * Get cached order tracking
 */
export async function getCachedOrderTracking(orderId: string): Promise<Record<string, unknown> | null> {
  return get(`tracking:${orderId}`);
}

/**
 * Cache driver location
 */
export async function cacheDriverLocation(
  driverId: string,
  location: { latitude: number; longitude: number }
): Promise<void> {
  await set(`driver_location:${driverId}`, location, 15, ['driver_locations']); // 15 seconds
}

/**
 * Get cached driver location
 */
export async function getCachedDriverLocation(
  driverId: string
): Promise<{ latitude: number; longitude: number } | null> {
  return get(`driver_location:${driverId}`);
}

/**
 * Cache surge pricing
 */
export async function cacheSurgePricing(zoneId: string, multiplier: number): Promise<void> {
  await set(`surge:${zoneId}`, { multiplier }, 60, ['surge_pricing']); // 1 minute
}

/**
 * Get cached surge pricing
 */
export async function getCachedSurgePricing(zoneId: string): Promise<{ multiplier: number } | null> {
  return get(`surge:${zoneId}`);
}

/**
 * Cache menu items
 */
export async function cacheMenuItems(merchantId: string, items: unknown[]): Promise<void> {
  await set(`menu:${merchantId}`, items, 900, ['menus', `merchant:${merchantId}`]); // 15 minutes
}

/**
 * Get cached menu items
 */
export async function getCachedMenuItems(merchantId: string): Promise<unknown[] | null> {
  return get(`menu:${merchantId}`);
}

// ============================================
// MEMORY CACHE MANAGEMENT
// ============================================

function setMemoryCache<T>(key: string, value: T, ttlMs: number, tags: string[]): void {
  // Evict if cache is full
  if (memoryCache.size >= CONFIG.maxMemoryEntries) {
    evictLRU();
  }

  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
    tags,
    createdAt: Date.now(),
    hits: 0,
  });
}

function evictLRU(): void {
  let oldestKey: string | null = null;
  let oldestTime = Infinity;

  for (const [key, entry] of memoryCache.entries()) {
    if (entry.createdAt < oldestTime) {
      oldestTime = entry.createdAt;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    memoryCache.delete(oldestKey);
    stats.evictions++;
  }
}

function cleanupExpired(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of memoryCache.entries()) {
    if (now >= entry.expiresAt) {
      memoryCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.debug('Cleaned expired cache entries', { count: cleaned });
  }
}

// Start cleanup interval
setInterval(cleanupExpired, CONFIG.cleanupInterval);

// ============================================
// CACHE STATISTICS
// ============================================

/**
 * Get cache statistics
 */
export function getStats(): {
  hits: number;
  misses: number;
  hitRate: number;
  memoryHits: number;
  databaseHits: number;
  sets: number;
  deletes: number;
  evictions: number;
  memorySize: number;
  pendingRequests: number;
} {
  const total = stats.hits + stats.misses;
  return {
    ...stats,
    hitRate: total > 0 ? stats.hits / total : 0,
    memorySize: memoryCache.size,
    pendingRequests: pendingRequests.size,
  };
}

/**
 * Reset statistics
 */
export function resetStats(): void {
  stats.hits = 0;
  stats.misses = 0;
  stats.memoryHits = 0;
  stats.databaseHits = 0;
  stats.sets = 0;
  stats.deletes = 0;
  stats.evictions = 0;
}

/**
 * Get memory cache size
 */
export function getMemoryCacheSize(): number {
  return memoryCache.size;
}

/**
 * Get all cache keys (for debugging)
 */
export function getKeys(): string[] {
  return Array.from(memoryCache.keys());
}

// ============================================
// CACHE WARMING
// ============================================

/**
 * Warm up cache with frequently accessed data
 */
export async function warmUp(): Promise<void> {
  logger.info('Starting cache warm-up');

  try {
    // Warm up active merchants
    const { data: merchants } = await supabaseAdmin
      .from('merchants')
      .select('id, name, category, rating, is_open')
      .eq('status', 'active')
      .eq('is_open', true)
      .limit(100);

    if (merchants) {
      for (const merchant of merchants) {
        await cacheMerchant(merchant.id, merchant);
      }
      logger.info('Warmed up merchant cache', { count: merchants.length });
    }

    // Warm up surge pricing
    const { data: surgeRules } = await supabaseAdmin
      .from('surge_rules')
      .select('zone_id, multiplier')
      .eq('is_active', true);

    if (surgeRules) {
      for (const rule of surgeRules) {
        await cacheSurgePricing(rule.zone_id, rule.multiplier);
      }
      logger.info('Warmed up surge pricing cache', { count: surgeRules.length });
    }
  } catch (error) {
    logger.error('Cache warm-up failed', { error });
  }
}

// ============================================
// CACHE MIDDLEWARE
// ============================================

import { Request, Response, NextFunction } from 'express';

interface CacheMiddlewareOptions {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  tags?: string[];
  condition?: (req: Request) => boolean;
}

/**
 * Express middleware for response caching
 */
export function cacheMiddleware(options: CacheMiddlewareOptions = {}) {
  const {
    ttl = CONFIG.defaultTTL,
    keyGenerator = (req) => `response:${req.method}:${req.originalUrl}`,
    tags = ['responses'],
    condition = () => true,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip if condition not met
    if (!condition(req)) {
      return next();
    }

    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = keyGenerator(req);

    try {
      const cached = await get<{ body: unknown; contentType: string }>(key);

      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Content-Type', cached.contentType || 'application/json');
        return res.json(cached.body);
      }
    } catch {
      // Cache miss, continue
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache response
    res.json = (body: unknown) => {
      res.setHeader('X-Cache', 'MISS');

      // Cache the response
      set(key, { body, contentType: 'application/json' }, ttl, tags).catch(() => {
        // Ignore cache errors
      });

      return originalJson(body);
    };

    next();
  };
}

export { CONFIG as CacheConfig };
