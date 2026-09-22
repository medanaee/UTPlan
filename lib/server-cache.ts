// Server-Side In-Memory Cache with Automatic Invalidation
// Provides instant (0ms) reads for rapid repetitive queries without consuming D1 rows.
// Any mutation (create, update, delete) immediately invalidates the respective cache.

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// In-memory cache map scoped to the server runtime
const memoryCache = new Map<string, CacheEntry<any>>();

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
 * Store data in server memory cache with TTL (defaults to 60 seconds).
 */
export function setCached<T>(key: string, data: T, ttlSeconds: number = 60): void {
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Instantly invalidate cache entries matching the given prefix.
 * If no prefix is provided, clears the entire cache.
 */
export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    memoryCache.clear();
    return;
  }

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
}
