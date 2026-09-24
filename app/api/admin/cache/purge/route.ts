import { requireAdminSession } from "@/lib/auth";
import { invalidateCache } from "@/lib/server-cache";

const PURGE_SECRET = process.env.CACHE_PURGE_SECRET || "ut-ece-purge-cache-secret-2026";

export const PURGED_ENDPOINTS = [
  "/api/courses",
  "/api/faculties",
  "/api/faculties/links",
  "/api/majors",
  "/api/tracks",
  "/api/tracks/assignments",
  "/api/professors",
  "/api/physical-faculties",
  "/api/categories",
  "/api/offerings",
  "/api/events",
  "/api/charts",
];

export async function POST(request: Request) {
  try {
    // 1. Authorization check: either via secret header/query OR admin session
    const secretHeader = request.headers.get("x-purge-secret");
    const { searchParams } = new URL(request.url);
    const secretQuery = searchParams.get("secret");

    let isAuthorized =
      (secretHeader && secretHeader === PURGE_SECRET) ||
      (secretQuery && secretQuery === PURGE_SECRET);

    if (!isAuthorized) {
      const auth = await requireAdminSession(request);
      if (auth.authorized) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return Response.json(
        { success: false, message: "دسترسی غیرمجاز برای پاک‌سازی کش." },
        { status: 401 }
      );
    }

    // 2. Invalidate server memory cache and bump entity versions
    invalidateCache();

    // 3. Purge Cloudflare Workers Cache API (caches.default) if running in Cloudflare runtime
    const origin = new URL(request.url).origin;
    let cfCachePurged = false;
    const purgedUrls: string[] = [];

    try {
      const cache = (caches as any)?.default;
      if (cache) {
        for (const endpoint of PURGED_ENDPOINTS) {
          const fullUrl = `${origin}${endpoint}`;
          await cache.delete(new Request(fullUrl));
          await cache.delete(new Request(`${fullUrl}?v=1`));
          await cache.delete(new Request(`${fullUrl}?v=2`));
          purgedUrls.push(fullUrl);
        }
        cfCachePurged = true;
      }
    } catch (cfErr) {
      console.warn("Cloudflare Cache API purge error:", cfErr);
    }

    return Response.json({
      success: true,
      message: "کلیه کش‌های حافظه‌ای و لبه (Edge) با موفقیت ابطال و بازنشانی شدند.",
      timestamp: Date.now(),
      cfCachePurged,
      purgedEndpoints: PURGED_ENDPOINTS,
      totalEndpoints: PURGED_ENDPOINTS.length,
    });
  } catch (error: any) {
    console.error("Purge cache error:", error);
    return Response.json(
      { success: false, message: error?.message || "خطا در ابطال کش" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
