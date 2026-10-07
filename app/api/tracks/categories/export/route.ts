import { apiResponseJson } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { getTrackById, getCategories, getTrackAssignments } from "@/lib/db";
import type { Category } from "@/lib/types";

interface HierarchicalCategoryNode {
  code: string;
  name: string;
  color: string;
  courses: string[];
  children: HierarchicalCategoryNode[];
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;

    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get("trackId");

    if (!trackId) {
      return apiResponseJson(
        { success: false, message: "شناسه گرایش (trackId) الزامی است." },
        { status: 400 }
      );
    }

    const track = await getTrackById(trackId);
    if (!track) {
      return apiResponseJson(
        { success: false, message: "گرایش مورد نظر یافت نشد." },
        { status: 404 }
      );
    }

    const categories = await getCategories(trackId);
    const assignments = await getTrackAssignments(trackId);

    // Map course codes to categories
    const courseCodesByCatId = new Map<string, string[]>();
    for (const a of assignments) {
      const catId = a.categoryId || a.ruleCategoryId || a.visualCategoryId;
      if (catId && a.courseCode && a.courseCode !== "---") {
        const list = courseCodesByCatId.get(catId) || [];
        list.push(a.courseCode);
        courseCodesByCatId.set(catId, list);
      }
    }

    // Build hierarchical tree with arbitrary depth
    function buildNode(cat: Category): HierarchicalCategoryNode {
      const children = categories
        .filter((c) => c.parentId === cat.id)
        .map(buildNode);

      return {
        code: cat.code || `CAT-${cat.id}`,
        name: cat.name,
        color: cat.color || "#3b82f6",
        courses: courseCodesByCatId.get(cat.id) || [],
        children,
      };
    }

    // Identify root categories
    const rootCategories = categories.filter(
      (c) => !c.parentId || !categories.some((p) => p.id === c.parentId)
    );
    const hierarchicalData = rootCategories.map(buildNode);

    const jsonContent = JSON.stringify(hierarchicalData, null, 2);
    const dateStr = new Date().toISOString().split("T")[0];
    const safeTrackName = (track.name || "track").replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, "_");
    const filename = `categories-${safeTrackName}-${dateStr}.json`;

    return new NextResponse(jsonContent, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error: any) {
    console.error("Categories export error:", error);
    return apiResponseJson(
      { success: false, message: error?.message || "خطا در خروجی دسته‌ها" },
      { status: 500 }
    );
  }
}
