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
} from "@/lib/db";
import { wouldCreatePrerequisiteCycle } from "@/lib/graph-utils";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const facultyId = searchParams.get("facultyId") || undefined;
    const trackId = searchParams.get("trackId") || undefined;
    const courseId = searchParams.get("id");

    if (courseId) {
      const course = await getCourseById(courseId);
      if (!course) {
        return Response.json({ success: false, message: "درس یافت نشد." }, { status: 404 });
      }
      return Response.json({ success: true, data: course });
    }

    const directOnly = searchParams.get("directOnly") === "true";
    const courses = await getCourses(facultyId, trackId, directOnly);
    return Response.json({ success: true, data: courses });
  } catch (error) {
    console.error("Get courses error:", error);
    return Response.json({ success: false, message: "خطا در دریافت لیست دروس" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const body: any = await request.json();
    const {
      facultyId,
      name,
      code,
      abbreviation,
      units,
      offeredIn,
      description,
      trackId,
      visualCategoryId,
      ruleCategoryId,
    } = body;

    if (!facultyId || !name) {
      return Response.json({ success: false, message: "دانشکده و نام درس الزامی است." }, { status: 400 });
    }

    const newCourse = await createCourse({
      facultyId,
      name,
      code: code ? String(code).trim() : undefined,
      abbreviation,
      units: Number(units) || 3,
      offeredIn,
      description,
      trackId,
      visualCategoryId,
      ruleCategoryId,
    });

    return Response.json({ success: true, data: newCourse }, { status: 201 });
  } catch (error) {
    console.error("Create course error:", error);
    return Response.json({ success: false, message: "خطا در ایجاد درس" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const body: any = await request.json();
    const { action, id, courseId, requiredCourseId, type, ...updateData } = body;

    // Sub-action: Add Prerequisite with Cycle Detection
    if (action === "add_prerequisite") {
      if (!courseId || !requiredCourseId) {
        return Response.json({ success: false, message: "شناسه هر دو درس الزامی است." }, { status: 400 });
      }

      if (courseId === requiredCourseId) {
        return Response.json({ success: false, message: "یک درس نمی‌تواند پیش‌نیاز خودش باشد!" }, { status: 400 });
      }

      // Check for cycles in prerequisites graph
      const existingPrereqs = await getAllPrerequisites();
      const causesCycle = wouldCreatePrerequisiteCycle(existingPrereqs, {
        courseId,
        requiredCourseId,
      });

      if (causesCycle) {
        return Response.json(
          {
            success: false,
            message: "خطای چرخه: افزودن این پیش‌نیاز باعث ایجاد چرخه و وابستگی دوری بین دروس می‌شود!",
          },
          { status: 409 }
        );
      }

      const relation = await addPrerequisite(courseId, requiredCourseId, type || "prerequisite");
      return Response.json({ success: true, data: relation });
    }

    // Sub-action: Remove Prerequisite
    if (action === "remove_prerequisite") {
      const { relationId } = body;
      if (!relationId) {
        return Response.json({ success: false, message: "شناسه رابطه الزامی است." }, { status: 400 });
      }
      const success = await removePrerequisite(relationId);
      return Response.json({ success });
    }

    // General Course Update
    if (!id) {
      return Response.json({ success: false, message: "شناسه درس الزامی است." }, { status: 400 });
    }

    const updated = await updateCourse(id, updateData);
    return Response.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update course error:", error);
    return Response.json({ success: false, message: "خطا در به‌روزرسانی درس" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const facultyId = searchParams.get("facultyId");
    const all = searchParams.get("all") === "true";

    if (all && facultyId) {
      const success = await deleteCoursesByFaculty(facultyId);
      return Response.json({ success, message: "کلیه دروس دانشکده حذف شدند." });
    }

    if (!id) {
      return Response.json({ success: false, message: "شناسه درس الزامی است." }, { status: 400 });
    }

    const success = await deleteCourse(id);
    return Response.json({ success });
  } catch (error) {
    console.error("Delete course error:", error);
    return Response.json({ success: false, message: "خطا در حذف درس" }, { status: 500 });
  }
}
