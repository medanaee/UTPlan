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
  avatarUrl?: string;
  title?: string;
  email?: string;
  links?: {
    website?: string;
    scholar?: string;
    [key: string]: any;
  };
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

    // 2. Fetch professors of target faculty (including soft-deleted for seamless code reuse/restoration)
    const { results: allProfRows } = await (async () => {
      const { getD1 } = await import("@/lib/db/client");
      const d1 = getD1();
      if (!d1) return { results: [] };
      return await d1.prepare("SELECT * FROM professors WHERE faculty_id = ?").bind(targetFacultyId).all();
    })();

    // Code is the ONLY matching criterion
    const profCodeMap = new Map<string, any>(); // code -> prof

    (allProfRows || []).forEach((p: any) => {
      if (p.code) profCodeMap.set(p.code.trim().toUpperCase(), p);
    });

    let createdCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    // 3. Process each professor item
    for (const item of rawList) {
      // 3.1 Code is Mandatory and Sole Matching Key
      const cleanCode = item.code ? String(item.code).trim().toUpperCase() : "";
      if (!cleanCode) {
        errors.push(`ردیف بدون کد شناسایی استاد رد شد: ${JSON.stringify(item)}`);
        continue;
      }

      // 3.2 First Name and Last Name are Mandatory
      const rawFirstName = (item.firstName || "").trim();
      const rawLastName = (item.lastName || "").trim();
      if (!rawFirstName || !rawLastName) {
        errors.push(`استاد با کد «${cleanCode}» به دلیل عدم درج نام یا نام خانوادگی رد شد.`);
        continue;
      }
      const rawFullName = item.name?.trim() || `${rawFirstName} ${rawLastName}`;

      // 3.3 Optional avatarUrl
      const cleanAvatarUrl = item.avatarUrl && typeof item.avatarUrl === "string" && item.avatarUrl.trim()
        ? item.avatarUrl.trim()
        : undefined;

      // 3.4 Title: optional, default to "استاد تمام"
      const cleanTitle = (item.title && typeof item.title === "string" && item.title.trim())
        ? item.title.trim()
        : "استاد تمام";

      // 3.5 Optional email
      const cleanEmail = (item.email && typeof item.email === "string")
        ? item.email.trim().toLowerCase()
        : "";

      // 3.6 Links: optional, strictly allowed keys ["website", "scholar"]
      let cleanLinks: Record<string, string> | undefined = undefined;
      if (item.links && typeof item.links === "object") {
        const filteredLinks: Record<string, string> = {};
        if (item.links.website && typeof item.links.website === "string" && item.links.website.trim()) {
          filteredLinks.website = item.links.website.trim();
        }
        if (item.links.scholar && typeof item.links.scholar === "string" && item.links.scholar.trim()) {
          filteredLinks.scholar = item.links.scholar.trim();
        }
        if (Object.keys(filteredLinks).length > 0) {
          cleanLinks = filteredLinks;
        }
      }

      // 3.7 Matching strictly by Code
      const existingMatch = profCodeMap.get(cleanCode);

      if (existingMatch) {
        // Update existing professor (and restore if previously soft-deleted)
        try {
          await updateProfessor(existingMatch.id, {
            facultyId: targetFacultyId,
            code: cleanCode,
            firstName: rawFirstName,
            lastName: rawLastName,
            name: rawFullName,
            avatarUrl: cleanAvatarUrl !== undefined ? cleanAvatarUrl : (existingMatch.avatar_url || existingMatch.avatarUrl),
            title: cleanTitle,
            email: cleanEmail || existingMatch.email || "",
            links: cleanLinks !== undefined ? cleanLinks : existingMatch.links,
            deletedAt: null,
          });
          updatedCount++;
        } catch (err: any) {
          errors.push(`خطا در ویرایش استاد ${rawFullName} (${cleanCode}): ${err?.message || "خطای نامشخص"}`);
        }
      } else {
        // Create new professor
        try {
          const newProf = await createProfessor({
            id: item.id?.trim(),
            facultyId: targetFacultyId,
            code: cleanCode,
            firstName: rawFirstName,
            lastName: rawLastName,
            name: rawFullName,
            avatarUrl: cleanAvatarUrl,
            title: cleanTitle,
            email: cleanEmail,
            links: cleanLinks,
          });

          createdCount++;
          profCodeMap.set(cleanCode, newProf);
        } catch (err: any) {
          errors.push(`خطا در ایجاد استاد ${rawFullName} (${cleanCode}): ${err?.message || "خطای نامشخص"}`);
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
