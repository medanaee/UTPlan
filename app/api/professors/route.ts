import { getProfessors, createProfessor, deleteProfessor } from "@/lib/db";

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
    const body = await request.json();
    const { facultyId, name, title, email, avatarUrl } = body;

    if (!facultyId || !name) {
      return Response.json({ success: false, message: "دانشکده و نام استاد الزامی است." }, { status: 400 });
    }

    const newProf = await createProfessor({
      facultyId,
      name,
      title,
      email,
      avatarUrl,
    });

    return Response.json({ success: true, data: newProf }, { status: 201 });
  } catch (error) {
    console.error("Create professor error:", error);
    return Response.json({ success: false, message: "خطا در ایجاد استاد" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
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
