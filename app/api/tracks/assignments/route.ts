import { requireAdminSession } from "@/lib/auth";
import { getTrackAssignments, assignCourseToCategories, bulkAssignTrackCourses, assignCategoryCourses } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get("trackId");

    if (!trackId) {
      return Response.json({ success: false, message: "شناسه گرایش الزامی است." }, { status: 400 });
    }

    const assignments = await getTrackAssignments(trackId);
    return Response.json({ success: true, data: assignments });
  } catch (error) {
    console.error("Get track assignments error:", error);
    return Response.json({ success: false, message: "خطا در دریافت لیست انتساب‌ها" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const body = await request.json();
    const { trackId, assignments, courseId, visualCategoryId, ruleCategoryId } = body;

    if (!trackId) {
      return Response.json({ success: false, message: "شناسه گرایش الزامی است." }, { status: 400 });
    }

    // Assign courses to specific category (visual or rule)
    if (body.action === "assign_category_courses" && body.categoryId && body.type) {
      await assignCategoryCourses(
        trackId,
        body.type,
        body.categoryId,
        Array.isArray(body.courseIds) ? body.courseIds : []
      );
      const updated = await getTrackAssignments(trackId);
      return Response.json({ success: true, data: updated });
    }

    // Bulk assign
    if (Array.isArray(assignments)) {
      await bulkAssignTrackCourses(trackId, assignments);
      const updated = await getTrackAssignments(trackId);
      return Response.json({ success: true, data: updated });
    }

    // Single assign
    if (!courseId) {
      return Response.json({ success: false, message: "شناسه درس الزامی است." }, { status: 400 });
    }

    const updatedAssignment = await assignCourseToCategories(
      trackId,
      courseId,
      visualCategoryId,
      ruleCategoryId
    );

    return Response.json({ success: true, data: updatedAssignment });
  } catch (error) {
    console.error("Update track assignments error:", error);
    return Response.json({ success: false, message: "خطا در به‌روزرسانی انتساب دروس" }, { status: 500 });
  }
}
