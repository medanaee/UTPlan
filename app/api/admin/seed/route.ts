import { seedDatabase } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;

    if (process.env.NODE_ENV === "production") {
      return Response.json(
        {
          success: false,
          message: "عملیات بارگذاری داده‌های نمونه به دلایل امنیتی در محیط پروداکشن مسدود است.",
        },
        { status: 403 }
      );
    }

    let full = true;
    try {
      const body = await request.json();
      if (body?.full !== undefined) full = Boolean(body.full);
    } catch {}

    const result = await seedDatabase(full);
    return Response.json(result);
  } catch (error) {
    console.error("Seed error:", error);
    return Response.json(
      { success: false, message: "خطا در بارگذاری داده‌های اولیه" },
      { status: 500 }
    );
  }
}
