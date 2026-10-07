import { apiResponseJson } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { getD1, logAdminAction } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const body: any = await request.json();
    const rawItems: Array<{ type: string; id: string }> =
      body?.items || (body?.type && body?.id ? [{ type: body.type, id: body.id }] : []);

    if (rawItems.length === 0) {
      return apiResponseJson({ success: false, message: "هیچ موجودیتی برای بازیابی مشخص نشده است." }, { status: 400 });
    }

    const d1 = getD1();
    if (!d1) {
      return apiResponseJson({ success: false, message: "پایگاه داده در دسترس نیست." }, { status: 500 });
    }

    const idsByType: Record<string, string[]> = {
      faculties: [],
      majors: [],
      tracks: [],
      courses: [],
      professors: [],
      course_offerings: [],
      course_events: [],
      physical_faculties: [],
    };

    for (const it of rawItems) {
      if (it.type === "faculty") idsByType.faculties.push(it.id);
      else if (it.type === "major") idsByType.majors.push(it.id);
      else if (it.type === "track") idsByType.tracks.push(it.id);
      else if (it.type === "course") idsByType.courses.push(it.id);
      else if (it.type === "professor") idsByType.professors.push(it.id);
      else if (it.type === "offering") idsByType.course_offerings.push(it.id);
      else if (it.type === "event") idsByType.course_events.push(it.id);
      else if (it.type === "physical_faculty") idsByType.physical_faculties.push(it.id);
    }

    const stmts: any[] = [];
    let restoredCount = 0;
    for (const [table, ids] of Object.entries(idsByType)) {
      if (ids.length > 0) {
        restoredCount += ids.length;
        for (let i = 0; i < ids.length; i += 50) {
          const chunk = ids.slice(i, i + 50);
          const placeholders = chunk.map(() => "?").join(",");
          stmts.push(d1.prepare(`UPDATE ${table} SET deleted_at = NULL WHERE id IN (${placeholders})`).bind(...chunk));
        }
      }
    }

    if (stmts.length > 0) {
      for (let i = 0; i < stmts.length; i += 100) {
        const batchChunk = stmts.slice(i, i + 100);
        await d1.batch(batchChunk);
      }
    }

    await logAdminAction({
      userId: auth.user!.id,
      userName: auth.user!.name,
      userEmail: auth.user!.email,
      action: "RESTORE",
      entityType: "trash",
      entityName: `${restoredCount} مورد بازیابی‌شده`,
      details: { items: rawItems },
    });

    return apiResponseJson({
      success: true,
      message: `${restoredCount} مورد با موفقیت بازیابی شدند و به لیست فعال بازگشتند.`,
      restoredCount,
    });
  } catch (err: any) {
    console.error("Trash restore error:", err);
    return apiResponseJson({ success: false, message: "خطا در بازیابی موجودیت‌ها: " + err?.message }, { status: 500 });
  }
}
