export const MAX_JSON_BODY_BYTES = 1_000_000;

export type RequestError = { message: string; status: number };

/** Shared request boundary used by route-specific Request validators. */
export async function readJsonBody(request: Request): Promise<unknown | RequestError> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) {
    return { message: "بدنه درخواست بیش از حد مجاز است.", status: 413 };
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { message: "نوع محتوای درخواست باید application/json باشد.", status: 415 };
  }

  try {
    return await request.json();
  } catch {
    return { message: "بدنه JSON درخواست نامعتبر است.", status: 400 };
  }
}

export function isRequestError(value: unknown): value is RequestError {
  return Boolean(value && typeof value === "object" && "message" in value && "status" in value);
}
