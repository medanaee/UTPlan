import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const body = await request.json();
    const { type, id } = body || {};

    if (!type || !id) {
      return NextResponse.json({ success: false, message: "نوع و شناسه موجودیت الزامی است." }, { status: 400 });
    }

    const d1 = getD1();
    if (!d1) {
      return NextResponse.json({ success: false, message: "پایگاه داده در دسترس نیست." }, { status: 500 });
    }

    let tableName = "";
    let label = "";

    switch (type) {
      case "course":
        tableName = "courses";
        label = "درس";
        break;
      case "professor":
        tableName = "professors";
        label = "استاد";
        break;
      case "offering":
        tableName = "course_offerings";
        label = "ارائه درسی";
        break;
      case "event":
        tableName = "course_events";
        label = "رویداد کلاسی";
        break;
      default:
        return NextResponse.json({ success: false, message: "نوع موجودیت نامعتبر است." }, { status: 400 });
    }

    await d1.prepare(`UPDATE ${tableName} SET deleted_at = NULL WHERE id = ?`).bind(id).run();

    return NextResponse.json({
      success: true,
      message: `${label} با موفقیت بازیابی شد و به لیست فعال بازگشت.`,
    });
  } catch (err: any) {
    console.error("Trash restore error:", err);
    return NextResponse.json({ success: false, message: "خطا در بازیابی موجودیت: " + err?.message }, { status: 500 });
  }
}
