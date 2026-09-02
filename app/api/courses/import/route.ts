import { NextRequest, NextResponse } from "next/server";
import {
  deleteCoursesByFaculty,
  getCourses,
  getFaculties,
  createCourse,
  updateCourse,
  addPrerequisite,
  getAllPrerequisites,
  findUserById,
} from "@/lib/db";
import { getAuthTokenFromRequest, verifySessionToken } from "@/lib/auth";
import { wouldCreatePrerequisiteCycle } from "@/lib/graph-utils";
import type { PrerequisiteType } from "@/lib/types";

interface ImportCourseItem {
  code: string;
  abbreviation?: string;
  name: string;
  units?: number;
  offeredIn?: "fall" | "spring" | "both" | "none";
  description?: string;
  prerequisites?: any;
  corequisites?: any;
  recommendedPrerequisites?: any;
  recommended?: any;
}

// Helper: Extract clean string references from array, object, or comma-separated string
function extractCourseRefs(rawVal: any): string[] {
  if (!rawVal) return [];
  if (Array.isArray(rawVal)) {
    const res: string[] = [];
    for (const item of rawVal) {
      if (typeof item === "string" && item.trim()) {
        res.push(item.trim());
      } else if (item && typeof item === "object") {
        const codeOrName =
          item.code ||
          item.courseCode ||
          item.name ||
          item.courseName ||
          item.abbreviation ||
          item.id;
        if (codeOrName && typeof codeOrName === "string" && codeOrName.trim()) {
          res.push(codeOrName.trim());
        }
      }
    }
    return res;
  }
  if (typeof rawVal === "string") {
    const trimmed = rawVal.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        return extractCourseRefs(parsed);
      } catch {}
    }
    return trimmed
      .split(/[,،]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export async function POST(request: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ success: false, message: "احراز هویت نشده‌اید." }, { status: 401 });
    }

    const session = await verifySessionToken(token);
    if (!session) {
      return NextResponse.json({ success: false, message: "دسترسی غیرمجاز." }, { status: 403 });
    }

    const liveUser = await findUserById(session.id);
    if (!liveUser || (liveUser.role !== "admin" && liveUser.role !== "super_admin")) {
      return NextResponse.json({ success: false, message: "تنها مدیران مجاز به ورود دسته‌ای دروس هستند." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const queryFacultyId = searchParams.get("facultyId");
    const queryMode = searchParams.get("mode");

    const body = await request.json();
    let rawList: ImportCourseItem[] = [];
    let targetFacultyId = queryFacultyId || undefined;
    let mode = (queryMode || (body && typeof body === "object" ? body.mode : null) || "append") as "append" | "replace";

    if (Array.isArray(body)) {
      rawList = body;
    } else if (body && typeof body === "object") {
      rawList = Array.isArray(body.courses) ? body.courses : [];
      if (body.facultyId) {
        targetFacultyId = body.facultyId;
      }
    }

    if (!Array.isArray(rawList) || rawList.length === 0) {
      return NextResponse.json(
        { success: false, message: "لیست دروس ارسالی خالی یا نامعتبر است." },
        { status: 400 }
      );
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

    // 2. Fetch courses of target faculty (including soft-deleted for code reuse/restore)
    const { results: allFacultyCourses } = await (async () => {
      const { getD1 } = await import("@/lib/db/client");
      const d1 = getD1();
      if (!d1) return { results: [] };
      return await d1.prepare("SELECT * FROM courses WHERE faculty_id = ?").bind(targetFacultyId).all();
    })();

    const facultyCourseCodeMap = new Map<string, any>();
    (allFacultyCourses || []).forEach((c: any) => {
      if (c.code) facultyCourseCodeMap.set(c.code.trim().toUpperCase(), c);
    });

    const currentCourses = await getCourses();
    const courseCodeToIdMap = new Map<string, string>(); // UPPER(code) -> id
    const courseNameToIdMap = new Map<string, string>(); // LOWER(name) -> id
    const courseAbbrToIdMap = new Map<string, string>(); // UPPER(abbr) -> id

    currentCourses.forEach((c) => {
      if (c.code) courseCodeToIdMap.set(c.code.trim().toUpperCase(), c.id);
      if (c.name) courseNameToIdMap.set(c.name.trim().toLowerCase(), c.id);
      if (c.abbreviation) courseAbbrToIdMap.set(c.abbreviation.trim().toUpperCase(), c.id);
    });

    let createdCount = 0;
    let updatedCount = 0;
    let prereqsAdded = 0;
    const errors: string[] = [];

    // 4. Step 1: Create or Update Courses
    for (const item of rawList) {
      if (!item.code || !item.name) {
        errors.push(`سطر بدون کد یا نام درس رد شد: ${JSON.stringify(item)}`);
        continue;
      }

      const cleanCode = String(item.code).trim().toUpperCase();
      const cleanName = String(item.name).trim();
      const cleanUnits = Number(item.units) || 3;
      const rawOff = item.offeredIn ? String(item.offeredIn).trim().toLowerCase() : "";
      const cleanOffered =
        rawOff === "fall" || rawOff === "پاییز"
          ? "fall"
          : rawOff === "spring" || rawOff === "بهار"
          ? "spring"
          : rawOff === "none" || rawOff === "عدم ارائه" || rawOff === "نامشخص"
          ? "none"
          : "both";
      const cleanAbbr = item.abbreviation ? String(item.abbreviation).trim() : undefined;
      const cleanDesc = item.description || "";

      const existingFacultyCourse = facultyCourseCodeMap.get(cleanCode);

      if (existingFacultyCourse) {
        // Update existing course (and restore if previously soft-deleted)
        try {
          await updateCourse(existingFacultyCourse.id, {
            name: cleanName,
            abbreviation: cleanAbbr,
            units: cleanUnits,
            offeredIn: cleanOffered,
            description: cleanDesc,
            facultyId: targetFacultyId,
            deletedAt: null,
          });
          updatedCount++;
          courseCodeToIdMap.set(cleanCode, existingFacultyCourse.id);
          courseNameToIdMap.set(cleanName.toLowerCase(), existingFacultyCourse.id);
          if (cleanAbbr) courseAbbrToIdMap.set(cleanAbbr.toUpperCase(), existingFacultyCourse.id);
        } catch (err: any) {
          errors.push(`خطا در ویرایش درس ${cleanName} (${cleanCode}): ${err?.message || "خطای نامشخص"}`);
        }
      } else {
        // Create new course
        try {
          const newCourse = await createCourse({
            facultyId: targetFacultyId,
            code: cleanCode,
            abbreviation: cleanAbbr,
            name: cleanName,
            units: cleanUnits,
            offeredIn: cleanOffered,
            description: cleanDesc,
          });
          createdCount++;
          courseCodeToIdMap.set(cleanCode, newCourse.id);
          courseNameToIdMap.set(cleanName.toLowerCase(), newCourse.id);
          if (cleanAbbr) courseAbbrToIdMap.set(cleanAbbr.toUpperCase(), newCourse.id);
        } catch (err: any) {
          errors.push(`خطا در ایجاد درس ${cleanName} (${cleanCode}): ${err?.message || "خطای نامشخص"}`);
        }
      }
    }

    // 3. Step 2: Establish Prerequisites, Corequisites, and Recommended Prerequisites
    let allPrereqs = await getAllPrerequisites();

    // Helper: Find target course ID by reference string
    const resolveTargetId = (refStr: string): string | null => {
      const clean = refStr.trim();
      if (!clean) return null;
      const upper = clean.toUpperCase();
      const lower = clean.toLowerCase();

      return (
        courseCodeToIdMap.get(upper) ||
        courseNameToIdMap.get(lower) ||
        courseAbbrToIdMap.get(upper) ||
        null
      );
    };

    for (const item of rawList) {
      const cleanCode = String(item.code || "").trim().toUpperCase();
      const cleanName = String(item.name || "").trim().toLowerCase();
      const sourceCourseId = courseCodeToIdMap.get(cleanCode) || courseNameToIdMap.get(cleanName);
      if (!sourceCourseId) continue;

      // A) Process Hard Prerequisites
      const prereqsList = extractCourseRefs(item.prerequisites);
      for (const reqRef of prereqsList) {
        const targetCourseId = resolveTargetId(reqRef);

        if (!targetCourseId) {
          errors.push(`پیش‌نیاز «${reqRef}» برای درس «${item.name}» در سامانه یافت نشد.`);
          continue;
        }

        if (sourceCourseId === targetCourseId) continue;

        const exists = allPrereqs.some(
          (p) => p.courseId === sourceCourseId && p.requiredCourseId === targetCourseId && p.type === "prerequisite"
        );

        if (!exists) {
          const causesCycle = wouldCreatePrerequisiteCycle(allPrereqs, {
            courseId: sourceCourseId,
            requiredCourseId: targetCourseId,
          });

          if (causesCycle) {
            errors.push(`هشدار: پیش‌نیاز «${reqRef}» برای درس «${item.name}» به دلیل ایجاد چرخه اضافه نشد.`);
          } else {
            try {
              const added = await addPrerequisite(sourceCourseId, targetCourseId, "prerequisite");
              allPrereqs.push(added);
              prereqsAdded++;
            } catch (err: any) {
              errors.push(`خطا در افزودن پیش‌نیاز «${reqRef}»: ${err?.message || ""}`);
            }
          }
        }
      }

      // B) Process Corequisites
      const coreqsList = extractCourseRefs(item.corequisites);
      for (const reqRef of coreqsList) {
        const targetCourseId = resolveTargetId(reqRef);

        if (!targetCourseId || sourceCourseId === targetCourseId) continue;

        const exists = allPrereqs.some(
          (p) => p.courseId === sourceCourseId && p.requiredCourseId === targetCourseId && p.type === "corequisite"
        );

        if (!exists) {
          try {
            const added = await addPrerequisite(sourceCourseId, targetCourseId, "corequisite");
            allPrereqs.push(added);
            prereqsAdded++;
          } catch (err: any) {
            errors.push(`خطا در افزودن هم‌نیاز «${reqRef}»: ${err?.message || ""}`);
          }
        }
      }

      // C) Process Recommended Prerequisites
      const recList = extractCourseRefs(item.recommendedPrerequisites || item.recommended);
      for (const reqRef of recList) {
        const targetCourseId = resolveTargetId(reqRef);

        if (!targetCourseId || sourceCourseId === targetCourseId) continue;

        const exists = allPrereqs.some(
          (p) => p.courseId === sourceCourseId && p.requiredCourseId === targetCourseId && p.type === "recommended"
        );

        if (!exists) {
          try {
            const added = await addPrerequisite(sourceCourseId, targetCourseId, "recommended");
            allPrereqs.push(added);
            prereqsAdded++;
          } catch (err: any) {
            errors.push(`خطا در افزودن پیش‌نیاز پیشنهادی «${reqRef}»: ${err?.message || ""}`);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `ورود اطلاعات دروس با موفقیت انجام شد: ${createdCount} درس ایجاد، ${updatedCount} درس به‌روزرسانی و ${prereqsAdded} پیش‌نیاز/هم‌نیاز/پیشنهادی ثبت گردید.`,
      stats: {
        total: rawList.length,
        created: createdCount,
        updated: updatedCount,
        prerequisitesAdded: prereqsAdded,
        errors,
      },
    });
  } catch (error: any) {
    console.error("Courses import error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در ورود دسته‌ای دروس: " + (error?.message || "نامشخص") },
      { status: 500 }
    );
  }
}
