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

interface ImportCourseItem {
  code: string;
  abbreviation?: string;
  name: string;
  units?: number;
  offeredIn?: "fall" | "spring" | "both" | "none";
  description?: string;
  prerequisites?: string[];
  corequisites?: string[];
  recommendedPrerequisites?: string[];
  recommended?: string[];
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

    const body = await request.json();
    let rawList: ImportCourseItem[] = [];
    let targetFacultyId = queryFacultyId || undefined;

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

    // 1. Resolve Target Faculty & Import Mode
    const mode = (searchParams.get("mode") || (body && typeof body === "object" ? body.mode : null) || "append") as "append" | "replace";

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

    // If Mode is "replace", wipe all existing courses in this faculty first
    if (mode === "replace") {
      await deleteCoursesByFaculty(targetFacultyId);
    }

    // 2. Fetch current courses
    const existingCourses = await getCourses();

    const courseCodeToIdMap = new Map<string, string>(); // code -> id
    const courseNameToIdMap = new Map<string, string>(); // name -> id
    existingCourses.forEach((c) => {
      if (c.code) courseCodeToIdMap.set(c.code.trim(), c.id);
      if (c.name) courseNameToIdMap.set(c.name.trim(), c.id);
    });

    let createdCount = 0;
    let updatedCount = 0;
    let prereqsAdded = 0;
    const errors: string[] = [];

    // 3. Step 1: Create or Update Courses
    for (const item of rawList) {
      if (!item.code || !item.name) {
        errors.push(`سطر بدون کد یا نام درس رد شد: ${JSON.stringify(item)}`);
        continue;
      }

      const cleanCode = String(item.code).trim();
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

      const existingCourseId = courseCodeToIdMap.get(cleanCode);

      if (existingCourseId) {
        // Update existing course
        try {
          await updateCourse(existingCourseId, {
            name: cleanName,
            abbreviation: cleanAbbr,
            units: cleanUnits,
            offeredIn: cleanOffered,
            description: cleanDesc,
            facultyId: targetFacultyId,
          });
          updatedCount++;
          courseNameToIdMap.set(cleanName, existingCourseId);
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
          courseNameToIdMap.set(cleanName, newCourse.id);
        } catch (err: any) {
          errors.push(`خطا در ایجاد درس ${cleanName} (${cleanCode}): ${err?.message || "خطای نامشخص"}`);
        }
      }
    }

    // 4. Step 2: Establish Prerequisites and Corequisites
    let allPrereqs = await getAllPrerequisites();

    for (const item of rawList) {
      const cleanCode = String(item.code || "").trim();
      const sourceCourseId = courseCodeToIdMap.get(cleanCode);
      if (!sourceCourseId) continue;

      // Process Prerequisites
      const prereqsList = Array.isArray(item.prerequisites) ? item.prerequisites : [];
      for (const reqRef of prereqsList) {
        const cleanRef = String(reqRef).trim();
        const targetCourseId = courseCodeToIdMap.get(cleanRef) || courseNameToIdMap.get(cleanRef);

        if (!targetCourseId) {
          errors.push(`پیش‌نیاز «${cleanRef}» برای درس «${item.name}» در سامانه یافت نشد.`);
          continue;
        }

        if (sourceCourseId === targetCourseId) continue;

        // Check if already exists
        const exists = allPrereqs.some(
          (p) => p.courseId === sourceCourseId && p.requiredCourseId === targetCourseId
        );

        if (!exists) {
          // Check cycle
          const causesCycle = wouldCreatePrerequisiteCycle(allPrereqs, {
            courseId: sourceCourseId,
            requiredCourseId: targetCourseId,
          });

          if (causesCycle) {
            errors.push(`هشدار: پیش‌نیاز «${cleanRef}» برای درس «${item.name}» به دلیل ایجاد چرخه اضافه نشد.`);
          } else {
            try {
              const added = await addPrerequisite({
                courseId: sourceCourseId,
                requiredCourseId: targetCourseId,
                type: "prerequisite",
              });
              allPrereqs.push(added);
              prereqsAdded++;
            } catch (err: any) {
              errors.push(`خطا در افزودن پیش‌نیاز: ${err?.message || ""}`);
            }
          }
        }
      }

      // Process Corequisites
      const coreqsList = Array.isArray(item.corequisites) ? item.corequisites : [];
      for (const reqRef of coreqsList) {
        const cleanRef = String(reqRef).trim();
        const targetCourseId = courseCodeToIdMap.get(cleanRef) || courseNameToIdMap.get(cleanRef);

        if (!targetCourseId || sourceCourseId === targetCourseId) continue;

        const exists = allPrereqs.some(
          (p) => p.courseId === sourceCourseId && p.requiredCourseId === targetCourseId && p.type === "corequisite"
        );

        if (!exists) {
          try {
            const added = await addPrerequisite({
              courseId: sourceCourseId,
              requiredCourseId: targetCourseId,
              type: "corequisite",
            });
            allPrereqs.push(added);
            prereqsAdded++;
          } catch (err: any) {
            errors.push(`خطا در افزودن هم‌نیاز: ${err?.message || ""}`);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `ورود اطلاعات انجام شد: ${createdCount} درس جدید، ${updatedCount} درس به‌روزشده، ${prereqsAdded} پیش‌نیاز/هم‌نیاز ثبت گردید.`,
      stats: {
        total: rawList.length,
        created: createdCount,
        updated: updatedCount,
        prerequisitesAdded: prereqsAdded,
        errors,
      },
    });
  } catch (error) {
    console.error("Courses import error:", error);
    return NextResponse.json({ success: false, message: "خطا در ورود دسته‌ای دروس" }, { status: 500 });
  }
}
