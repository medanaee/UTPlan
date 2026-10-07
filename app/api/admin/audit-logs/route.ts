import { apiResponseJson } from "@/lib/api-response";
import { requireSuperAdminSession } from "@/lib/auth";
import { getAuditLogs } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const auth = await requireSuperAdminSession(request);
    if (!auth.authorized) return auth.response!;

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 25;
    const action = searchParams.get("action") || undefined;
    const entityType = searchParams.get("entityType") || undefined;
    const userId = searchParams.get("userId") || undefined;
    const search = searchParams.get("search") || undefined;

    const result = await getAuditLogs({
      page,
      limit,
      action,
      entityType,
      userId,
      search,
    });

    return apiResponseJson({
      success: true,
      data: result.logs,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error("Get audit logs API error:", error);
    return apiResponseJson(
      { success: false, message: "خطا در دریافت لاگ‌های سامانه" },
      { status: 500 }
    );
  }
}
