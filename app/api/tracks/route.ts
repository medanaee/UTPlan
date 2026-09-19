import { requireAdminSession } from "@/lib/auth";
import { getTracks, createTrack, updateTrack, deleteTrack, updateTrackRules, logAdminAction } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const majorId = searchParams.get("majorId") || undefined;
    const tracks = await getTracks(majorId);
    return Response.json({ success: true, data: tracks });
  } catch (error) {
    console.error("Get tracks error:", error);
    return Response.json({ success: false, message: "خطا در دریافت لیست گرایش‌ها" }, { status: 500 });
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
      return Response.json({ success: false, message: "رشته، نام و کد گرایش الزامی است." }, { status: 400 });
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
    return Response.json({ success: true, data: newTrack }, { status: 201 });
  } catch (error) {
    console.error("Create track error:", error);
    return Response.json({ success: false, message: "خطا در ایجاد گرایش" }, { status: 500 });
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
      return Response.json({ success: false, message: "شناسه گرایش الزامی است." }, { status: 400 });
    }

    if (name && code) {
      const updated = await updateTrack(targetId, name, code, rulesTree);
      if (!updated) {
        return Response.json({ success: false, message: "گرایش یافت نشد." }, { status: 404 });
      }
      await logAdminAction({
        userId: auth.user!.id,
        userName: auth.user!.name,
        userEmail: auth.user!.email,
        action: "UPDATE",
        entityType: "track",
        entityId: targetId,
        entityName: name,
      });
      return Response.json({ success: true, data: updated });
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
      return Response.json({ success });
    }

    return Response.json({ success: false, message: "اطلاعات ویرایش نامعتبر است." }, { status: 400 });
  } catch (error) {
    console.error("Update track error:", error);
    return Response.json({ success: false, message: "خطا در به‌روزرسانی گرایش" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return Response.json({ success: false, message: "شناسه گرایش الزامی است." }, { status: 400 });
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
    return Response.json({ success });
  } catch (error) {
    console.error("Delete track error:", error);
    return Response.json({ success: false, message: "خطا در حذف گرایش" }, { status: 500 });
  }
}
