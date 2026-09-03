import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const body = await request.json();
    const rawItems: Array<{ type: string; id: string }> =
      body?.items || (body?.type && body?.id ? [{ type: body.type, id: body.id }] : []);

    if (rawItems.length === 0) {
      return NextResponse.json({ success: false, message: "هیچ موجودیتی برای بازیابی مشخص نشده است." }, { status: 400 });
    }

    const d1 = getD1();
    if (!d1) {
      return NextResponse.json({ success: false, message: "پایگاه داده در دسترس نیست." }, { status: 500 });
    }

    const idsByType: Record<string, string[]> = {
      courses: [],
      professors: [],
      course_offerings: [],
      course_events: [],
    };

    for (const it of rawItems) {
      if (it.type === "course") idsByType.courses.push(it.id);
      else if (it.type === "professor") idsByType.professors.push(it.id);
      else if (it.type === "offering") idsByType.course_offerings.push(it.id);
      else if (it.type === "event") idsByType.course_events.push(it.id);
    }

    let restoredCount = 0;
    for (const [table, ids] of Object.entries(idsByType)) {
      if (ids.length > 0) {
        for (const id of ids) {
          await d1.prepare(`UPDATE ${table} SET deleted_at = NULL WHERE id = ?`).bind(id).run();
          restoredCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `${restoredCount} مورد با موفقیت بازیابی شدند و به لیست فعال بازگشتند.`,
      restoredCount,
    });
  } catch (err: any) {
    console.error("Trash restore error:", err);
    return NextResponse.json({ success: false, message: "خطا در بازیابی موجودیت‌ها: " + err?.message }, { status: 500 });
  }
}
