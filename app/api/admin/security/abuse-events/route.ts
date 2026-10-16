import { apiResponseJson, withApiTiming } from "@/lib/api-response";
import { requireSuperAdminSession } from "@/lib/auth";
import { getD1 } from "@/lib/db";

async function GETHandler(request: Request) {
  try {
    const auth = await requireSuperAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const d1 = getD1();
    if (!d1) return apiResponseJson({ success: true, data: [] });
    const limit = Math.min(100, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 50));
    const { results } = await d1.prepare(`
      SELECT event_type, ip, subject, blocked_count, first_seen_at, last_seen_at
      FROM security_abuse_events
      ORDER BY last_seen_at DESC
      LIMIT ?
    `).bind(limit).all();
    return apiResponseJson({ success: true, data: results || [] });
  } catch (error) {
    console.error("Get abuse events error:", error);
    return apiResponseJson({ success: false, message: "خطا در دریافت گزارش اسپم" }, { status: 500 });
  }
}

export const GET = withApiTiming(GETHandler);
