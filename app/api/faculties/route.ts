import { requireAdminSession } from "@/lib/auth";
import { getFaculties, createFaculty, updateFaculty, deleteFaculty } from "@/lib/db";

export async function GET() {
  try {
    const faculties = await getFaculties();
    return Response.json(
      { success: true, data: faculties },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Get faculties error:", error);
    return Response.json({ success: false, message: "خطا در دریافت لیست دانشکده‌ها" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const body: any = await request.json();
    const { name, code } = body as { name?: string; code?: string };

    if (!name || !code) {
      return Response.json({ success: false, message: "نام و کد دانشکده الزامی است." }, { status: 400 });
    }

    const newFaculty = await createFaculty(name, code);
    return Response.json({ success: true, data: newFaculty }, { status: 201 });
  } catch (error) {
    console.error("Create faculty error:", error);
    return Response.json({ success: false, message: "خطا در ایجاد دانشکده" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const body: any = await request.json();
    const { id, name, code } = body as { id?: string; name?: string; code?: string };

    if (!id || !name || !code) {
      return Response.json({ success: false, message: "شناسه، نام و کد دانشکده الزامی است." }, { status: 400 });
    }

    const updated = await updateFaculty(id, name, code);
    if (!updated) {
      return Response.json({ success: false, message: "دانشکده یافت نشد." }, { status: 404 });
    }

    return Response.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update faculty error:", error);
    return Response.json({ success: false, message: "خطا در ویرایش دانشکده" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return Response.json({ success: false, message: "شناسه دانشکده الزامی است." }, { status: 400 });
    }

    const success = await deleteFaculty(id);
    return Response.json({ success });
  } catch (error) {
    console.error("Delete faculty error:", error);
    return Response.json({ success: false, message: "خطا در حذف دانشکده" }, { status: 500 });
  }
}
