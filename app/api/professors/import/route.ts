import { NextRequest, NextResponse } from "next/server";
import {
  getProfessors,
  getFaculties,
  createProfessor,
  updateProfessor,
  deleteProfessorsByFaculty,
} from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

interface ImportProfessorItem {
  id?: string;
  code?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  title?: string;
  email?: string;
  links?: Record<string, string>;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const { searchParams } = new URL(request.url);
    const queryFacultyId = searchParams.get("facultyId");
    const queryMode = searchParams.get("mode");

    const body = await request.json();
    let rawList: ImportProfessorItem[] = [];
    let targetFacultyId = queryFacultyId || undefined;
    let mode = (queryMode || (body && typeof body === "object" ? body.mode : null) || "append") as "append" | "replace";

    if (Array.isArray(body)) {
      rawList = body;
    } else if (body && typeof body === "object") {
      rawList = Array.isArray(body.professors) ? body.professors : [];
      if (body.facultyId) {
        targetFacultyId = body.facultyId;
      }
    }

    if (!Array.isArray(rawList) || rawList.length === 0) {
      return NextResponse.json(
        { success: false, message: "لیست اساتید ارسالی خالی یا نامعتبر است." },
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

    // If Mode is "replace", wipe all existing professors in this faculty first
    if (mode === "replace") {
      await deleteProfessorsByFaculty(targetFacultyId);
    }

    // 2. Fetch current professors
    const currentProfs = await getProfessors(targetFacultyId);

    const profCodeMap = new Map<string, typeof currentProfs[0]>(); // code -> prof
    const profNameMap = new Map<string, typeof currentProfs[0]>(); // name -> prof
    const profEmailMap = new Map<string, typeof currentProfs[0]>(); // email -> prof

    currentProfs.forEach((p) => {
      if (p.code) profCodeMap.set(p.code.trim().toUpperCase(), p);
      if (p.name) profNameMap.set(p.name.trim().toLowerCase(), p);
      const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ").trim().toLowerCase();
      if (fullName) profNameMap.set(fullName, p);
      if (p.email) profEmailMap.set(p.email.trim().toLowerCase(), p);
    });

    let createdCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    // 3. Process each professor item
    for (const item of rawList) {
      const rawFirstName = (item.firstName || "").trim();
      const rawLastName = (item.lastName || "").trim();
      const rawFullName = item.name?.trim() || [rawFirstName, rawLastName].filter(Boolean).join(" ");

      if (!rawFirstName && !rawLastName && !rawFullName) {
        errors.push(`سطر بدون نام یا نام خانوادگی رد شد: ${JSON.stringify(item)}`);
        continue;
      }

      const cleanCode = item.code ? String(item.code).trim().toUpperCase() : null;
      const cleanEmail = item.email ? String(item.email).trim().toLowerCase() : "";
      const cleanTitle = item.title?.trim() || "استاد تمام";
      const cleanLinks = item.links || {};

      let existingMatch = null;

      // Match Strategy:
      // A. If code is provided, match by code
      if (cleanCode && profCodeMap.has(cleanCode)) {
        existingMatch = profCodeMap.get(cleanCode);
      }
      // B. If no match by code, match by full name or email
      if (!existingMatch && rawFullName && profNameMap.has(rawFullName.toLowerCase())) {
        existingMatch = profNameMap.get(rawFullName.toLowerCase());
      }
      if (!existingMatch && cleanEmail && profEmailMap.has(cleanEmail)) {
        existingMatch = profEmailMap.get(cleanEmail);
      }

      if (existingMatch) {
        // Update existing professor
        try {
          await updateProfessor(existingMatch.id, {
            facultyId: targetFacultyId,
            code: cleanCode || existingMatch.code,
            firstName: rawFirstName || existingMatch.firstName,
            lastName: rawLastName || existingMatch.lastName,
            name: rawFullName || existingMatch.name,
            title: cleanTitle,
            email: cleanEmail || existingMatch.email,
            links: cleanLinks,
          });
          updatedCount++;
        } catch (err: any) {
          errors.push(`خطا در ویرایش استاد ${rawFullName}: ${err?.message || "خطای نامشخص"}`);
        }
      } else {
        // Create new professor
        try {
          const newProf = await createProfessor({
            id: item.id?.trim(),
            facultyId: targetFacultyId,
            code: cleanCode || undefined,
            firstName: rawFirstName,
            lastName: rawLastName,
            name: rawFullName,
            title: cleanTitle,
            email: cleanEmail,
            links: cleanLinks,
          });

          createdCount++;
          if (newProf.code) profCodeMap.set(newProf.code.trim().toUpperCase(), newProf);
          if (newProf.name) profNameMap.set(newProf.name.trim().toLowerCase(), newProf);
          if (newProf.email) profEmailMap.set(newProf.email.trim().toLowerCase(), newProf);
        } catch (err: any) {
          errors.push(`خطا در ایجاد استاد ${rawFullName}: ${err?.message || "خطای نامشخص"}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `عملیات با موفقیت انجام شد: ${createdCount} استاد جدید افزوده و ${updatedCount} استاد به‌روزرسانی شدند.`,
      stats: {
        total: rawList.length,
        created: createdCount,
        updated: updatedCount,
        errors,
      },
    });
  } catch (error: any) {
    console.error("Professors Import error:", error);
    return NextResponse.json(
      { success: false, message: "خطای سرور در ورود اطلاعات اساتید: " + (error?.message || "نامشخص") },
      { status: 500 }
    );
  }
}
