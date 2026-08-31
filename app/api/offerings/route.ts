import { NextRequest, NextResponse } from "next/server";
import { getOfferings, createOffering, updateOffering, deleteOffering } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const facultyId = searchParams.get("facultyId") || undefined;

    const data = await getOfferings(facultyId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET offerings error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در دریافت ارائه‌های درسی" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const body = await request.json();
    const { courseId, professorId, professorIds, code, description } = body;

    const resolvedProfIds: string[] = Array.isArray(professorIds) && professorIds.length > 0
      ? professorIds
      : professorId
      ? [professorId]
      : [];

    if (!courseId || resolvedProfIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "شناسه درس و حداقل یک استاد الزامی است." },
        { status: 400 }
      );
    }

    const newOffering = await createOffering({
      courseId,
      professorIds: resolvedProfIds,
      code,
      description,
    });

    return NextResponse.json({
      success: true,
      message: "اتصال ارائه درس با موفقیت تعریف شد.",
      data: newOffering,
    });
  } catch (error) {
    console.error("POST offering error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در تعریف ارائه درس" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const body = await request.json();
    const { id, courseId, professorId, professorIds, code, description } = body;

    const resolvedProfIds: string[] | undefined = Array.isArray(professorIds)
      ? professorIds
      : professorId
      ? [professorId]
      : undefined;

    if (!id || !courseId || (resolvedProfIds && resolvedProfIds.length === 0)) {
      return NextResponse.json(
        { success: false, message: "شناسه ارائه، درس و حداقل یک استاد الزامی است." },
        { status: 400 }
      );
    }

    const updated = await updateOffering(id, {
      courseId,
      professorIds: resolvedProfIds,
      code,
      description,
    });
    if (!updated) {
      return NextResponse.json(
        { success: false, message: "ارائه درس مورد نظر یافت نشد." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "ارائه درس با موفقیت ویرایش شد.",
      data: updated,
    });
  } catch (error) {
    console.error("PUT offering error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در ویرایش ارائه درس" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "شناسه ارائه الزامی است." },
        { status: 400 }
      );
    }

    const success = await deleteOffering(id);
    if (!success) {
      return NextResponse.json(
        { success: false, message: "ارائه درس یافت نشد یا حذف نشد." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "ارائه درس با موفقیت حذف شد.",
    });
  } catch (error) {
    console.error("DELETE offering error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در حذف ارائه درس" },
      { status: 500 }
    );
  }
}
