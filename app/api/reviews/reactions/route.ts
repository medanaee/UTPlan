import { apiResponseJson } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { toggleReviewReaction, ALLOWED_REACTION_EMOJIS } from "@/lib/db";
import { getAuthTokenFromRequest, verifySessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(request);
    const session = token ? await verifySessionToken(token) : null;
    const userId = session?.id || null;

    const body: any = await request.json();
    const { reviewId, emoji } = body;
    const clientId = body.clientId || request.headers.get("x-client-id") || null;

    if (!reviewId || typeof reviewId !== "string") {
      return apiResponseJson(
        { success: false, message: "شناسه نظر الزامی است." },
        { status: 400 }
      );
    }

    if (!emoji || !ALLOWED_REACTION_EMOJIS.includes(emoji as any)) {
      return apiResponseJson(
        { success: false, message: "ایموجی نامعتبر است." },
        { status: 400 }
      );
    }

    if (!userId && !clientId) {
      return apiResponseJson(
        { success: false, message: "شناسه کاربر یا کلاینت نامعتبر است." },
        { status: 400 }
      );
    }

    const result = await toggleReviewReaction({
      reviewId,
      emoji,
      userId,
      clientId: userId ? null : clientId,
    });

    if (!result.success) {
      return apiResponseJson(
        { success: false, message: result.message || "خطا در ثبت واکنش" },
        { status: 400 }
      );
    }

    return apiResponseJson({
      success: true,
      action: result.action,
      reactions: result.reactions,
    });
  } catch (error: any) {
    console.error("POST review reaction error:", error);
    return apiResponseJson(
      { success: false, message: "خطای سرور در ثبت واکنش" },
      { status: 500 }
    );
  }
}
