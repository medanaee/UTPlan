import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { getTrackById, getRuleCategories, getTrackAssignments } from "@/lib/db";
import type { RuleCategory } from "@/lib/types";

interface HierarchicalCategoryNode {
  code: string;
  name: string;
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

    const categories = await getRuleCategories(trackId);
    const assignments = await getTrackAssignments(trackId);

    // Map course codes to rule categories
    const courseCodesByCatId = new Map<string, string[]>();
    for (const a of assignments) {
      if (a.ruleCategoryId && a.courseCode && a.courseCode !== "---") {
        const list = courseCodesByCatId.get(a.ruleCategoryId) || [];
        list.push(a.courseCode);
        courseCodesByCatId.set(a.ruleCategoryId, list);
      }
    }

    // Build hierarchical tree
    function buildNode(cat: RuleCategory): HierarchicalCategoryNode {
      const children = categories
        .filter((c) => c.parentId === cat.id)
        .map(buildNode);

      return {
        code: cat.code || `RCAT-${cat.id}`,
        name: cat.name,
        courses: courseCodesByCatId.get(cat.id) || [],
        children,
      };
    }

    // Identify root categories (no parent or parent not found in list)
    const rootCategories = categories.filter(
      (c) => !c.parentId || !categories.some((p) => p.id === c.parentId)
    );
    const hierarchicalData = rootCategories.map(buildNode);

    const jsonContent = JSON.stringify(hierarchicalData, null, 2);
    const dateStr = new Date().toISOString().split("T")[0];
    const safeTrackName = (track.name || "track").replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, "_");
    const filename = `rule-categories-${safeTrackName}-${dateStr}.json`;

    return new NextResponse(jsonContent, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error: any) {
    console.error("Rule categories export error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "خطا در خروجی دسته‌های قوانین" },
      { status: 500 }
    );
  }
}
