import { NextRequest, NextResponse } from "next/server";
import { promoteCustomEventToGlobal } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const body: any = await request.json();
    const { eventId } = body;

    if (!eventId) {
      return NextResponse.json({ success: false, message: "شناسه رویداد الزامی است." }, { status: 400 });
    }

    const ok = await promoteCustomEventToGlobal(eventId);
    if (!ok) {
      return NextResponse.json({ success: false, message: "رویداد مورد نظر یافت نشد." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "رویداد با موفقیت به عنوان ارائه رسمی و عمومی سامانه تأیید شد.",
    });
  } catch (error) {
    console.error("POST /api/admin/events/promote error:", error);
    return NextResponse.json({ success: false, message: "خطا در تایید رویداد" }, { status: 500 });
  }
}
