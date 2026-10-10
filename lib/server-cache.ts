type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<unknown>>();
const DEFAULT_TTL_MS = 60 * 60 * 1000;
let cacheGeneration = 0;

export async function rememberServerValue<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS
): Promise<T> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.value as T;
  if (cached) cache.delete(key);

  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;

  const generationAtStart = cacheGeneration;
  const request = loader()
    .then((value) => {
      if (generationAtStart === cacheGeneration) {
        cache.set(key, { value, expiresAt: Date.now() + ttlMs });
      }
      return value;
    })
    .finally(() => pending.delete(key));

  pending.set(key, request);
  return request;
}

export function invalidateCurriculumCache() {
  cacheGeneration += 1;
  pending.clear();
  for (const key of cache.keys()) {
    if (
      key.startsWith("tracks:") ||
      key.startsWith("categories:") ||
      key.startsWith("approved-charts:") ||
      key.startsWith("chart-scope:")
    ) {
      cache.delete(key);
    }
  }
}
