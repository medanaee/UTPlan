import { apiResponseJson, withApiTiming } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { cloneTrackStructure, findUserById, getTrackById, logAdminAction } from "@/lib/db";
import { getAuthTokenFromRequest, verifySessionToken } from "@/lib/auth";

async function POSTHandler(request: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(request);
    if (!token) {
      return apiResponseJson({ success: false, message: "احراز هویت نشده‌اید." }, { status: 401 });
    }

    const session = await verifySessionToken(token);
    if (!session) {
      return apiResponseJson({ success: false, message: "دسترسی غیرمجاز." }, { status: 403 });
    }

    // Live DB validation
    const liveUser = await findUserById(session.id);
    if (!liveUser || (liveUser.role !== "admin" && liveUser.role !== "super_admin")) {
      return apiResponseJson(
        { success: false, message: "تنها مدیران سامانه مجاز به کپی ساختار قوانین هستند." },
        { status: 403 }
      );
    }

    const body: any = await request.json();
    const { sourceTrackId, targetTrackId, options } = body;

    if (!sourceTrackId || !targetTrackId) {
      return apiResponseJson(
        { success: false, message: "شناسه گرایش مبدأ و مقصد الزامی است." },
        { status: 400 }
      );
    }

    if (sourceTrackId === targetTrackId) {
      return apiResponseJson(
        { success: false, message: "گرایش مبدأ و مقصد نمی‌توانند یکسان باشند." },
        { status: 400 }
      );
    }

    const [sourceTrack, targetTrack] = await Promise.all([
      getTrackById(sourceTrackId),
      getTrackById(targetTrackId),
    ]);

    if (!sourceTrack || !targetTrack) {
      return apiResponseJson(
        { success: false, message: "گرایش مبدأ یا مقصد یافت نشد." },
        { status: 404 }
      );
    }

    const result = await cloneTrackStructure(sourceTrackId, targetTrackId, options);

    if (!result.success) {
      return apiResponseJson({ success: false, message: result.message }, { status: 500 });
    }

    await logAdminAction({
      userId: liveUser.id,
      userName: liveUser.name,
      userEmail: liveUser.email,
      action: "CREATE",
      entityType: "track",
      entityId: targetTrackId,
      entityName: `کپی ساختار گرایش «${sourceTrack.name}» به «${targetTrack.name}»`,
      details: {
        sourceTrackId,
        sourceTrackName: sourceTrack.name,
        targetTrackId,
        targetTrackName: targetTrack.name,
        options,
        stats: result.stats,
      },
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    });

    return apiResponseJson({
      success: true,
      message: `ساختار و قوانین گرایش «${sourceTrack.name}» با موفقیت روی «${targetTrack.name}» کپی و با شناسه‌های جدید متصل گردید.`,
      stats: result.stats,
    });
  } catch (error: any) {
    console.error("POST /api/tracks/clone-structure error:", error);
    return apiResponseJson(
      { success: false, message: error?.message || "خطای سرور در کپی ساختار" },
      { status: 500 }
    );
  }
}

export const POST = withApiTiming(POSTHandler);
