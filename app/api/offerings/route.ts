import { apiResponseJson, withApiTiming } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import {
  getOfferings,
  getOfferingById,
  createOffering,
  updateOffering,
  deleteOffering,
  deleteOfferingsByFaculty,
  logAdminAction,
  buildDiff,
} from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

async function GETHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const facultyId = searchParams.get("facultyId") || undefined;
    const courseId = searchParams.get("courseId") || undefined;
    const professorId = searchParams.get("professorId") || undefined;
    const directOnly = searchParams.get("directOnly") === "true";

    const data = await getOfferings({
      courseId,
      professorId,
      facultyId,
      directOnly,
    });
    return apiResponseJson(
      { success: true, data },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("GET offerings error:", error);
    return apiResponseJson(
      { success: false, message: "خطا در دریافت ارائه‌های درسی" },
      { status: 500 }
    );
  }
}

export const GET = withApiTiming(GETHandler);

async function POSTHandler(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const body: any = await request.json();
    const { courseId, professorId, professorIds, code, description, finalizedSemesters } = body;

    const resolvedProfIds: string[] = Array.isArray(professorIds) && professorIds.length > 0
      ? professorIds
      : professorId
      ? [professorId]
      : [];

    if (!courseId || resolvedProfIds.length === 0) {
      return apiResponseJson(
        { success: false, message: "شناسه درس و حداقل یک استاد الزامی است." },
        { status: 400 }
      );
    }

    const newOffering = await createOffering({
      courseId,
      professorIds: resolvedProfIds,
      code,
      description,
      finalizedSemesters: Array.isArray(finalizedSemesters) ? finalizedSemesters : [],
    });

    await logAdminAction({
      userId: auth.user!.id,
      userName: auth.user!.name,
      userEmail: auth.user!.email,
      action: "CREATE",
      entityType: "offering",
      entityId: newOffering.id,
      entityName: newOffering.code || "ارائه جدید",
      details: { code: newOffering.code, courseId: newOffering.courseId },
    });

    return apiResponseJson({
      success: true,
      message: "اتصال ارائه درس با موفقیت تعریف شد.",
      data: newOffering,
    });
  } catch (error: any) {
    console.error("POST offering error:", error);
    const isConflict = error?.message?.includes("تکراری");
    return apiResponseJson(
      { success: false, message: error?.message || "خطا در تعریف ارائه درس" },
      { status: isConflict ? 409 : 500 }
    );
  }
}

export const POST = withApiTiming(POSTHandler);

async function PUTHandler(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const body: any = await request.json();
    const { id, courseId, professorId, professorIds, code, description, finalizedSemesters } = body;

    const resolvedProfIds: string[] | undefined = Array.isArray(professorIds)
      ? professorIds
      : professorId
      ? [professorId]
      : undefined;

    if (!id || !courseId || (resolvedProfIds && resolvedProfIds.length === 0)) {
      return apiResponseJson(
        { success: false, message: "شناسه ارائه، درس و حداقل یک استاد الزامی است." },
        { status: 400 }
      );
    }

    const existing = await getOfferingById(id);

    const updated = await updateOffering(id, {
      courseId,
      professorIds: resolvedProfIds,
      code,
      description,
      finalizedSemesters: Array.isArray(finalizedSemesters) ? finalizedSemesters : undefined,
    });
    if (!updated) {
      return apiResponseJson(
        { success: false, message: "ارائه درس مورد نظر یافت نشد." },
        { status: 404 }
      );
    }

    const diff = existing
      ? buildDiff(existing, updated, [
          "code",
          "courseId",
          "description",
          "professorIds",
          "finalizedSemesters",
        ])
      : { changedFields: [], changes: {} };

    await logAdminAction({
      userId: auth.user!.id,
      userName: auth.user!.name,
      userEmail: auth.user!.email,
      action: "UPDATE",
      entityType: "offering",
      entityId: updated.id,
      entityName: updated.code || id,
      details: {
        code: updated.code,
        courseId: updated.courseId,
        ...diff,
      },
    });

    return apiResponseJson({
      success: true,
      message: "ارائه درس با موفقیت ویرایش شد.",
      data: updated,
    });
  } catch (error: any) {
    console.error("PUT offering error:", error);
    const isConflict = error?.message?.includes("تکراری");
    return apiResponseJson(
      { success: false, message: error?.message || "خطا در ویرایش ارائه درس" },
      { status: isConflict ? 409 : 500 }
    );
  }
}

export const PUT = withApiTiming(PUTHandler);

async function DELETEHandler(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const facultyId = searchParams.get("facultyId");
    const all = searchParams.get("all") === "true";

    if (all && facultyId) {
      const success = await deleteOfferingsByFaculty(facultyId);
      await logAdminAction({
        userId: auth.user!.id,
        userName: auth.user!.name,
        userEmail: auth.user!.email,
        action: "DELETE",
        entityType: "offering",
        details: { facultyId, all: true },
      });
      return apiResponseJson({
        success,
        message: "کلیه ارائه‌های درسی دانشکده حذف شدند.",
      });
    }

    if (!id) {
      return apiResponseJson(
        { success: false, message: "شناسه ارائه الزامی است." },
        { status: 400 }
      );
    }

    const success = await deleteOffering(id);
    if (!success) {
      return apiResponseJson(
        { success: false, message: "ارائه درس یافت نشد یا حذف نشد." },
        { status: 404 }
      );
    }

    await logAdminAction({
      userId: auth.user!.id,
      userName: auth.user!.name,
      userEmail: auth.user!.email,
      action: "DELETE",
      entityType: "offering",
      entityId: id,
    });

    return apiResponseJson({
      success: true,
      message: "ارائه درس با موفقیت حذف شد.",
    });
  } catch (error) {
    console.error("DELETE offering error:", error);
    return apiResponseJson(
      { success: false, message: "خطا در حذف ارائه درس" },
      { status: 500 }
    );
  }
}

export const DELETE = withApiTiming(DELETEHandler);
