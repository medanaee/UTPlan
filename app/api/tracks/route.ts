import { apiResponseJson } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth";
import {
  getTracks,
  getTrackById,
  createTrack,
  updateTrack,
  updateTrackRules,
  deleteTrack,
  logAdminAction,
  buildDiff,
} from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const majorId = searchParams.get("majorId") || undefined;
    const tracks = await getTracks(majorId);
    return apiResponseJson(
      { success: true, data: tracks },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Get tracks error:", error);
    return apiResponseJson({ success: false, message: "خطا در دریافت لیست گرایش‌ها" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const body: any = await request.json();
    const { majorId, name, code, rulesTree } = body as {
      majorId?: string;
      name?: string;
      code?: string;
      rulesTree?: any;
    };

    if (!majorId || !name || !code) {
      return apiResponseJson({ success: false, message: "رشته، نام و کد گرایش الزامی است." }, { status: 400 });
    }

    const newTrack = await createTrack(majorId, name, code, rulesTree);
    await logAdminAction({
      userId: auth.user!.id,
      userName: auth.user!.name,
      userEmail: auth.user!.email,
      action: "CREATE",
      entityType: "track",
      entityId: newTrack.id,
      entityName: name,
    });
    return apiResponseJson({ success: true, data: newTrack }, { status: 201 });
  } catch (error) {
    console.error("Create track error:", error);
    return apiResponseJson({ success: false, message: "خطا در ایجاد گرایش" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const body: any = await request.json();
    const { id, trackId, name, code, rulesTree } = body as {
      id?: string;
      trackId?: string;
      name?: string;
      code?: string;
      rulesTree?: any;
    };

    const targetId = id || trackId;
    if (!targetId) {
      return apiResponseJson({ success: false, message: "شناسه گرایش الزامی است." }, { status: 400 });
    }

    if (name && code) {
      const existing = await getTrackById(targetId);
      const updated = await updateTrack(targetId, name, code, rulesTree);
      if (!updated) {
        return apiResponseJson({ success: false, message: "گرایش یافت نشد." }, { status: 404 });
      }

      const diff = existing
        ? buildDiff(existing, updated, ["name", "code", "rulesTree"])
        : { changedFields: [], changes: {} };

      await logAdminAction({
        userId: auth.user!.id,
        userName: auth.user!.name,
        userEmail: auth.user!.email,
        action: "UPDATE",
        entityType: "track",
        entityId: targetId,
        entityName: name,
        details: {
          code: updated.code,
          ...diff,
        },
      });
      return apiResponseJson({ success: true, data: updated });
    }

    if (rulesTree) {
      const success = await updateTrackRules(targetId, rulesTree);
      if (success) {
        await logAdminAction({
          userId: auth.user!.id,
          userName: auth.user!.name,
          userEmail: auth.user!.email,
          action: "UPDATE",
          entityType: "rule",
          entityId: targetId,
          entityName: "درخت قوانین گرایش",
        });
      }
      return apiResponseJson({ success });
    }

    return apiResponseJson({ success: false, message: "اطلاعات ویرایش نامعتبر است." }, { status: 400 });
  } catch (error) {
    console.error("Update track error:", error);
    return apiResponseJson({ success: false, message: "خطا در به‌روزرسانی گرایش" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return apiResponseJson({ success: false, message: "شناسه گرایش الزامی است." }, { status: 400 });
    }

    const success = await deleteTrack(id);
    if (success) {
      await logAdminAction({
        userId: auth.user!.id,
        userName: auth.user!.name,
        userEmail: auth.user!.email,
        action: "DELETE",
        entityType: "track",
        entityId: id,
      });
    }
    return apiResponseJson({ success });
  } catch (error) {
    console.error("Delete track error:", error);
    return apiResponseJson({ success: false, message: "خطا در حذف گرایش" }, { status: 500 });
  }
}
