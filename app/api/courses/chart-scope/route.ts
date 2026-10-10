import { apiResponseJson, withApiTiming } from "@/lib/api-response";
import { getCoursesForChartScope } from "@/lib/db";
import { rememberServerValue } from "@/lib/server-cache";

async function GETHandler(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get("trackId")?.trim();
    const chartId = searchParams.get("chartId")?.trim() || undefined;

    if (!trackId) {
      return apiResponseJson(
        { success: false, message: "شناسهٔ گرایش الزامی است." },
        { status: 400 }
      );
    }

    const courses = await rememberServerValue(
      `chart-scope:${trackId}:${chartId || "track"}`,
      () => getCoursesForChartScope(trackId, chartId)
    );
    return apiResponseJson(
      { success: true, data: courses },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error) {
    console.error("Get chart course scope error:", error);
    return apiResponseJson(
      { success: false, message: "خطا در دریافت درس‌های مرتبط با چارت" },
      { status: 500 }
    );
  }
}

export const GET = withApiTiming(GETHandler);
