import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import {
  getPhysicalFacultyById,
  updatePhysicalFaculty,
  deletePhysicalFaculty,
  logAdminAction,
} from "@/lib/db";
import { createCachedJsonResponse } from "@/lib/edge-cache";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const faculty = await getPhysicalFacultyById(id);

    if (!faculty) {
      return NextResponse.json(
        { success: false, message: "دانشکده فیزیکی مورد نظر یافت نشد." },
        { status: 404 }
      );
    }

    return createCachedJsonResponse(faculty, "physical_faculties", request);
  } catch (error: any) {
    console.error("Get physical faculty detail error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در دریافت اطلاعات دانشکده" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const { id } = await params;
    const body: any = await request.json();

    const updated = await updatePhysicalFaculty(id, body);
    if (!updated) {
      return NextResponse.json(
        { success: false, message: "دانشکده فیزیکی یافت نشد." },
        { status: 404 }
      );
    }

    if (auth.user) {
      await logAdminAction({
        userId: auth.user.id,
        userName: auth.user.name,
        userEmail: auth.user.email,
        action: "UPDATE",
        entityType: "physical_faculty",
        entityId: id,
        entityName: updated.name,
        details: `ویرایش مشخصات دانشکده فیزیکی ${updated.name}`,
      });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Update physical faculty error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "خطا در ویرایش دانشکده فیزیکی" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const { id } = await params;
    const existing = await getPhysicalFacultyById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "دانشکده فیزیکی یافت نشد." },
        { status: 404 }
      );
    }

    const ok = await deletePhysicalFaculty(id, false);
    if (!ok) {
      return NextResponse.json(
        { success: false, message: "خطا در حذف دانشکده فیزیکی" },
        { status: 500 }
      );
    }

    if (auth.user) {
      await logAdminAction({
        userId: auth.user.id,
        userName: auth.user.name,
        userEmail: auth.user.email,
        action: "DELETE",
        entityType: "physical_faculty",
        entityId: id,
        entityName: existing.name,
        details: `انتقال دانشکده فیزیکی ${existing.name} به سطل زباله`,
      });
    }

    return NextResponse.json({
      success: true,
      message: "دانشکده فیزیکی با موفقیت به سطل زباله منتقل شد.",
    });
  } catch (error: any) {
    console.error("Delete physical faculty error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در حذف دانشکده فیزیکی" },
      { status: 500 }
    );
  }
}
