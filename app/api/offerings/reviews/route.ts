import { NextRequest, NextResponse } from "next/server";
import { getReviews, createReview, deleteReview } from "@/lib/db";
import { getAuthTokenFromRequest, verifySessionToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const offeringId = searchParams.get("offeringId");

    if (!offeringId) {
      return NextResponse.json(
        { success: false, message: "شناسه ارائه الزامی است." },
        { status: 400 }
      );
    }

    const reviews = await getReviews("offering", offeringId);
    return NextResponse.json({ success: true, data: reviews });
  } catch (error) {
    console.error("GET offering reviews error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در دریافت نظرات ارائه" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(request);
    const session = token ? await verifySessionToken(token) : null;

    const body = await request.json();
    const { offeringId, comment, isAnonymous, criteriaRatings } = body;

    if (!offeringId || !comment || !comment.trim()) {
      return NextResponse.json(
        { success: false, message: "شناسه ارائه و متن نظر الزامی است." },
        { status: 400 }
      );
    }

    // Compute overall rating from provided criteria (1 to 10)
    let overallRating = 10;
    if (criteriaRatings && typeof criteriaRatings === "object") {
      const validScores: number[] = [];
      for (const val of Object.values(criteriaRatings)) {
        const num = Number(val);
        if (!isNaN(num) && num >= 1 && num <= 10) {
          validScores.push(num);
        }
      }
      if (validScores.length > 0) {
        const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
        overallRating = Number(avg.toFixed(1));
      }
    }

    const newRev = await createReview({
      userId: session?.id || null,
      targetType: "offering",
      targetId: offeringId,
      comment: comment.trim(),
      isAnonymous: Boolean(isAnonymous),
      overallRating,
      criteriaRatings: criteriaRatings || undefined,
    });

    return NextResponse.json({
      success: true,
      message: "نظر شما با موفقیت ثبت شد.",
      data: newRev,
    });
  } catch (error) {
    console.error("POST offering review error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در ثبت نظر" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(request);
    const session = token ? await verifySessionToken(token) : null;

    if (!session || (session.role !== "admin" && session.role !== "super_admin")) {
      return NextResponse.json(
        { success: false, message: "عدم دسترسی کافی جهت حذف نظر" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "شناسه نظر الزامی است." },
        { status: 400 }
      );
    }

    const success = await deleteReview(id);
    if (!success) {
      return NextResponse.json(
        { success: false, message: "نظر یافت نشد یا قبلاً حذف شده است." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "نظر با موفقیت توسط مدیر حذف شد.",
    });
  } catch (error) {
    console.error("DELETE offering review error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در حذف نظر" },
      { status: 500 }
    );
  }
}
