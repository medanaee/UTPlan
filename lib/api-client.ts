/**
 * API Client Utility for Type-Safe Fetch Calls
 * Solves TypeScript 'unknown' response errors and standardizes API calls.
 */

export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  message?: string;
  authenticated?: boolean;
  user?: any;
  [key: string]: any;
}

const inFlightRequests = new Map<string, Promise<any>>();
const memoryCache = new Map<string, { data: any; expiry: number }>();

export function clearApiClientCache() {
  memoryCache.clear();
}

/**
 * Clean, type-safe wrapper around native fetch that parses JSON.
 * Returns Promise<T> where T defaults to any (or ApiResponse<T>).
 * Features in-flight promise deduplication and short cache to eliminate double-fetching.
 */
export async function fetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  const isGet = method === "GET";
  const urlKey = typeof input === "string" ? input : input instanceof URL ? input.toString() : null;

  if (isGet && urlKey) {
    // 1. Check memory cache (valid for 2 seconds to absorb double mounts & concurrent renders)
    const cached = memoryCache.get(urlKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.data as T;
    }

    // 2. Check if identical request is already pending (in-flight deduplication)
    if (inFlightRequests.has(urlKey)) {
      return inFlightRequests.get(urlKey) as Promise<T>;
    }

    // 3. Dispatch and track
    const promise = (async () => {
      try {
        const res = await fetch(input, init);
        const data = (await res.json()) as T;
        memoryCache.set(urlKey, { data, expiry: Date.now() + 2000 });
        return data;
      } finally {
        inFlightRequests.delete(urlKey);
      }
    })();

    inFlightRequests.set(urlKey, promise);
    return promise;
  }

  // Mutating requests clear the client-side memory cache
  if (!isGet) {
    memoryCache.clear();
  }

  const res = await fetch(input, init);
  return (await res.json()) as T;
}

/**
 * Helper for POST requests with JSON payload or FormData
 */
export async function postJson<T = any>(
  url: string,
  body?: any,
  init?: Omit<RequestInit, "body" | "method">
): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  return fetchJson<T>(url, {
    ...init,
    method: "POST",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers || {}),
    },
    body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * Helper for PUT requests with JSON payload
 */
export async function putJson<T = any>(
  url: string,
  body?: any,
  init?: Omit<RequestInit, "body" | "method">
): Promise<T> {
  return fetchJson<T>(url, {
    ...init,
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * Helper for PATCH requests with JSON payload
 */
export async function patchJson<T = any>(
  url: string,
  body?: any,
  init?: Omit<RequestInit, "body" | "method">
): Promise<T> {
  return fetchJson<T>(url, {
    ...init,
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * Helper for DELETE requests
 */
export async function deleteJson<T = any>(
  url: string,
  init?: Omit<RequestInit, "method">
): Promise<T> {
  return fetchJson<T>(url, {
    ...init,
    method: "DELETE",
  });
}

