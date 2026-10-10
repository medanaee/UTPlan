/**
 * Final response boundary for API resources.
 * Domain resources can still whitelist their own fields, but this guard makes
 * sure a raw DB row can never expose credentials or server secrets by mistake.
 */
const PRIVATE_KEYS = /^(password|passwordHash|secret|apiKey|api_key|token|accessToken|refreshToken|refresh_token)$/i;

export function apiResource<T>(value: T): T {
  return sanitize(value) as T;
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (PRIVATE_KEYS.test(key)) continue;
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    output[key] = sanitize(child);
  }
  return output;
}
