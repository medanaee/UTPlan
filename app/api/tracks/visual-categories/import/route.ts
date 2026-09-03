import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import {
  getTrackById,
  getVisualCategories,
  createVisualCategory,
  updateVisualCategory,
  assignCategoryCourses,
  getCourses,
} from "@/lib/db";
import type { VisualCategory } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;

    const body = await request.json();
    const { trackId, categories } = body;

    if (!trackId) {
      return NextResponse.json(
        { success: false, message: "شناسه گرایش (trackId) الزامی است." },
        { status: 400 }
      );
    }

    const track = await getTrackById(trackId);
    if (!track) {
      return NextResponse.json(
        { success: false, message: "گرایش مورد نظر یافت نشد." },
        { status: 404 }
      );
    }

    if (!Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json(
        { success: false, message: "داده‌های ورودی باید یک آرایه شامل حداقل یک دسته بصری باشند." },
        { status: 400 }
      );
    }

    // 1. Validation
    const categoryCodes = new Set<string>();
    const validationErrors: string[] = [];

    categories.forEach((cat: any, idx: number) => {
      const path = cat?.name || `دسته ${idx + 1}`;
      if (!cat || typeof cat !== "object") {
        validationErrors.push(`ردیف ${idx + 1} ساختار شیء معتبر ندارد.`);
        return;
      }

      if (typeof cat.code !== "string" || !cat.code.trim()) {
        validationErrors.push(`کد دسته در «${path}» الزامی است.`);
      } else {
        const cleanCode = cat.code.trim().toUpperCase();
        if (categoryCodes.has(cleanCode)) {
          validationErrors.push(`کد دسته «${cleanCode}» در فایل ورودی تکراری است.`);
        } else {
          categoryCodes.add(cleanCode);
        }
      }

      if (typeof cat.name !== "string" || !cat.name.trim()) {
        validationErrors.push(`نام دسته در «${path}» الزامی است.`);
      }

      const courses = cat.courses ?? cat.courseCodes;
      if (courses !== undefined && !Array.isArray(courses)) {
        validationErrors.push(`لیست دروس در دسته «${path}» باید آرایه‌ای از کدهای دروس باشد.`);
      }
    });

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `خطا در اعتبارسنجی ساختار JSON: ${validationErrors[0]}`,
          errors: validationErrors,
        },
        { status: 400 }
      );
    }

    // 2. Fetch all courses in database to map course.code -> course.id
    const allCourses = await getCourses();
    const courseMapByCode = new Map<string, string>();
    for (const c of allCourses) {
      if (c.code) {
        courseMapByCode.set(c.code.trim(), c.id);
      }
    }

    // 3. Fetch existing visual categories for this track
    const existingCats = await getVisualCategories(trackId);
    const existingByCode = new Map<string, VisualCategory>();
    for (const cat of existingCats) {
      if (cat.code) {
        existingByCode.set(cat.code.trim().toUpperCase(), cat);
      }
    }

    // 4. Execution (Merge Strategy)
    const stats = {
      categoriesCreated: 0,
      categoriesUpdated: 0,
      coursesAssigned: 0,
      warnings: [] as string[],
    };

    for (let i = 0; i < categories.length; i++) {
      const node = categories[i];
      const cleanCode = node.code.trim().toUpperCase();
      const cleanName = node.name.trim();
      const color = node.color?.trim() || "#3b82f6";
      const sortOrder = i + 1;

      let categoryId: string;
      const existing = existingByCode.get(cleanCode);

      if (existing) {
        await updateVisualCategory(existing.id, {
          name: cleanName,
          color,
          sortOrder,
          code: cleanCode,
        });
        categoryId = existing.id;
        stats.categoriesUpdated++;
      } else {
        const created = await createVisualCategory({
          trackId,
          name: cleanName,
          color,
          sortOrder,
          code: cleanCode,
        });
        categoryId = created.id;
        existingByCode.set(cleanCode, created);
        stats.categoriesCreated++;
      }

      // Assign courses if specified
      const courses = node.courses ?? node.courseCodes;
      if (Array.isArray(courses) && courses.length > 0) {
        const courseIdsToAssign: string[] = [];
        for (const rawCode of courses) {
          const codeStr = String(rawCode).trim();
          const courseId = courseMapByCode.get(codeStr);
          if (courseId) {
            courseIdsToAssign.push(courseId);
          } else {
            stats.warnings.push(
              `درس با کد «${codeStr}» برای دسته بصری «${cleanName}» در سیستم یافت نشد و نادیده گرفته شد.`
            );
          }
        }

        if (courseIdsToAssign.length > 0) {
          await assignCategoryCourses(trackId, "visual", categoryId, courseIdsToAssign);
          stats.coursesAssigned += courseIdsToAssign.length;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `واردسازی دسته‌های بصری با موفقیت انجام شد: ${stats.categoriesCreated} دسته ایجاد، ${stats.categoriesUpdated} دسته بروزرسانی و ${stats.coursesAssigned} درس منتسب گردیدند.`,
      stats,
    });
  } catch (error: any) {
    console.error("Visual categories import error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "خطا در واردسازی دسته‌های بصری" },
      { status: 500 }
    );
  }
}
