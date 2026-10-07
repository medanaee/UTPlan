import { apiResponseJson, withApiTiming } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth";
import { getMajors, createMajor, updateMajor, deleteMajor } from "@/lib/db";

async function GETHandler(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const facultyId = searchParams.get("facultyId") || undefined;
    const majors = await getMajors(facultyId);
    return apiResponseJson(
      { success: true, data: majors },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Get majors error:", error);
    return apiResponseJson({ success: false, message: "خطا در دریافت لیست رشته‌ها" }, { status: 500 });
  }
}

export const GET = withApiTiming(GETHandler);

async function POSTHandler(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const body: any = await request.json();
    const { facultyId, name, code } = body as { facultyId?: string; name?: string; code?: string };

    if (!facultyId || !name || !code) {
      return apiResponseJson({ success: false, message: "دانشکده، نام و کد رشته الزامی است." }, { status: 400 });
    }

    const newMajor = await createMajor(facultyId, name, code);
    return apiResponseJson({ success: true, data: newMajor }, { status: 201 });
  } catch (error) {
    console.error("Create major error:", error);
    return apiResponseJson({ success: false, message: "خطا در ایجاد رشته" }, { status: 500 });
  }
}

export const POST = withApiTiming(POSTHandler);

async function PUTHandler(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const body: any = await request.json();
    const { id, name, code } = body as { id?: string; name?: string; code?: string };

    if (!id || !name || !code) {
      return apiResponseJson({ success: false, message: "شناسه، نام و کد رشته الزامی است." }, { status: 400 });
    }

    const updated = await updateMajor(id, name, code);
    if (!updated) {
      return apiResponseJson({ success: false, message: "رشته یافت نشد." }, { status: 404 });
    }

    return apiResponseJson({ success: true, data: updated });
  } catch (error) {
    console.error("Update major error:", error);
    return apiResponseJson({ success: false, message: "خطا در ویرایش رشته" }, { status: 500 });
  }
}

export const PUT = withApiTiming(PUTHandler);

async function DELETEHandler(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return apiResponseJson({ success: false, message: "شناسه رشته الزامی است." }, { status: 400 });
    }

    const success = await deleteMajor(id);
    return apiResponseJson({ success });
  } catch (error) {
    console.error("Delete major error:", error);
    return apiResponseJson({ success: false, message: "خطا در حذف رشته" }, { status: 500 });
  }
}

export const DELETE = withApiTiming(DELETEHandler);
