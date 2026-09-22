import { requireAdminSession } from "@/lib/auth";
import {
  getTrackAssignments,
  assignCourseToCategory,
  assignCourseToCategories,
  bulkAssignTrackCourses,
  assignCategoryCourses,
  clearCategoryCourses,
  logAdminAction,
} from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get("trackId");

    if (!trackId) {
      return Response.json({ success: false, message: "شناسه گرایش الزامی است." }, { status: 400 });
    }

    const assignments = await getTrackAssignments(trackId);
    return Response.json(
      { success: true, data: assignments },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Get track assignments error:", error);
    return Response.json({ success: false, message: "خطا در دریافت لیست انتساب‌ها" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const body: any = await request.json();
    const { trackId, assignments, courseId, visualCategoryId, ruleCategoryId } = body;

    if (!trackId) {
      return Response.json({ success: false, message: "شناسه گرایش الزامی است." }, { status: 400 });
    }

    // Unassign single course
    if (body.action === "unassign_course" && body.courseId) {
      const updatedAssignment = await assignCourseToCategory(trackId, body.courseId, null);
      await logAdminAction({
        userId: auth.user!.id,
        userName: auth.user!.name,
        userEmail: auth.user!.email,
        action: "UPDATE",
        entityType: "category",
        entityId: trackId,
        entityName: `حذف انتساب درس ${body.courseId} از دسته`,
        details: { trackId, courseId: body.courseId },
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        userAgent: request.headers.get("user-agent"),
      });
      return Response.json({ success: true, data: updatedAssignment, message: "درس با موفقیت از دسته خارج شد." });
    }

    // Clear all courses from specific category
    if (body.action === "clear_category_courses" && body.categoryId) {
      await clearCategoryCourses(trackId, body.categoryId);
      const updated = await getTrackAssignments(trackId);
      await logAdminAction({
        userId: auth.user!.id,
        userName: auth.user!.name,
        userEmail: auth.user!.email,
        action: "DELETE",
        entityType: "category",
        entityId: body.categoryId,
        entityName: `پاکسازی انتساب دروس در دسته ${body.categoryId}`,
        details: { trackId, categoryId: body.categoryId },
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        userAgent: request.headers.get("user-agent"),
      });
      return Response.json({ success: true, data: updated, message: "دروس داخل این دسته با موفقیت پاک شدند." });
    }

    // Assign courses to specific category
    if (body.action === "assign_category_courses" && body.categoryId) {
      const cIds = Array.isArray(body.courseIds) ? body.courseIds : [];
      await assignCategoryCourses(
        trackId,
        body.categoryId,
        cIds
      );
      const updated = await getTrackAssignments(trackId);
      await logAdminAction({
        userId: auth.user!.id,
        userName: auth.user!.name,
        userEmail: auth.user!.email,
        action: "UPDATE",
        entityType: "category",
        entityId: body.categoryId,
        entityName: `انتساب دسته‌ای دروس به دسته (${cIds.length} درس)`,
        details: { trackId, categoryId: body.categoryId, count: cIds.length },
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        userAgent: request.headers.get("user-agent"),
      });
      return Response.json({ success: true, data: updated });
    }

    // Bulk assign
    if (Array.isArray(assignments)) {
      await bulkAssignTrackCourses(trackId, assignments);
      const updated = await getTrackAssignments(trackId);
      await logAdminAction({
        userId: auth.user!.id,
        userName: auth.user!.name,
        userEmail: auth.user!.email,
        action: "UPDATE",
        entityType: "category",
        entityId: trackId,
        entityName: `انتساب دسته‌ای دروس گرایش (${assignments.length} انتساب)`,
        details: { trackId, count: assignments.length },
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        userAgent: request.headers.get("user-agent"),
      });
      return Response.json({ success: true, data: updated });
    }

    // Single assign
    if (!courseId) {
      return Response.json({ success: false, message: "شناسه درس الزامی است." }, { status: 400 });
    }

    const catId = body.categoryId ?? body.ruleCategoryId ?? body.visualCategoryId ?? null;
    const updatedAssignment = await assignCourseToCategory(
      trackId,
      courseId,
      catId
    );

    await logAdminAction({
      userId: auth.user!.id,
      userName: auth.user!.name,
      userEmail: auth.user!.email,
      action: "UPDATE",
      entityType: "category",
      entityId: trackId,
      entityName: `انتساب درس به دسته`,
      details: { trackId, courseId, categoryId: catId },
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    });

    return Response.json({ success: true, data: updatedAssignment });
  } catch (error) {
    console.error("Update track assignments error:", error);
    return Response.json({ success: false, message: "خطا در به‌روزرسانی انتساب دروس" }, { status: 500 });
  }
}
