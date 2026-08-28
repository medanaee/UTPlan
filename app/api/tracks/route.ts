import { getTracks, createTrack, deleteTrack, updateTrackRules } from "@/lib/db";

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
    const { trackId, rulesTree } = body as { trackId?: string; rulesTree?: any };

    if (!trackId || !rulesTree) {
      return Response.json({ success: false, message: "شناسه گرایش و درخت قوانین الزامی است." }, { status: 400 });
    }

    const success = await updateTrackRules(trackId, rulesTree);
    return Response.json({ success });
  } catch (error) {
    console.error("Update track rules error:", error);
    return Response.json({ success: false, message: "خطا در به‌روزرسانی قوانین گرایش" }, { status: 500 });
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
