import { NextRequest, NextResponse } from "next/server";
import { cloneTrackStructure, findUserById, getTrackById } from "@/lib/db";
import { getAuthTokenFromRequest, verifySessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ success: false, message: "احراز هویت نشده‌اید." }, { status: 401 });
    }

    const session = await verifySessionToken(token);
    if (!session) {
      return NextResponse.json({ success: false, message: "دسترسی غیرمجاز." }, { status: 403 });
    }

    // Live DB validation
    const liveUser = await findUserById(session.id);
    if (!liveUser || (liveUser.role !== "admin" && liveUser.role !== "super_admin")) {
      return NextResponse.json(
        { success: false, message: "تنها مدیران سامانه مجاز به کپی ساختار قوانین هستند." },
        { status: 403 }
      );
    }

    const body: any = await request.json();
    const { sourceTrackId, targetTrackId, options } = body;

    if (!sourceTrackId || !targetTrackId) {
      return NextResponse.json(
        { success: false, message: "شناسه گرایش مبدأ و مقصد الزامی است." },
        { status: 400 }
      );
    }

    if (sourceTrackId === targetTrackId) {
      return NextResponse.json(
        { success: false, message: "گرایش مبدأ و مقصد نمی‌توانند یکسان باشند." },
        { status: 400 }
      );
    }

    const [sourceTrack, targetTrack] = await Promise.all([
      getTrackById(sourceTrackId),
      getTrackById(targetTrackId),
    ]);

    if (!sourceTrack || !targetTrack) {
      return NextResponse.json(
        { success: false, message: "گرایش مبدأ یا مقصد یافت نشد." },
        { status: 404 }
      );
    }

    const result = await cloneTrackStructure(sourceTrackId, targetTrackId, options);

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `ساختار و قوانین گرایش «${sourceTrack.name}» با موفقیت روی «${targetTrack.name}» کپی و با شناسه‌های جدید متصل گردید.`,
      stats: result.stats,
    });
  } catch (error: any) {
    console.error("POST /api/tracks/clone-structure error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "خطای سرور در کپی ساختار" },
      { status: 500 }
    );
  }
}
