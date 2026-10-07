import { apiResponseJson, withApiTiming } from "@/lib/api-response";
import { seedDatabase } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

async function POSTHandler(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;

    if (process.env.NODE_ENV === "production") {
      return apiResponseJson(
        {
          success: false,
          message: "عملیات بارگذاری داده‌های نمونه به دلایل امنیتی در محیط پروداکشن مسدود است.",
        },
        { status: 403 }
      );
    }

    let full = true;
    try {
      const body: any = await request.json();
      if (body?.full !== undefined) full = Boolean(body.full);
    } catch {}

    const result = await seedDatabase(full);
    return apiResponseJson(result);
  } catch (error) {
    console.error("Seed error:", error);
    return apiResponseJson(
      { success: false, message: "خطا در بارگذاری داده‌های اولیه" },
      { status: 500 }
    );
  }
}

export const POST = withApiTiming(POSTHandler);
