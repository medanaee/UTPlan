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

/**
 * Clean, type-safe wrapper around native fetch that parses JSON.
 * Returns Promise<T> where T defaults to any (or ApiResponse<T>).
 */
export async function fetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
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

