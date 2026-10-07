import { apiResponseJson, withApiTiming } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth";
import {
  getProfessors,
  getProfessorById,
  createProfessor,
  updateProfessor,
  deleteProfessor,
  deleteProfessorsByFaculty,
  logAdminAction,
  buildDiff,
} from "@/lib/db";

async function GETHandler(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const facultyId = searchParams.get("facultyId") || undefined;
    const directOnly = searchParams.get("directOnly") === "true";
    const profs = await getProfessors(facultyId, directOnly);
    return apiResponseJson(
      { success: true, data: profs },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Get professors error:", error);
    return apiResponseJson({ success: false, message: "خطا در دریافت لیست اساتید" }, { status: 500 });
  }
}

export const GET = withApiTiming(GETHandler);

async function POSTHandler(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const body: any = await request.json();
    const { facultyId, code, firstName, lastName, name, title, email, avatarUrl, links } = body;

    if (!facultyId || (!name && !firstName && !lastName)) {
      return apiResponseJson({ success: false, message: "دانشکده و نام استاد الزامی است." }, { status: 400 });
    }

    const newProf = await createProfessor({
      facultyId,
      code,
      firstName,
      lastName,
      name,
      title,
      email,
      avatarUrl,
      links,
    });

    await logAdminAction({
      userId: auth.user!.id,
      userName: auth.user!.name,
      userEmail: auth.user!.email,
      action: "CREATE",
      entityType: "professor",
      entityId: newProf.id,
      entityName: newProf.name,
      details: { code: newProf.code, title: newProf.title },
    });

    return apiResponseJson({ success: true, data: newProf }, { status: 201 });
  } catch (error: any) {
    console.error("Create professor error:", error);
    const isConflict = error?.message?.includes("تکراری");
    return apiResponseJson(
      { success: false, message: error?.message || "خطا در ایجاد استاد" },
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
    const { id, facultyId, code, firstName, lastName, name, title, email, avatarUrl, links } = body;

    if (!id) {
      return apiResponseJson({ success: false, message: "شناسه استاد الزامی است." }, { status: 400 });
    }

    const existing = await getProfessorById(id);

    const updated = await updateProfessor(id, {
      facultyId,
      code,
      firstName,
      lastName,
      name,
      title,
      email,
      avatarUrl,
      links,
    });

    if (!updated) {
      return apiResponseJson({ success: false, message: "استاد مورد نظر یافت نشد." }, { status: 404 });
    }

    const diff = existing
      ? buildDiff(existing, updated, [
          "facultyId",
          "code",
          "firstName",
          "lastName",
          "name",
          "title",
          "email",
          "avatarUrl",
          "links",
        ])
      : { changedFields: [], changes: {} };

    await logAdminAction({
      userId: auth.user!.id,
      userName: auth.user!.name,
      userEmail: auth.user!.email,
      action: "UPDATE",
      entityType: "professor",
      entityId: updated.id,
      entityName: updated.name,
      details: {
        code: updated.code,
        ...diff,
      },
    });

    return apiResponseJson({ success: true, data: updated });
  } catch (error: any) {
    console.error("Update professor error:", error);
    const isConflict = error?.message?.includes("تکراری");
    return apiResponseJson(
      { success: false, message: error?.message || "خطا در به‌روزرسانی استاد" },
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
      const success = await deleteProfessorsByFaculty(facultyId);
      await logAdminAction({
        userId: auth.user!.id,
        userName: auth.user!.name,
        userEmail: auth.user!.email,
        action: "DELETE",
        entityType: "professor",
        details: { facultyId, all: true },
      });
      return apiResponseJson({ success, message: "کلیه اساتید دانشکده حذف شدند." });
    }

    if (!id) {
      return apiResponseJson({ success: false, message: "شناسه استاد الزامی است." }, { status: 400 });
    }

    const profs = await getProfessors();
    const profBefore = profs.find((p) => p.id === id);
    const success = await deleteProfessor(id);
    if (success) {
      await logAdminAction({
        userId: auth.user!.id,
        userName: auth.user!.name,
        userEmail: auth.user!.email,
        action: "DELETE",
        entityType: "professor",
        entityId: id,
        entityName: profBefore?.name || id,
      });
    }

    return apiResponseJson({ success });
  } catch (error) {
    console.error("Delete professor error:", error);
    return apiResponseJson({ success: false, message: "خطا در حذف استاد" }, { status: 500 });
  }
}

export const DELETE = withApiTiming(DELETEHandler);
