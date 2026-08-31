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

interface ImportOfferingItem {
  code?: string;
  courseCode?: string;
  courseName?: string;
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
      getOfferings({ facultyId: targetFacultyId }),
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

    // Build Existing Offerings Key Map: "courseId::professorId" -> offering & code -> offering
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

      const rawProfCode = item.professorCode ? String(item.professorCode).trim().toUpperCase() : "";
      const rawProfEmail = item.professorEmail ? String(item.professorEmail).trim().toLowerCase() : "";
      const rawProfName = item.professorName ? String(item.professorName).trim().toLowerCase() : "";

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

      // Match Professor (Priority 1: Code, Priority 2: Email, Priority 3: Name)
      let matchedProfessor = null;
      if (rawProfCode && profByCode.has(rawProfCode)) {
        matchedProfessor = profByCode.get(rawProfCode);
      } else if (rawProfEmail && profByEmail.has(rawProfEmail)) {
        matchedProfessor = profByEmail.get(rawProfEmail);
      } else if (rawProfName && profByName.has(rawProfName)) {
        matchedProfessor = profByName.get(rawProfName);
      }

      if (!matchedProfessor) {
        errors.push(`استاد با مشخصات کد «${rawProfCode || "---"}» / ایمیل «${rawProfEmail || "---"}» / نام «${item.professorName || "---"}» یافت نشد.`);
        continue;
      }

      const pairKey = `${matchedCourse.id}::${matchedProfessor.id}`;
      const existingPair = offeringPairMap.get(pairKey);
      const existingByCode = offeringCode ? offeringCodeMap.get(offeringCode) : null;

      const existingMatch = existingPair || existingByCode;

      if (existingMatch) {
        // Already exists -> update code if provided
        try {
          if (offeringCode && offeringCode !== existingMatch.code) {
            await updateOffering(existingMatch.id, {
              courseId: matchedCourse.id,
              professorId: matchedProfessor.id,
              code: offeringCode,
            });
            updatedCount++;
            if (offeringCode) offeringCodeMap.set(offeringCode, existingMatch);
          } else {
            updatedCount++;
          }
        } catch (err: any) {
          errors.push(`خطا در به‌روزرسانی ارائه درس ${matchedCourse.name} با ${matchedProfessor.name}: ${err?.message || "خطای نامشخص"}`);
        }
      } else {
        // Create new offering
        try {
          const newOff = await createOffering({
            courseId: matchedCourse.id,
            professorId: matchedProfessor.id,
            code: offeringCode,
          });

          createdCount++;
          offeringPairMap.set(pairKey, newOff);
          if (newOff.code) offeringCodeMap.set(newOff.code.trim().toUpperCase(), newOff);
        } catch (err: any) {
          errors.push(`خطا در ایجاد ارائه درس ${matchedCourse.name} با ${matchedProfessor.name}: ${err?.message || "خطای نامشخص"}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `عملیات با موفقیت انجام شد: ${createdCount} ارائه درسی جدید افزوده و ${updatedCount} ارائه همگام‌سازی شد.`,
      stats: {
        total: rawList.length,
        created: createdCount,
        updated: updatedCount,
        errors,
      },
    });
  } catch (error: any) {
    console.error("Offerings Import error:", error);
    return NextResponse.json(
      { success: false, message: "خطای سرور در ورود ارائه‌های درسی: " + (error?.message || "نامشخص") },
      { status: 500 }
    );
  }
}
