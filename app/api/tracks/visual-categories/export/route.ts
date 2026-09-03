import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { getTrackById, getVisualCategories, getTrackAssignments } from "@/lib/db";

interface VisualCategoryExportNode {
  code: string;
  name: string;
  color?: string;
  courses: string[];
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

    const categories = await getVisualCategories(trackId);
    const assignments = await getTrackAssignments(trackId);

    // Map course codes to visual categories
    const courseCodesByCatId = new Map<string, string[]>();
    for (const a of assignments) {
      if (a.visualCategoryId && a.courseCode && a.courseCode !== "---") {
        const list = courseCodesByCatId.get(a.visualCategoryId) || [];
        list.push(a.courseCode);
        courseCodesByCatId.set(a.visualCategoryId, list);
      }
    }

    // Build flat visual categories list
    const exportData: VisualCategoryExportNode[] = categories.map((cat) => ({
      code: cat.code || `VCAT-${cat.id}`,
      name: cat.name,
      color: cat.color || "#3b82f6",
      courses: courseCodesByCatId.get(cat.id) || [],
    }));

    const jsonContent = JSON.stringify(exportData, null, 2);
    const dateStr = new Date().toISOString().split("T")[0];
    const safeTrackName = (track.name || "track").replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, "_");
    const filename = `visual-categories-${safeTrackName}-${dateStr}.json`;

    return new NextResponse(jsonContent, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error: any) {
    console.error("Visual categories export error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "خطا در خروجی دسته‌های بصری" },
      { status: 500 }
    );
  }
}
