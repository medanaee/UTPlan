import { getTracks, createTrack, updateTrack, deleteTrack, updateTrackRules } from "@/lib/db";

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
    const body = await request.json();
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
    return Response.json({ success: true, data: newTrack }, { status: 201 });
  } catch (error) {
    console.error("Create track error:", error);
    return Response.json({ success: false, message: "خطا در ایجاد گرایش" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
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
      return Response.json({ success: true, data: updated });
    }

    if (rulesTree) {
      const success = await updateTrackRules(targetId, rulesTree);
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return Response.json({ success: false, message: "شناسه گرایش الزامی است." }, { status: 400 });
    }

    const success = await deleteTrack(id);
    return Response.json({ success });
  } catch (error) {
    console.error("Delete track error:", error);
    return Response.json({ success: false, message: "خطا در حذف گرایش" }, { status: 500 });
  }
}
