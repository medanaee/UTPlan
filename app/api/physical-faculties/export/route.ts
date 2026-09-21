import { NextRequest, NextResponse } from "next/server";
import { getPhysicalFaculties } from "@/lib/db";

export async function GET(request: NextRequest) {
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

    return NextResponse.json({
      success: true,
      count: exportData.length,
      data: exportData,
    });
  } catch (error: any) {
    console.error("Physical faculties export error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در خروجی گرفتن از اطلاعات دانشکده‌های فیزیکی" },
      { status: 500 }
    );
  }
}
