import { NextRequest, NextResponse } from "next/server";
import { getOfferings, createOffering, deleteOffering } from "@/lib/db";
import { getAuthTokenFromRequest, verifySessionToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId") || undefined;
    const professorId = searchParams.get("professorId") || undefined;
    const facultyId = searchParams.get("facultyId") || undefined;

    const data = await getOfferings({ courseId, professorId, facultyId });
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
    const token = getAuthTokenFromRequest(request);
    const session = token ? await verifySessionToken(token) : null;
    if (!session || (session.role !== "admin" && session.role !== "super_admin")) {
      return NextResponse.json(
        { success: false, message: "عدم دسترسی کافی" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { courseId, professorId } = body;

    if (!courseId || !professorId) {
      return NextResponse.json(
        { success: false, message: "شناسه درس و استاد الزامی است." },
        { status: 400 }
      );
    }

    const newOffering = await createOffering({
      courseId,
      professorId,
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

export async function DELETE(request: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(request);
    const session = token ? await verifySessionToken(token) : null;
    if (!session || (session.role !== "admin" && session.role !== "super_admin")) {
      return NextResponse.json(
        { success: false, message: "عدم دسترسی کافی" },
        { status: 403 }
      );
    }

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
        { success: false, message: "ارائه مورد نظر یافت نشد." },
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
