import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export interface TrashItem {
  id: string;
  type: "course" | "professor" | "offering" | "event" | "faculty" | "major" | "track";
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
      faculty: 0,
      major: 0,
      track: 0,
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

    // 5. Faculties
    if (typeFilter === "all" || typeFilter === "faculty") {
      const q = "SELECT id, name, code, created_at, deleted_at FROM faculties WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC";
      const { results } = await d1.prepare(q).all();
      for (const r of results || []) {
        items.push({
          id: r.id as string,
          type: "faculty",
          code: (r.code as string) || undefined,
          title: `دانشکده ${r.name}`,
          details: `کد دانشکده: ${(r.code as string) || "-"}`,
          deletedAt: r.deleted_at as string,
          createdAt: (r.created_at as string) || undefined,
        });
      }
    }

    // 6. Majors
    if (typeFilter === "all" || typeFilter === "major") {
      let q = `
        SELECT m.id, m.name, m.code, m.faculty_id, f.name as faculty_name, m.created_at, m.deleted_at
        FROM majors m
        LEFT JOIN faculties f ON m.faculty_id = f.id
        WHERE m.deleted_at IS NOT NULL
      `;
      const params: any[] = [];
      if (facultyId) {
        q += " AND m.faculty_id = ?";
        params.push(facultyId);
      }
      q += " ORDER BY m.deleted_at DESC";

      const { results } = await d1.prepare(q).bind(...params).all();
      for (const r of results || []) {
        items.push({
          id: r.id as string,
          type: "major",
          code: (r.code as string) || undefined,
          title: `رشته ${r.name}`,
          details: `دانشکده: ${(r.faculty_name as string) || "نامشخص"} | کد رشته: ${(r.code as string) || "-"}`,
          facultyId: (r.faculty_id as string) || undefined,
          facultyName: (r.faculty_name as string) || undefined,
          deletedAt: r.deleted_at as string,
          createdAt: (r.created_at as string) || undefined,
        });
      }
    }

    // 7. Tracks
    if (typeFilter === "all" || typeFilter === "track") {
      let q = `
        SELECT t.id, t.name, t.code, t.major_id, m.name as major_name, m.faculty_id, f.name as faculty_name, t.created_at, t.deleted_at
        FROM tracks t
        LEFT JOIN majors m ON t.major_id = m.id
        LEFT JOIN faculties f ON m.faculty_id = f.id
        WHERE t.deleted_at IS NOT NULL
      `;
      const params: any[] = [];
      if (facultyId) {
        q += " AND m.faculty_id = ?";
        params.push(facultyId);
      }
      q += " ORDER BY t.deleted_at DESC";

      const { results } = await d1.prepare(q).bind(...params).all();
      for (const r of results || []) {
        items.push({
          id: r.id as string,
          type: "track",
          code: (r.code as string) || undefined,
          title: `گرایش ${r.name}`,
          details: `رشته: ${(r.major_name as string) || "نامشخص"} (دانشکده: ${(r.faculty_name as string) || "-"}) | کد گرایش: ${(r.code as string) || "-"}`,
          facultyId: (r.faculty_id as string) || undefined,
          facultyName: (r.faculty_name as string) || undefined,
          deletedAt: r.deleted_at as string,
          createdAt: (r.created_at as string) || undefined,
        });
      }
    }

    // Calculate all counts
    let countFacQ = "SELECT count(*) as c FROM faculties WHERE deleted_at IS NOT NULL";
    let countMajQ = "SELECT count(*) as c FROM majors WHERE deleted_at IS NOT NULL";
    let countTrkQ = "SELECT count(*) as c FROM tracks t LEFT JOIN majors m ON t.major_id = m.id WHERE t.deleted_at IS NOT NULL";
    let countCrsQ = "SELECT count(*) as c FROM courses WHERE deleted_at IS NOT NULL";
    let countProfQ = "SELECT count(*) as c FROM professors WHERE deleted_at IS NOT NULL";
    let countOffQ = "SELECT count(*) as c FROM course_offerings o JOIN courses c ON o.course_id = c.id WHERE o.deleted_at IS NOT NULL";
    let countEvtQ = "SELECT count(*) as c FROM course_events e JOIN course_offerings o ON e.offering_id = o.id JOIN courses c ON o.course_id = c.id WHERE e.deleted_at IS NOT NULL";

    const facParam = facultyId ? [facultyId] : [];
    if (facultyId) {
      countMajQ += " AND faculty_id = ?";
      countTrkQ += " AND m.faculty_id = ?";
      countCrsQ += " AND faculty_id = ?";
      countProfQ += " AND faculty_id = ?";
      countOffQ += " AND c.faculty_id = ?";
      countEvtQ += " AND c.faculty_id = ?";
    }

    const countFacultyRes = await d1.prepare(countFacQ).first();
    const countMajorRes = await d1.prepare(countMajQ).bind(...facParam).first();
    const countTrackRes = await d1.prepare(countTrkQ).bind(...facParam).first();
    const countCourseRes = await d1.prepare(countCrsQ).bind(...facParam).first();
    const countProfRes = await d1.prepare(countProfQ).bind(...facParam).first();
    const countOffRes = await d1.prepare(countOffQ).bind(...facParam).first();
    const countEvtRes = await d1.prepare(countEvtQ).bind(...facParam).first();

    counts.faculty = Number(countFacultyRes?.c) || 0;
    counts.major = Number(countMajorRes?.c) || 0;
    counts.track = Number(countTrackRes?.c) || 0;
    counts.course = Number(countCourseRes?.c) || 0;
    counts.professor = Number(countProfRes?.c) || 0;
    counts.offering = Number(countOffRes?.c) || 0;
    counts.event = Number(countEvtRes?.c) || 0;
    counts.all =
      counts.faculty +
      counts.major +
      counts.track +
      counts.course +
      counts.professor +
      counts.offering +
      counts.event;

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
