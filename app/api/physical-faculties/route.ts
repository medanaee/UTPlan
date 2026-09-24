import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import {
  getPhysicalFaculties,
  createPhysicalFaculty,
  logAdminAction,
} from "@/lib/db";
import { createCachedJsonResponse } from "@/lib/edge-cache";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const includeDeleted = searchParams.get("includeDeleted") === "true";

    const faculties = await getPhysicalFaculties(includeDeleted, search);
    return createCachedJsonResponse(faculties, "physical_faculties", request);
  } catch (error: any) {
    console.error("Get physical faculties error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در دریافت اطلاعات دانشکده‌های فیزیکی" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const body: any = await request.json();
    const { name, code, imageUrl, latitude, longitude, address, description } = body || {};

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, message: "نام دانشکده فیزیکی الزامی است." },
        { status: 400 }
      );
    }

    const newFaculty = await createPhysicalFaculty({
      name: name.trim(),
      code: code ? code.trim() : undefined,
      imageUrl: imageUrl ? imageUrl.trim() : undefined,
      latitude: latitude !== undefined && latitude !== null && !isNaN(Number(latitude)) ? Number(latitude) : null,
      longitude: longitude !== undefined && longitude !== null && !isNaN(Number(longitude)) ? Number(longitude) : null,
      address: address ? address.trim() : undefined,
      description: description ? description.trim() : undefined,
    });

    if (auth.user) {
      await logAdminAction({
        userId: auth.user.id,
        userName: auth.user.name,
        userEmail: auth.user.email,
        action: "CREATE",
        entityType: "physical_faculty",
        entityId: newFaculty.id,
        entityName: newFaculty.name,
        details: `ایجاد دانشکده فیزیکی جدید با کد ${newFaculty.code || "خودکار"}`,
      });
    }

    return NextResponse.json(
      { success: true, data: newFaculty },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create physical faculty error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "خطا در ایجاد دانشکده فیزیکی" },
      { status: 500 }
    );
  }
}
