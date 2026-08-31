import { requireAdminSession } from "@/lib/auth";
import { getProfessors, createProfessor, updateProfessor, deleteProfessor } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const facultyId = searchParams.get("facultyId") || undefined;
    const profs = await getProfessors(facultyId);
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
    const body = await request.json();
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

    return Response.json({ success: true, data: newProf }, { status: 201 });
  } catch (error) {
    console.error("Create professor error:", error);
    return Response.json({ success: false, message: "خطا در ایجاد استاد" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const body = await request.json();
    const { id, facultyId, code, firstName, lastName, name, title, email, avatarUrl, links } = body;

    if (!id) {
      return Response.json({ success: false, message: "شناسه استاد الزامی است." }, { status: 400 });
    }

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

    return Response.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update professor error:", error);
    return Response.json({ success: false, message: "خطا در به‌روزرسانی استاد" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return Response.json({ success: false, message: "شناسه استاد الزامی است." }, { status: 400 });
    }

    const success = await deleteProfessor(id);
    return Response.json({ success });
  } catch (error) {
    console.error("Delete professor error:", error);
    return Response.json({ success: false, message: "خطا در حذف استاد" }, { status: 500 });
  }
}
