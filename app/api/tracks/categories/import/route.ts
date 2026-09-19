import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import {
  getTrackById,
  getCategories,
  createCategory,
  updateCategory,
  assignCategoryCourses,
  getCourses,
  logAdminAction,
} from "@/lib/db";
import type { Category } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;

    const body: any = await request.json();
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
        { success: false, message: "داده‌های ورودی باید یک آرایه شامل حداقل یک دسته باشند." },
        { status: 400 }
      );
    }

    // 1. Recursive Structural Validation (Arbitrary depth supported)
    const categoryCodes = new Set<string>();
    const validationErrors: string[] = [];

    function validateNode(node: any, path: string, depth: number) {
      if (!node || typeof node !== "object") {
        validationErrors.push(`گره در مسیر «${path}» ساختار شیء معتبر ندارد.`);
        return;
      }
      if (typeof node.code !== "string" || !node.code.trim()) {
        validationErrors.push(`کد دسته در مسیر «${path}» الزامی است.`);
      } else {
        const cleanCode = node.code.trim().toUpperCase();
        if (categoryCodes.has(cleanCode)) {
          validationErrors.push(`کد دسته «${cleanCode}» در فایل ورودی تکراری است.`);
        } else {
          categoryCodes.add(cleanCode);
        }
      }

      if (typeof node.name !== "string" || !node.name.trim()) {
        validationErrors.push(`نام دسته در مسیر «${path}» الزامی است.`);
      }

      const courses = node.courses ?? node.courseCodes;
      if (courses !== undefined && !Array.isArray(courses)) {
        validationErrors.push(`لیست دروس در دسته «${node.name || path}» باید آرایه‌ای از کدهای دروس باشد.`);
      }

      const children = node.children ?? node.subcategories;
      if (children !== undefined) {
        if (!Array.isArray(children)) {
          validationErrors.push(`زیردسته‌های دسته «${node.name || path}» باید آرایه باشند.`);
        } else {
          children.forEach((child: any, idx: number) => {
            validateNode(child, `${path} > ${child.name || idx + 1}`, depth + 1);
          });
        }
      }
    }

    categories.forEach((cat: any, idx: number) => {
      validateNode(cat, cat.name || `ریشه ${idx + 1}`, 1);
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

    // 3. Fetch existing categories for this track
    const existingCats = await getCategories(trackId);
    const existingByCode = new Map<string, Category>();
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

    async function processCategory(node: any, parentId: string | null, sortOrder: number) {
      const cleanCode = node.code.trim().toUpperCase();
      const cleanName = node.name.trim();
      const color = typeof node.color === "string" && node.color.trim() ? node.color.trim() : "#3b82f6";

      let categoryId: string;
      const existing = existingByCode.get(cleanCode);

      if (existing) {
        await updateCategory(existing.id, {
          name: cleanName,
          color: typeof node.color === "string" ? color : existing.color,
          parentId,
          sortOrder,
          code: cleanCode,
        });
        categoryId = existing.id;
        stats.categoriesUpdated++;
      } else {
        const created = await createCategory({
          trackId,
          name: cleanName,
          color,
          parentId,
          sortOrder,
          code: cleanCode,
        });
        categoryId = created.id;
        existingByCode.set(cleanCode, created);
        stats.categoriesCreated++;
      }

      // Assign Courses
      const coursesList = Array.isArray(node.courses)
        ? node.courses
        : Array.isArray(node.courseCodes)
        ? node.courseCodes
        : [];

      if (coursesList.length > 0) {
        const validCourseIds: string[] = [];
        for (const cCode of coursesList) {
          if (typeof cCode === "string" && cCode.trim()) {
            const trimmedCode = cCode.trim();
            const cId = courseMapByCode.get(trimmedCode);
            if (cId) {
              if (!validCourseIds.includes(cId)) {
                validCourseIds.push(cId);
              }
            } else {
              stats.warnings.push(
                `درس با کد «${trimmedCode}» در دسته «${cleanName}» یافت نشد و نادیده گرفته شد.`
              );
            }
          }
        }

        if (validCourseIds.length > 0) {
          await assignCategoryCourses(trackId, categoryId, validCourseIds);
          stats.coursesAssigned += validCourseIds.length;
        }
      }

      // Process children recursively
      const childrenList = Array.isArray(node.children)
        ? node.children
        : Array.isArray(node.subcategories)
        ? node.subcategories
        : [];

      for (let i = 0; i < childrenList.length; i++) {
        await processCategory(childrenList[i], categoryId, i + 1);
      }
    }

    // Process top-level root categories
    for (let i = 0; i < categories.length; i++) {
      await processCategory(categories[i], null, i + 1);
    }

    await logAdminAction({
      userId: auth.user!.id,
      userName: auth.user!.name,
      userEmail: auth.user!.email,
      action: "IMPORT",
      entityType: "category",
      entityId: trackId,
      entityName: `ورود دسته‌بندی‌های گرایش ${track.name} (${stats.categoriesCreated} ایجاد، ${stats.categoriesUpdated} ویرایش)`,
      details: {
        trackId,
        trackName: track.name,
        stats,
      },
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({
      success: true,
      message: `ورود دسته‌ها با موفقیت انجام شد (${stats.categoriesCreated} ایجاد، ${stats.categoriesUpdated} به‌روزرسانی).`,
      stats,
    });
  } catch (error: any) {
    console.error("Categories import error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "خطا در پردازش و ورود دسته‌ها" },
      { status: 500 }
    );
  }
}
