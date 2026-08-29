import { getMajors, createMajor, updateMajor, deleteMajor } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const facultyId = searchParams.get("facultyId") || undefined;
    const majors = await getMajors(facultyId);
    return Response.json({ success: true, data: majors });
  } catch (error) {
    console.error("Get majors error:", error);
    return Response.json({ success: false, message: "خطا در دریافت لیست رشته‌ها" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { facultyId, name, code } = body as { facultyId?: string; name?: string; code?: string };

    if (!facultyId || !name || !code) {
      return Response.json({ success: false, message: "دانشکده، نام و کد رشته الزامی است." }, { status: 400 });
    }

    const newMajor = await createMajor(facultyId, name, code);
    return Response.json({ success: true, data: newMajor }, { status: 201 });
  } catch (error) {
    console.error("Create major error:", error);
    return Response.json({ success: false, message: "خطا در ایجاد رشته" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, code } = body as { id?: string; name?: string; code?: string };

    if (!id || !name || !code) {
      return Response.json({ success: false, message: "شناسه، نام و کد رشته الزامی است." }, { status: 400 });
    }

    const updated = await updateMajor(id, name, code);
    if (!updated) {
      return Response.json({ success: false, message: "رشته یافت نشد." }, { status: 404 });
    }

    return Response.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update major error:", error);
    return Response.json({ success: false, message: "خطا در ویرایش رشته" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return Response.json({ success: false, message: "شناسه رشته الزامی است." }, { status: 400 });
    }

    const success = await deleteMajor(id);
    return Response.json({ success });
  } catch (error) {
    console.error("Delete major error:", error);
    return Response.json({ success: false, message: "خطا در حذف رشته" }, { status: 500 });
  }
}
