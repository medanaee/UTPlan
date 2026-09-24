// Server-Side In-Memory Cache with Automatic Invalidation & Entity Versioning
// Provides instant (0ms) reads for rapid repetitive queries without consuming D1 rows.
// Any mutation (create, update, delete) immediately invalidates the respective cache and bumps the entity version.

export const TEN_DAYS_SECONDS = 864000; // 10 days in seconds

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// In-memory cache map scoped to the server runtime
const memoryCache = new Map<string, CacheEntry<any>>();

// Entity version map for ETags and cache busting
const entityVersions = new Map<string, number>();

let globalVersion = Date.now();

/**
 * Get current version/timestamp for an entity (used for ETags and cache keys).
 */
export function getEntityVersion(entity: string): number {
  return entityVersions.get(entity) || globalVersion;
}

/**
 * Retrieve data from server memory cache if available and not expired.
 */
export function getCached<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }

  return entry.data as T;
}

/**
 * Store data in server memory cache with TTL (defaults to 10 days).
 */
export function setCached<T>(key: string, data: T, ttlSeconds: number = TEN_DAYS_SECONDS): void {
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Instantly invalidate cache entries matching the given prefix and bump entity version.
 * If no prefix is provided, clears the entire cache and bumps global version.
 */
export function invalidateCache(prefix?: string): void {
  const now = Date.now();
  if (!prefix) {
    globalVersion = now;
    memoryCache.clear();
    for (const key of entityVersions.keys()) {
      entityVersions.set(key, now);
    }
    return;
  }

  entityVersions.set(prefix, now);

  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Clear all cache entries.
 */
export function clearAllCache(): void {
  memoryCache.clear();
  entityVersions.clear();
}
