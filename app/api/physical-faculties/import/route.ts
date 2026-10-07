import { apiResponseJson, withApiTiming } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import {
  getPhysicalFaculties,
  createPhysicalFaculty,
  updatePhysicalFaculty,
  deletePhysicalFaculty,
  getD1,
  logAdminAction,
} from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

interface ImportPhysicalFacultyItem {
  name: string;
  code?: string;
  imageUrl?: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  description?: string;
}

async function POSTHandler(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const { searchParams } = new URL(request.url);
    const queryMode = searchParams.get("mode");

    const body: any = await request.json();
    let rawList: ImportPhysicalFacultyItem[] = [];
    let mode = (queryMode || (body && typeof body === "object" ? body.mode : null) || "append") as
      | "append"
      | "replace";

    if (Array.isArray(body)) {
      rawList = body;
    } else if (body && typeof body === "object") {
      rawList = Array.isArray(body.physicalFaculties)
        ? body.physicalFaculties
        : Array.isArray(body.data)
        ? body.data
        : [];
    }

    if (!Array.isArray(rawList) || rawList.length === 0) {
      return apiResponseJson(
        { success: false, message: "لیست ارسالی دانشکده‌ها خالی یا نامعتبر است." },
        { status: 400 }
      );
    }

    const d1 = getD1();
    if (!d1) {
      return apiResponseJson(
        { success: false, message: "پایگاه داده در دسترس نیست." },
        { status: 500 }
      );
    }

    // Existing active physical faculties
    const existingList = await getPhysicalFaculties(false);
    const codeMap = new Map<string, (typeof existingList)[0]>();
    existingList.forEach((f) => {
      if (f.code) codeMap.set(f.code.toLowerCase().trim(), f);
    });

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: { index: number; name?: string; message: string }[] = [];

    // If replace mode, soft delete all existing records first
    if (mode === "replace") {
      for (const item of existingList) {
        await deletePhysicalFaculty(item.id, false);
      }
      codeMap.clear();
    }

    for (let i = 0; i < rawList.length; i++) {
      const item = rawList[i];
      if (!item || typeof item !== "object") {
        skippedCount++;
        continue;
      }

      const name = item.name ? String(item.name).trim() : "";
      if (!name) {
        errors.push({ index: i, message: "نام دانشکده الزامی است." });
        skippedCount++;
        continue;
      }

      const code = item.code ? String(item.code).trim() : undefined;
      const imageUrl = item.imageUrl ? String(item.imageUrl).trim() : undefined;
      const lat = item.latitude !== undefined && item.latitude !== null && !isNaN(Number(item.latitude))
        ? Number(item.latitude)
        : null;
      const lon = item.longitude !== undefined && item.longitude !== null && !isNaN(Number(item.longitude))
        ? Number(item.longitude)
        : null;
      const address = item.address ? String(item.address).trim() : undefined;
      const description = item.description ? String(item.description).trim() : undefined;

      try {
        if (code && codeMap.has(code.toLowerCase())) {
          const existing = codeMap.get(code.toLowerCase())!;
          await updatePhysicalFaculty(existing.id, {
            name,
            code,
            imageUrl,
            latitude: lat,
            longitude: lon,
            address,
            description,
          });
          updatedCount++;
        } else {
          const created = await createPhysicalFaculty({
            name,
            code,
            imageUrl,
            latitude: lat,
            longitude: lon,
            address,
            description,
          });
          if (created.code) {
            codeMap.set(created.code.toLowerCase(), created);
          }
          insertedCount++;
        }
      } catch (err: any) {
        errors.push({ index: i, name, message: err.message || "خطای ناشناخته در ورود" });
        skippedCount++;
      }
    }

    if (auth.user) {
      await logAdminAction({
        userId: auth.user.id,
        userName: auth.user.name,
        userEmail: auth.user.email,
        action: "IMPORT",
        entityType: "physical_faculty",
        entityName: "ورود دسته‌ای دانشکده‌های فیزیکی",
        details: `ورود ${rawList.length} دانشکده فیزیکی (افزوده: ${insertedCount}، به‌روزرسانی: ${updatedCount}، صرف‌نظر: ${skippedCount}) با حالت ${mode}`,
      });
    }

    return apiResponseJson({
      success: true,
      message: `عملیات ورود با موفقیت انجام شد: ${insertedCount} افزوده شد، ${updatedCount} به‌روزرسانی شد.`,
      stats: {
        total: rawList.length,
        inserted: insertedCount,
        updated: updatedCount,
        skipped: skippedCount,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Physical faculties import error:", error);
    return apiResponseJson(
      { success: false, message: error?.message || "خطا در پردازش فایل ورود دانشکده‌های فیزیکی" },
      { status: 500 }
    );
  }
}

export const POST = withApiTiming(POSTHandler);
