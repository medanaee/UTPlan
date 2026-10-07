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
      errors: options.errors ?? [],
      execution: `${Date.now() - startedAt}ms`,
      version: API_VERSION,
    },
    {
      status: statusCode,
      headers: options.headers,
    }
  );
}

/**
 * Drop-in replacement for Response.json/NextResponse.json used by the
 * existing route handlers. It preserves legacy top-level fields while also
 * adding the Resora envelope, so current clients remain compatible.
 */
export function apiResponseJson(
  body: unknown,
  init: ResponseInit = {}
): Response {
  const startedAt = Date.now();
  const statusCode = init.status ?? 200;
  const record = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : undefined;
  const hasData = Boolean(record && Object.prototype.hasOwnProperty.call(record, "data"));
  const { data, success, message, errors, status: _status, ...legacyFields } = record ?? {};
  const payload = hasData ? data : Object.keys(legacyFields).length ? legacyFields : null;
  const kind = Array.isArray(payload) ? "collection" : "resource";
  const envelope = buildResponseEnvelope({
    payload,
    context: { type: kind },
  });
  const isSuccess = success === undefined ? statusCode < 400 : Boolean(success);

  return Response.json(
    {
      ...envelope,
      ...legacyFields,
      success: isSuccess,
      status: isSuccess ? "success" : "error",
      message: typeof message === "string" ? message : isSuccess ? "OK" : "Request failed",
      errors: errors ?? [],
      execution: `${Date.now() - startedAt}ms`,
      version: API_VERSION,
    },
    init
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
