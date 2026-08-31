import { NextRequest, NextResponse } from "next/server";
import {
  getOfferings,
  getCourses,
  getProfessors,
  getFaculties,
  createOffering,
  updateOffering,
  deleteOfferingsByFaculty,
} from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

interface RawProfessorRef {
  professorCode?: string;
  professorEmail?: string;
  professorName?: string;
}

interface ImportOfferingItem {
  code?: string;
  courseCode?: string;
  courseName?: string;
  // Multi-professor formats:
  professors?: RawProfessorRef[];
  professorCodes?: string[];
  professorNames?: string[];
  // Single-professor fallback:
  professorCode?: string;
  professorEmail?: string;
  professorName?: string;
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

    // If Mode is "replace", wipe all existing offerings in this faculty first
    if (mode === "replace") {
      await deleteOfferingsByFaculty(targetFacultyId);
    }

    // 2. Fetch courses & professors for lookup
    const [allCourses, allProfessors, existingOfferings] = await Promise.all([
      getCourses(targetFacultyId),
      getProfessors(targetFacultyId),
      getOfferings(targetFacultyId),
    ]);

    // Build Course Lookup Maps
    const courseByCode = new Map<string, typeof allCourses[0]>();
    const courseByName = new Map<string, typeof allCourses[0]>();
    allCourses.forEach((c) => {
      if (c.code) courseByCode.set(c.code.trim().toUpperCase(), c);
      if (c.name) courseByName.set(c.name.trim().toLowerCase(), c);
    });

    // Build Professor Lookup Maps
    const profByCode = new Map<string, typeof allProfessors[0]>();
    const profByEmail = new Map<string, typeof allProfessors[0]>();
    const profByName = new Map<string, typeof allProfessors[0]>();
    allProfessors.forEach((p) => {
      if (p.code) profByCode.set(p.code.trim().toUpperCase(), p);
      if (p.email) profByEmail.set(p.email.trim().toLowerCase(), p);
      if (p.name) profByName.set(p.name.trim().toLowerCase(), p);
      const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ").trim().toLowerCase();
      if (fullName) profByName.set(fullName, p);
    });

    // Match professor helper function
    const findProfessor = (ref: RawProfessorRef): typeof allProfessors[0] | null => {
      const pCode = ref.professorCode ? String(ref.professorCode).trim().toUpperCase() : "";
      const pEmail = ref.professorEmail ? String(ref.professorEmail).trim().toLowerCase() : "";
      const pName = ref.professorName ? String(ref.professorName).trim().toLowerCase() : "";

      if (pCode && profByCode.has(pCode)) return profByCode.get(pCode)!;
      if (pEmail && profByEmail.has(pEmail)) return profByEmail.get(pEmail)!;
      if (pName && profByName.has(pName)) return profByName.get(pName)!;
      return null;
    };

    // Build Existing Offerings Key Map: "courseId::primaryProfId" -> offering & code -> offering
    const offeringPairMap = new Map<string, typeof existingOfferings[0]>();
    const offeringCodeMap = new Map<string, typeof existingOfferings[0]>();
    existingOfferings.forEach((o) => {
      offeringPairMap.set(`${o.courseId}::${o.professorId}`, o);
      if (o.code) offeringCodeMap.set(o.code.trim().toUpperCase(), o);
    });

    let createdCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    // 3. Process each offering item
    for (const item of rawList) {
      const rawCourseCode = item.courseCode ? String(item.courseCode).trim().toUpperCase() : "";
      const rawCourseName = item.courseName ? String(item.courseName).trim().toLowerCase() : "";
      const offeringCode = item.code ? String(item.code).trim().toUpperCase() : undefined;

      // Match Course (Priority 1: Code, Priority 2: Name)
      let matchedCourse = null;
      if (rawCourseCode && courseByCode.has(rawCourseCode)) {
        matchedCourse = courseByCode.get(rawCourseCode);
      } else if (rawCourseName && courseByName.has(rawCourseName)) {
        matchedCourse = courseByName.get(rawCourseName);
      }

      if (!matchedCourse) {
        errors.push(`درس با مشخصات کد «${rawCourseCode || "---"}» / نام «${item.courseName || "---"}» یافت نشد.`);
        continue;
      }

      // Match All Professors for this Offering
      const rawProfRefs: RawProfessorRef[] = [];

      if (Array.isArray(item.professors) && item.professors.length > 0) {
        rawProfRefs.push(...item.professors);
      } else if (Array.isArray(item.professorCodes) && item.professorCodes.length > 0) {
        item.professorCodes.forEach((c) => rawProfRefs.push({ professorCode: c }));
      } else if (Array.isArray(item.professorNames) && item.professorNames.length > 0) {
        item.professorNames.forEach((n) => rawProfRefs.push({ professorName: n }));
      } else if (item.professorCode || item.professorEmail || item.professorName) {
        rawProfRefs.push({
          professorCode: item.professorCode,
          professorEmail: item.professorEmail,
          professorName: item.professorName,
        });
      }

      const matchedProfIds: string[] = [];
      for (const pRef of rawProfRefs) {
        const prof = findProfessor(pRef);
        if (prof && !matchedProfIds.includes(prof.id)) {
          matchedProfIds.push(prof.id);
        }
      }

      if (matchedProfIds.length === 0) {
        errors.push(`برای درس «${matchedCourse.name}»، هیچ استادی با اطلاعات ارسالی یافت نشد.`);
        continue;
      }

      const primaryProfId = matchedProfIds[0];
      const pairKey = `${matchedCourse.id}::${primaryProfId}`;
      const existingPair = offeringPairMap.get(pairKey);
      const existingByCode = offeringCode ? offeringCodeMap.get(offeringCode) : null;

      const existingMatch = existingPair || existingByCode;

      if (existingMatch) {
        // Already exists -> update code & professors
        try {
          await updateOffering(existingMatch.id, {
            courseId: matchedCourse.id,
            professorIds: matchedProfIds,
            code: offeringCode || existingMatch.code,
          });
          updatedCount++;
        } catch (err: any) {
          errors.push(`خطا در به‌روزرسانی ارائه درس «${matchedCourse.name}»: ${err?.message || "نامشخص"}`);
        }
      } else {
        // Create new offering with multi-professors
        try {
          const newOff = await createOffering({
            courseId: matchedCourse.id,
            professorIds: matchedProfIds,
            code: offeringCode,
          });
          createdCount++;
          offeringPairMap.set(pairKey, newOff);
          if (offeringCode) offeringCodeMap.set(offeringCode, newOff);
        } catch (err: any) {
          errors.push(`خطا در ایجاد ارائه درس «${matchedCourse.name}»: ${err?.message || "نامشخص"}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `عملیات ایمپورت با موفقیت انجام شد: ${createdCount} ارائه ایجاد شد، ${updatedCount} ارائه به‌روزرسانی گردید.`,
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
      { success: false, message: "خطا در پردازش فایل ایمپورت ارائه‌ها: " + (error?.message || "نامشخص") },
      { status: 500 }
    );
  }
}
