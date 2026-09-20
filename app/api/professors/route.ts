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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const facultyId = searchParams.get("facultyId") || undefined;
    const directOnly = searchParams.get("directOnly") === "true";
    const profs = await getProfessors(facultyId, directOnly);
    return Response.json({ success: true, data: profs });
  } catch (error) {
    console.error("Get professors error:", error);
    return Response.json({ success: false, message: "خطا در دریافت لیست اساتید" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const body: any = await request.json();
    const { facultyId, code, firstName, lastName, name, title, email, avatarUrl, links } = body;

    if (!facultyId || (!name && !firstName && !lastName)) {
      return Response.json({ success: false, message: "دانشکده و نام استاد الزامی است." }, { status: 400 });
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

    return Response.json({ success: true, data: newProf }, { status: 201 });
  } catch (error: any) {
    console.error("Create professor error:", error);
    const isConflict = error?.message?.includes("تکراری");
    return Response.json(
      { success: false, message: error?.message || "خطا در ایجاد استاد" },
      { status: isConflict ? 409 : 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const body: any = await request.json();
    const { id, facultyId, code, firstName, lastName, name, title, email, avatarUrl, links } = body;

    if (!id) {
      return Response.json({ success: false, message: "شناسه استاد الزامی است." }, { status: 400 });
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
      return Response.json({ success: false, message: "استاد مورد نظر یافت نشد." }, { status: 404 });
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

    return Response.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Update professor error:", error);
    const isConflict = error?.message?.includes("تکراری");
    return Response.json(
      { success: false, message: error?.message || "خطا در به‌روزرسانی استاد" },
      { status: isConflict ? 409 : 500 }
    );
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
      const success = await deleteProfessorsByFaculty(facultyId);
      await logAdminAction({
        userId: auth.user!.id,
        userName: auth.user!.name,
        userEmail: auth.user!.email,
        action: "DELETE",
        entityType: "professor",
        details: { facultyId, all: true },
      });
      return Response.json({ success, message: "کلیه اساتید دانشکده حذف شدند." });
    }

    if (!id) {
      return Response.json({ success: false, message: "شناسه استاد الزامی است." }, { status: 400 });
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

    return Response.json({ success });
  } catch (error) {
    console.error("Delete professor error:", error);
    return Response.json({ success: false, message: "خطا در حذف استاد" }, { status: 500 });
  }
}
