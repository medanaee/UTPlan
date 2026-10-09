import { apiResponseJson, withApiTiming } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth";
import {
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  deleteCoursesByFaculty,
  addPrerequisite,
  removePrerequisite,
  getAllPrerequisites,
  logAdminAction,
  buildDiff,
} from "@/lib/db";
import { wouldCreatePrerequisiteCycle } from "@/lib/graph-utils";

async function GETHandler(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const facultyId = searchParams.get("facultyId") || undefined;
    const trackId = searchParams.get("trackId") || undefined;
    const courseId = searchParams.get("id");

    if (courseId) {
      const course = await getCourseById(courseId);
      if (!course) {
        return apiResponseJson({ success: false, message: "درس یافت نشد." }, { status: 404 });
      }
      return apiResponseJson(
        { success: true, data: course },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    const directOnly = searchParams.get("directOnly") === "true";
    const search = searchParams.get("q")?.trim() || undefined;
    const limitParam = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;
    const courses = await getCourses(facultyId, trackId, directOnly, search, limit);
    return apiResponseJson(
      { success: true, data: courses },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Get courses error:", error);
    return apiResponseJson({ success: false, message: "خطا در دریافت لیست دروس" }, { status: 500 });
  }
}

export const GET = withApiTiming(GETHandler);

async function POSTHandler(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const body: any = await request.json();
    const {
      facultyId,
      name,
      code,
      degreeLevel,
      abbreviation,
      units,
      offeredIn,
      description,
      trackId,
      visualCategoryId,
      ruleCategoryId,
    } = body;

    if (!facultyId || !name) {
      return apiResponseJson({ success: false, message: "دانشکده و نام درس الزامی است." }, { status: 400 });
    }

    const newCourse = await createCourse({
      facultyId,
      name,
      code: code ? String(code).trim() : undefined,
      degreeLevel,
      abbreviation,
      units: Number(units) || 3,
      offeredIn,
      description,
      trackId,
      visualCategoryId,
      ruleCategoryId,
    });

    await logAdminAction({
      userId: auth.user!.id,
      userName: auth.user!.name,
      userEmail: auth.user!.email,
      action: "CREATE",
      entityType: "course",
      entityId: newCourse.id,
      entityName: newCourse.name,
      details: { code: newCourse.code, units: newCourse.units },
    });

    return apiResponseJson({ success: true, data: newCourse }, { status: 201 });
  } catch (error: any) {
    console.error("Create course error:", error);
    const isConflict = error?.message?.includes("تکراری");
    return apiResponseJson(
      { success: false, message: error?.message || "خطا در ایجاد درس" },
      { status: isConflict ? 409 : 500 }
    );
  }
}

export const POST = withApiTiming(POSTHandler);

async function PUTHandler(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const body: any = await request.json();
    const { action, id, courseId, requiredCourseId, type, ...updateData } = body;

    // Sub-action: Add Prerequisite with Cycle Detection
    if (action === "add_prerequisite") {
      if (!courseId || !requiredCourseId) {
        return apiResponseJson({ success: false, message: "شناسه هر دو درس الزامی است." }, { status: 400 });
      }

      if (courseId === requiredCourseId) {
        return apiResponseJson({ success: false, message: "یک درس نمی‌تواند پیش‌نیاز خودش باشد!" }, { status: 400 });
      }

      // Check for cycles in prerequisites graph
      const existingPrereqs = await getAllPrerequisites();
      const causesCycle = wouldCreatePrerequisiteCycle(existingPrereqs, {
        courseId,
        requiredCourseId,
        type: type || "prerequisite",
      });

      if (causesCycle) {
        return apiResponseJson(
          {
            success: false,
            message: "خطای چرخه: افزودن این پیش‌نیاز باعث ایجاد چرخه و وابستگی دوری بین دروس می‌شود!",
          },
          { status: 409 }
        );
      }

      const relation = await addPrerequisite(courseId, requiredCourseId, type || "prerequisite");
      return apiResponseJson({ success: true, data: relation });
    }

    // Sub-action: Remove Prerequisite
    if (action === "remove_prerequisite") {
      const { relationId } = body;
      if (!relationId) {
        return apiResponseJson({ success: false, message: "شناسه رابطه الزامی است." }, { status: 400 });
      }
      const success = await removePrerequisite(relationId);
      return apiResponseJson({ success });
    }

    // General Course Update
    if (!id) {
      return apiResponseJson({ success: false, message: "شناسه درس الزامی است." }, { status: 400 });
    }

    const existing = await getCourseById(id);
    const updated = await updateCourse(id, updateData);
    if (!updated) {
      return apiResponseJson({ success: false, message: "درس مورد نظر یافت نشد." }, { status: 404 });
    }

    const diff = existing
      ? buildDiff(existing, updated, [
          "name",
          "code",
          "abbreviation",
          "units",
          "degreeLevel",
          "facultyId",
          "offeredIn",
          "description",
        ])
      : { changedFields: Object.keys(updateData), changes: {} };

    await logAdminAction({
      userId: auth.user!.id,
      userName: auth.user!.name,
      userEmail: auth.user!.email,
      action: "UPDATE",
      entityType: "course",
      entityId: updated.id,
      entityName: updated.name,
      details: {
        code: updated.code,
        ...diff,
      },
    });

    return apiResponseJson({ success: true, data: updated });
  } catch (error: any) {
    console.error("Update course error:", error);
    const isConflict = error?.message?.includes("تکراری");
    return apiResponseJson(
      { success: false, message: error?.message || "خطا در به‌روزرسانی درس" },
      { status: isConflict ? 409 : 500 }
    );
  }
}

export const PUT = withApiTiming(PUTHandler);

async function DELETEHandler(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const facultyId = searchParams.get("facultyId");
    const all = searchParams.get("all") === "true";

    if (all && facultyId) {
      const success = await deleteCoursesByFaculty(facultyId);
      await logAdminAction({
        userId: auth.user!.id,
        userName: auth.user!.name,
        userEmail: auth.user!.email,
        action: "DELETE",
        entityType: "course",
        details: { facultyId, all: true },
      });
      return apiResponseJson({ success, message: "کلیه دروس دانشکده حذف شدند." });
    }

    if (!id) {
      return apiResponseJson({ success: false, message: "شناسه درس الزامی است." }, { status: 400 });
    }

    const courseBefore = await getCourseById(id);
    const success = await deleteCourse(id);
    if (success) {
      await logAdminAction({
        userId: auth.user!.id,
        userName: auth.user!.name,
        userEmail: auth.user!.email,
        action: "DELETE",
        entityType: "course",
        entityId: id,
        entityName: courseBefore?.name || id,
      });
    }

    return apiResponseJson({ success });
  } catch (error) {
    console.error("Delete course error:", error);
    return apiResponseJson({ success: false, message: "خطا در حذف درس" }, { status: 500 });
  }
}

export const DELETE = withApiTiming(DELETEHandler);
