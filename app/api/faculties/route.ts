import { apiResponseJson, withApiTiming } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth";
import { getFaculties, createFaculty, updateFaculty, deleteFaculty } from "@/lib/db";

async function GETHandler() {
  try {
    const faculties = await getFaculties();
    return apiResponseJson(
      { success: true, data: faculties },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Get faculties error:", error);
    return apiResponseJson({ success: false, message: "خطا در دریافت لیست دانشکده‌ها" }, { status: 500 });
  }
}

export const GET = withApiTiming(GETHandler);

async function POSTHandler(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const body: any = await request.json();
    const { name, code } = body as { name?: string; code?: string };

    if (!name || !code) {
      return apiResponseJson({ success: false, message: "نام و کد دانشکده الزامی است." }, { status: 400 });
    }

    const newFaculty = await createFaculty(name, code);
    return apiResponseJson({ success: true, data: newFaculty }, { status: 201 });
  } catch (error) {
    console.error("Create faculty error:", error);
    return apiResponseJson({ success: false, message: "خطا در ایجاد دانشکده" }, { status: 500 });
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
      return apiResponseJson({ success: false, message: "شناسه، نام و کد دانشکده الزامی است." }, { status: 400 });
    }

    const updated = await updateFaculty(id, name, code);
    if (!updated) {
      return apiResponseJson({ success: false, message: "دانشکده یافت نشد." }, { status: 404 });
    }

    return apiResponseJson({ success: true, data: updated });
  } catch (error) {
    console.error("Update faculty error:", error);
    return apiResponseJson({ success: false, message: "خطا در ویرایش دانشکده" }, { status: 500 });
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
      return apiResponseJson({ success: false, message: "شناسه دانشکده الزامی است." }, { status: 400 });
    }

    const success = await deleteFaculty(id);
    return apiResponseJson({ success });
  } catch (error) {
    console.error("Delete faculty error:", error);
    return apiResponseJson({ success: false, message: "خطا در حذف دانشکده" }, { status: 500 });
  }
}

export const DELETE = withApiTiming(DELETEHandler);
