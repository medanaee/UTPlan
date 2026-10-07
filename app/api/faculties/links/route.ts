import { apiResponseJson } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { getFacultyLinks, setFacultyLinks } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetFacultyId = searchParams.get("targetFacultyId") || searchParams.get("facultyId") || undefined;

    const links = await getFacultyLinks(targetFacultyId);
    return apiResponseJson(
      { success: true, data: links },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    console.error("GET faculty links error:", error);
    return apiResponseJson(
      { success: false, message: error?.message || "خطا در دریافت اتصالات دانشکده‌ها" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const body: any = await request.json();
    const { targetFacultyId, sourceFacultyIds } = body;

    if (!targetFacultyId) {
      return apiResponseJson(
        { success: false, message: "شناسه دانشکده مقصد (targetFacultyId) الزامی است." },
        { status: 400 }
      );
    }

    if (!Array.isArray(sourceFacultyIds)) {
      return apiResponseJson(
        { success: false, message: "آرایه شناسه‌های دانشکده‌های مبدأ (sourceFacultyIds) نامعتبر است." },
        { status: 400 }
      );
    }

    await setFacultyLinks(targetFacultyId, sourceFacultyIds);

    return apiResponseJson({
      success: true,
      message: "اتصالات دانشکده با موفقیت به‌روزرسانی شد.",
    });
  } catch (error: any) {
    console.error("POST faculty links error:", error);
    return apiResponseJson(
      { success: false, message: error?.message || "خطا در ثبت اتصالات دانشکده" },
      { status: 500 }
    );
  }
}
