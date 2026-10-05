import { buildResponseEnvelope } from "resora";

export type ApiResponseKind = "resource" | "collection" | "generic";

export interface ApiResponseOptions {
  status?: number;
  message?: string;
  errors?: unknown;
  meta?: Record<string, unknown>;
  kind?: ApiResponseKind;
  headers?: HeadersInit;
}

const API_VERSION = "1.0.0";

/**
 * Builds a consistent HTTP response using Resora while retaining the
 * success flag expected by the existing UTPlan client.
 */
export function apiResponse<T>(data: T, options: ApiResponseOptions = {}) {
  const startedAt = Date.now();
  const statusCode = options.status ?? 200;
  const isSuccess = statusCode < 400;
  const kind = options.kind ?? (Array.isArray(data) ? "collection" : "resource");
  const envelope = buildResponseEnvelope({
    payload: data,
    meta: options.meta,
    context: { type: kind },
  });

  return Response.json(
    {
      ...envelope,
      success: isSuccess,
      status: isSuccess ? "success" : "error",
      message: options.message ?? (isSuccess ? "OK" : "Request failed"),
      errors: options.errors ?? (isSuccess ? [] : undefined),
      execution: `${Date.now() - startedAt}ms`,
      version: API_VERSION,
    },
    {
      status: statusCode,
      headers: options.headers,
    }
  );
}

export function apiError(
  message: string,
  status = 500,
  errors?: unknown,
  headers?: HeadersInit
) {
  return apiResponse(null, { status, message, errors, headers });
}
