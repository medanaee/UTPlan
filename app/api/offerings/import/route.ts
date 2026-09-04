import { NextRequest, NextResponse } from "next/server";
import {
  getCourses,
  getProfessors,
  getFaculties,
  getD1,
} from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

interface ImportOfferingItem {
  id?: string;
  code?: string;
  courseCode?: string;
  mainProfessor?: string;
  professors?: string[];
  description?: string;
  finalizedSemesters?: string[];
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const { searchParams } = new URL(request.url);
    const queryFacultyId = searchParams.get("facultyId");
    const queryMode = searchParams.get("mode");

    const body = await request.json();
    let rawList: ImportOfferingItem[] = [];
    let targetFacultyId = queryFacultyId || undefined;
    let mode = (queryMode || (body && typeof body === "object" ? body.mode : null) || "append") as "append" | "replace";

    if (Array.isArray(body)) {
      rawList = body;
    } else if (body && typeof body === "object") {
      rawList = Array.isArray(body.offerings) ? body.offerings : [];
      if (body.facultyId) {
        targetFacultyId = body.facultyId;
      }
    }

    if (!Array.isArray(rawList) || rawList.length === 0) {
      return NextResponse.json(
        { success: false, message: "لیست ارائه‌های ارسالی خالی یا نامعتبر است." },
        { status: 400 }
      );
    }

    const d1 = getD1();
    if (!d1) {
      return NextResponse.json({ success: false, message: "پایگاه داده در دسترس نیست." }, { status: 500 });
    }

    // 1. Resolve Target Faculty
    const existingFaculties = await getFaculties();
    if (!targetFacultyId || !existingFaculties.some((f) => f.id === targetFacultyId)) {
      if (existingFaculties.length > 0) {
        targetFacultyId = existingFaculties[0].id;
      } else {
        return NextResponse.json(
          { success: false, message: "هیچ دانشکده‌ای در سامانه تعریف نشده است." },
          { status: 400 }
        );
      }
    }

    // 2. Fetch courses & professors of this faculty for code lookup
    const [allCourses, allProfessors] = await Promise.all([
      getCourses(targetFacultyId),
      getProfessors(targetFacultyId),
    ]);

    // Build Course Lookup Map by Code (Sole criterion)
    const courseByCode = new Map<string, typeof allCourses[0]>();
    allCourses.forEach((c) => {
      if (c.code) courseByCode.set(c.code.trim().toUpperCase(), c);
    });

    // Build Professor Lookup Map by Code (Sole criterion)
    const profByCode = new Map<string, typeof allProfessors[0]>();
    allProfessors.forEach((p) => {
      if (p.code) profByCode.set(p.code.trim().toUpperCase(), p);
    });

    // Fetch all existing offerings of target faculty (including soft-deleted for code reuse/restoration)
    const { results: allOfferingRows } = await d1
      .prepare(
        `SELECT o.* FROM course_offerings o
         JOIN courses c ON o.course_id = c.id
         WHERE c.faculty_id = ?`
      )
      .bind(targetFacultyId)
      .all();

    const offeringCodeMap = new Map<string, any>();
    (allOfferingRows || []).forEach((o: any) => {
      if (o.code) offeringCodeMap.set(o.code.trim().toUpperCase(), o);
    });

    // Fetch existing offerings outside target faculty to protect against overwriting
    const { results: otherOfferingRows } = await d1
      .prepare(
        `SELECT o.code, f.name AS faculty_name
         FROM course_offerings o
         JOIN courses c ON o.course_id = c.id
         JOIN faculties f ON c.faculty_id = f.id
         WHERE c.faculty_id != ? AND o.deleted_at IS NULL`
      )
      .bind(targetFacultyId)
      .all();

    const otherOfferingCodeMap = new Map<string, string>();
    (otherOfferingRows || []).forEach((o: any) => {
      if (o.code) otherOfferingCodeMap.set(o.code.trim().toUpperCase(), o.faculty_name || "دانشکده دیگر");
    });

    let createdCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];
    const stmts: any[] = [];
    const now = new Date().toISOString();

    // 3. Process each offering item
    for (const item of rawList) {
      // 3.1 Offering Code is Mandatory and Sole Matching Key
      const offeringCode = item.code ? String(item.code).trim().toUpperCase() : "";
      if (!offeringCode) {
        errors.push(`ردیف بدون کد ارائه (code) رد شد: ${JSON.stringify(item)}`);
        continue;
      }

      // Check if code belongs to another faculty
      if (otherOfferingCodeMap.has(offeringCode)) {
        errors.push(
          `کد ارائه «${offeringCode}» متعلق به ${otherOfferingCodeMap.get(
            offeringCode
          )} است و از طریق ایمپورت دانشکده دیگر قابل تغییر نیست.`
        );
        continue;
      }

      // 3.2 Course Code is Mandatory
      const courseCode = item.courseCode ? String(item.courseCode).trim().toUpperCase() : "";
      if (!courseCode) {
        errors.push(`ارائه «${offeringCode}» بدون کد درس (courseCode) ارسال شده است.`);
        continue;
      }

      const matchedCourse = courseByCode.get(courseCode);
      if (!matchedCourse) {
        errors.push(`درس با کد «${courseCode}» در این دانشکده یا دانشکده‌های متصل به آن یافت نشد.`);
        continue;
      }

      // 3.3 Main Professor and Professors array validation
      const mainProfCode = item.mainProfessor ? String(item.mainProfessor).trim().toUpperCase() : "";
      if (!mainProfCode) {
        errors.push(`ارائه «${offeringCode}» بدون کد استاد اصلی (mainProfessor) ارسال شده است.`);
        continue;
      }

      const rawProfCodes: string[] = Array.isArray(item.professors)
        ? item.professors.map((c) => String(c).trim().toUpperCase()).filter(Boolean)
        : [];

      if (rawProfCodes.length === 0) {
        errors.push(`ارائه «${offeringCode}» فاقد لیست کدهای اساتید (professors) است.`);
        continue;
      }

      if (!rawProfCodes.includes(mainProfCode)) {
        errors.push(`کد استاد اصلی «${mainProfCode}» در آرایه اساتید (professors) ارائه «${offeringCode}» وجود ندارد.`);
        continue;
      }

      // Order professors so that mainProfessor is at index 0 (primary)
      const orderedProfCodes = [mainProfCode, ...rawProfCodes.filter((c) => c !== mainProfCode)];
      const resolvedProfIds: string[] = [];
      let profNotFound = false;

      for (const pCode of orderedProfCodes) {
        const prof = profByCode.get(pCode);
        if (!prof) {
          errors.push(`استاد با کد «${pCode}» برای ارائه «${offeringCode}» در این دانشکده یافت نشد.`);
          profNotFound = true;
          break;
        }
        if (!resolvedProfIds.includes(prof.id)) {
          resolvedProfIds.push(prof.id);
        }
      }

      if (profNotFound || resolvedProfIds.length === 0) {
        continue;
      }

      const cleanDesc = item.description !== undefined ? String(item.description).trim() : undefined;
      const cleanSemesters = Array.isArray(item.finalizedSemesters) ? item.finalizedSemesters : undefined;

      const existingMatch = offeringCodeMap.get(offeringCode);

      if (existingMatch) {
        // Update offering and restore if soft-deleted
        const desc = cleanDesc !== undefined ? cleanDesc : (existingMatch.description || null);
        const semStr = cleanSemesters !== undefined ? JSON.stringify(cleanSemesters) : (existingMatch.finalized_semesters || "[]");

        stmts.push(
          d1.prepare(`
            UPDATE course_offerings
            SET course_id = ?, code = ?, description = ?, finalized_semesters = ?, deleted_at = NULL
            WHERE id = ?
          `).bind(matchedCourse.id, offeringCode, desc, semStr, existingMatch.id)
        );

        stmts.push(
          d1.prepare("DELETE FROM offering_professors WHERE offering_id = ?").bind(existingMatch.id)
        );

        for (let i = 0; i < resolvedProfIds.length; i++) {
          const pId = resolvedProfIds[i];
          const isPrimary = i === 0 ? 1 : 0;
          const opId = `op_${existingMatch.id}_${pId}`;
          stmts.push(
            d1.prepare(`
              INSERT INTO offering_professors (id, offering_id, professor_id, is_primary, created_at)
              VALUES (?, ?, ?, ?, ?)
            `).bind(opId, existingMatch.id, pId, isPrimary, now)
          );
        }
        updatedCount++;
      } else {
        // Create new offering
        const newId = item.id?.trim() || `off_${crypto.randomUUID().slice(0, 8)}`;
        const desc = cleanDesc || null;
        const semStr = JSON.stringify(cleanSemesters || []);

        stmts.push(
          d1.prepare(`
            INSERT INTO course_offerings (id, code, course_id, description, finalized_semesters, created_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, NULL)
          `).bind(newId, offeringCode, matchedCourse.id, desc, semStr, now)
        );

        for (let i = 0; i < resolvedProfIds.length; i++) {
          const pId = resolvedProfIds[i];
          const isPrimary = i === 0 ? 1 : 0;
          const opId = `op_${newId}_${pId}`;
          stmts.push(
            d1.prepare(`
              INSERT INTO offering_professors (id, offering_id, professor_id, is_primary, created_at)
              VALUES (?, ?, ?, ?, ?)
            `).bind(opId, newId, pId, isPrimary, now)
          );
        }
        createdCount++;
        offeringCodeMap.set(offeringCode, {
          id: newId,
          code: offeringCode,
          description: desc,
          finalized_semesters: semStr,
        });
      }
    }

    if (stmts.length > 0) {
      for (const bChunk of chunkArray(stmts, 50)) {
        await d1.batch(bChunk);
      }
    }

    return NextResponse.json({
      success: true,
      message: `عملیات با موفقیت انجام شد: ${createdCount} ارائه جدید افزوده و ${updatedCount} ارائه به‌روزرسانی شدند.`,
      stats: {
        total: rawList.length,
        created: createdCount,
        updated: updatedCount,
        errors,
      },
      data: {
        createdCount,
        updatedCount,
        errorCount: errors.length,
        errors,
      },
    });
  } catch (error: any) {
    console.error("Import offerings error:", error);
    return NextResponse.json(
      { success: false, message: "خطای سرور در پردازش فایل ایمپورت ارائه‌ها: " + (error?.message || "نامشخص") },
      { status: 500 }
    );
  }
}
