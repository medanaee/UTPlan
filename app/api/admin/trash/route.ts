import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export interface TrashItem {
  id: string;
  type: "course" | "professor" | "offering" | "event";
  code?: string;
  title: string;
  details?: string;
  facultyId?: string;
  facultyName?: string;
  deletedAt: string;
  createdAt?: string;
  metadata?: Record<string, any>;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get("type") || "all";
    const facultyId = searchParams.get("facultyId") || undefined;

    const d1 = getD1();
    if (!d1) {
      return NextResponse.json({ success: false, message: "پایگاه داده در دسترس نیست." }, { status: 500 });
    }

    const items: TrashItem[] = [];
    const counts = {
      all: 0,
      course: 0,
      professor: 0,
      offering: 0,
      event: 0,
    };

    // 1. Courses
    if (typeFilter === "all" || typeFilter === "course") {
      let q = `
        SELECT c.id, c.code, c.name, c.units, c.faculty_id, f.name as faculty_name, c.created_at, c.deleted_at
        FROM courses c
        LEFT JOIN faculties f ON c.faculty_id = f.id
        WHERE c.deleted_at IS NOT NULL
      `;
      const params: any[] = [];
      if (facultyId) {
        q += " AND c.faculty_id = ?";
        params.push(facultyId);
      }
      q += " ORDER BY c.deleted_at DESC";

      const { results } = await d1.prepare(q).bind(...params).all();
      for (const r of results || []) {
        items.push({
          id: r.id as string,
          type: "course",
          code: (r.code as string) || undefined,
          title: r.name as string,
          details: `تعداد واحد: ${r.units || 3} | کد درس: ${r.code || "بدون کد"}`,
          facultyId: (r.faculty_id as string) || undefined,
          facultyName: (r.faculty_name as string) || undefined,
          deletedAt: r.deleted_at as string,
          createdAt: (r.created_at as string) || undefined,
        });
      }
    }

    // 2. Professors
    if (typeFilter === "all" || typeFilter === "professor") {
      let q = `
        SELECT p.id, p.code, p.first_name, p.last_name, p.title, p.faculty_id, f.name as faculty_name, p.created_at, p.deleted_at
        FROM professors p
        LEFT JOIN faculties f ON p.faculty_id = f.id
        WHERE p.deleted_at IS NOT NULL
      `;
      const params: any[] = [];
      if (facultyId) {
        q += " AND p.faculty_id = ?";
        params.push(facultyId);
      }
      q += " ORDER BY p.deleted_at DESC";

      const { results } = await d1.prepare(q).bind(...params).all();
      for (const r of results || []) {
        const fullName = [r.first_name, r.last_name].filter(Boolean).join(" ");
        items.push({
          id: r.id as string,
          type: "professor",
          code: (r.code as string) || undefined,
          title: fullName || "استاد بدون نام",
          details: `مرتبه: ${(r.title as string) || "استاد تمام"} | کد: ${(r.code as string) || "ندارد"}`,
          facultyId: (r.faculty_id as string) || undefined,
          facultyName: (r.faculty_name as string) || undefined,
          deletedAt: r.deleted_at as string,
          createdAt: (r.created_at as string) || undefined,
        });
      }
    }

    // 3. Offerings
    if (typeFilter === "all" || typeFilter === "offering") {
      let q = `
        SELECT o.id, o.code, o.description, o.course_id, c.name as course_name, c.code as course_code, c.faculty_id, f.name as faculty_name, o.created_at, o.deleted_at
        FROM course_offerings o
        JOIN courses c ON o.course_id = c.id
        LEFT JOIN faculties f ON c.faculty_id = f.id
        WHERE o.deleted_at IS NOT NULL
      `;
      const params: any[] = [];
      if (facultyId) {
        q += " AND c.faculty_id = ?";
        params.push(facultyId);
      }
      q += " ORDER BY o.deleted_at DESC";

      const { results } = await d1.prepare(q).bind(...params).all();
      for (const r of results || []) {
        items.push({
          id: r.id as string,
          type: "offering",
          code: (r.code as string) || undefined,
          title: `ارائه درس ${r.course_name}`,
          details: `کد ارائه: ${(r.code as string) || "ندارد"} | کد درس: ${(r.course_code as string) || "-"}`,
          facultyId: (r.faculty_id as string) || undefined,
          facultyName: (r.faculty_name as string) || undefined,
          deletedAt: r.deleted_at as string,
          createdAt: (r.created_at as string) || undefined,
          metadata: {
            courseId: r.course_id,
            courseName: r.course_name,
          },
        });
      }
    }

    // 4. Events
    if (typeFilter === "all" || typeFilter === "event") {
      let q = `
        SELECT e.id, e.code, e.term, e.location, e.exam_date, e.exam_start_time, e.exam_end_time,
               o.id as offering_id, o.code as offering_code,
               c.id as course_id, c.name as course_name, c.code as course_code, c.faculty_id, f.name as faculty_name,
               e.created_at, e.deleted_at
        FROM course_events e
        JOIN course_offerings o ON e.offering_id = o.id
        JOIN courses c ON o.course_id = c.id
        LEFT JOIN faculties f ON c.faculty_id = f.id
        WHERE e.deleted_at IS NOT NULL
      `;
      const params: any[] = [];
      if (facultyId) {
        q += " AND c.faculty_id = ?";
        params.push(facultyId);
      }
      q += " ORDER BY e.deleted_at DESC";

      const { results } = await d1.prepare(q).bind(...params).all();
      for (const r of results || []) {
        items.push({
          id: r.id as string,
          type: "event",
          code: (r.code as string) || undefined,
          title: `رویداد کلاسی ${r.course_name} (نیمسال ${r.term})`,
          details: `کد رویداد: ${(r.code as string) || "ندارد"} | محل: ${(r.location as string) || "نامشخص"} | ارائه: ${(r.offering_code as string) || "-"}`,
          facultyId: (r.faculty_id as string) || undefined,
          facultyName: (r.faculty_name as string) || undefined,
          deletedAt: r.deleted_at as string,
          createdAt: (r.created_at as string) || undefined,
          metadata: {
            term: r.term,
            offeringId: r.offering_id,
          },
        });
      }
    }

    // Calculate all counts
    const countCourseRes = await d1.prepare("SELECT count(*) as c FROM courses WHERE deleted_at IS NOT NULL").first();
    const countProfRes = await d1.prepare("SELECT count(*) as c FROM professors WHERE deleted_at IS NOT NULL").first();
    const countOffRes = await d1.prepare("SELECT count(*) as c FROM course_offerings WHERE deleted_at IS NOT NULL").first();
    const countEvtRes = await d1.prepare("SELECT count(*) as c FROM course_events WHERE deleted_at IS NOT NULL").first();

    counts.course = Number(countCourseRes?.c) || 0;
    counts.professor = Number(countProfRes?.c) || 0;
    counts.offering = Number(countOffRes?.c) || 0;
    counts.event = Number(countEvtRes?.c) || 0;
    counts.all = counts.course + counts.professor + counts.offering + counts.event;

    // Sort items by deletedAt descending
    items.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

    return NextResponse.json({
      success: true,
      data: {
        items,
        counts,
      },
    });
  } catch (err: any) {
    console.error("Trash GET error:", err);
    return NextResponse.json({ success: false, message: "خطا در دریافت لیست سطل بازیافت: " + err?.message }, { status: 500 });
  }
}
