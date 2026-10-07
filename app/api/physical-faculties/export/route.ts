import { apiResponseJson, withApiTiming } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { getPhysicalFaculties } from "@/lib/db";

async function GETHandler(request: NextRequest) {
  try {
    const faculties = await getPhysicalFaculties(false);

    // Format clean JSON schema without internal database artifacts
    const exportData = faculties.map((f) => ({
      name: f.name,
      code: f.code || undefined,
      imageUrl: f.imageUrl || undefined,
      latitude: f.latitude ?? undefined,
      longitude: f.longitude ?? undefined,
      address: f.address || undefined,
      description: f.description || undefined,
    }));

    return apiResponseJson({
      success: true,
      count: exportData.length,
      data: exportData,
    });
  } catch (error: any) {
    console.error("Physical faculties export error:", error);
    return apiResponseJson(
      { success: false, message: "خطا در خروجی گرفتن از اطلاعات دانشکده‌های فیزیکی" },
      { status: 500 }
    );
  }
}

export const GET = withApiTiming(GETHandler);
