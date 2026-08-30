import { NextRequest, NextResponse } from "next/server";
import { promoteCustomEventToGlobal } from "@/lib/db";
import { getAuthTokenFromRequest, verifySessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(request);
    const session = token ? await verifySessionToken(token) : null;
    if (!session || (session.role !== "admin" && session.role !== "super_admin")) {
      return NextResponse.json({ success: false, message: "دسترسی غیرمجاز" }, { status: 403 });
    }

    const body = await request.json();
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
