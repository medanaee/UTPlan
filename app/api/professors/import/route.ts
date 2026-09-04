import { NextRequest, NextResponse } from "next/server";
import {
  getFaculties,
  getD1,
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

    // 2. Fetch professors of target faculty (including soft-deleted for seamless code reuse/restoration)
    const { results: allProfRows } = await d1
      .prepare("SELECT * FROM professors WHERE faculty_id = ?")
      .bind(targetFacultyId)
      .all();

    // Code is the ONLY matching criterion
    const profCodeMap = new Map<string, any>(); // code -> prof

    (allProfRows || []).forEach((p: any) => {
      if (p.code) profCodeMap.set(p.code.trim().toUpperCase(), p);
    });

    let createdCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    function chunkArray<T>(items: T[], size: number): T[][] {
      const chunks: T[][] = [];
      for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
      }
      return chunks;
    }

    const stmts: any[] = [];
    const now = new Date().toISOString();

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
        : null;

      // 3.4 Title: optional, default to "استاد تمام"
      const cleanTitle = (item.title && typeof item.title === "string" && item.title.trim())
        ? item.title.trim()
        : "استاد تمام";

      // 3.5 Optional email
      const cleanEmail = (item.email && typeof item.email === "string")
        ? item.email.trim().toLowerCase()
        : "";

      // 3.6 Links: optional, strictly allowed keys ["website", "scholar"]
      let cleanLinks: Record<string, string> | null = null;
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
      const linksStr = cleanLinks ? JSON.stringify(cleanLinks) : null;

      // 3.7 Matching strictly by Code
      const existingMatch = profCodeMap.get(cleanCode);

      if (existingMatch) {
        // Update existing professor (and restore if previously soft-deleted)
        stmts.push(
          d1.prepare(`
            UPDATE professors
            SET faculty_id = ?, first_name = ?, last_name = ?, title = ?, email = ?, avatar_url = COALESCE(?, avatar_url), links = COALESCE(?, links), deleted_at = NULL
            WHERE id = ?
          `).bind(
            targetFacultyId,
            rawFirstName,
            rawLastName,
            cleanTitle,
            cleanEmail || existingMatch.email || "",
            cleanAvatarUrl,
            linksStr,
            existingMatch.id
          )
        );
        updatedCount++;
      } else {
        // Create new professor
        const id = item.id?.trim() || `prf_${crypto.randomUUID().slice(0, 8)}`;
        stmts.push(
          d1.prepare(`
            INSERT INTO professors (id, code, faculty_id, first_name, last_name, title, email, avatar_url, links, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            id,
            cleanCode,
            targetFacultyId,
            rawFirstName,
            rawLastName,
            cleanTitle,
            cleanEmail,
            cleanAvatarUrl,
            linksStr,
            now
          )
        );
        createdCount++;
        profCodeMap.set(cleanCode, { id, code: cleanCode, email: cleanEmail });
      }
    }

    if (stmts.length > 0) {
      for (const bChunk of chunkArray(stmts, 50)) {
        await d1.batch(bChunk);
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
