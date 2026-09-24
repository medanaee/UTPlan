import { getEntityVersion, invalidateCache, TEN_DAYS_SECONDS } from "./server-cache";

/**
 * Returns standard Edge Cache headers for Cloudflare CDN.
 * Uses 10-day s-maxage for CDN, 1-day max-age for browser, and ETag for 304 revalidation.
 */
export function getEdgeCacheHeaders(entity: string): Record<string, string> {
  const version = getEntityVersion(entity);
  return {
    "Cache-Control": `public, max-age=86400, s-maxage=${TEN_DAYS_SECONDS}, stale-while-revalidate=86400`,
    "ETag": `W/"${entity}-v${version}"`,
  };
}

/**
 * Creates a cached Response with ETag validation.
 * If request contains matching If-None-Match, returns 304 Not Modified.
 */
export function createCachedJsonResponse(
  data: any,
  entity: string,
  request?: Request
): Response {
  const headers = getEdgeCacheHeaders(entity);
  const etag = headers["ETag"];

  if (request) {
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers,
      });
    }
  }

  return Response.json(
    { success: true, data },
    { headers }
  );
}

/**
 * Invalidate cache for an entity across both server-memory and edge layers.
 */
export function invalidateEdgeCache(entity: string): void {
  invalidateCache(entity);
}
