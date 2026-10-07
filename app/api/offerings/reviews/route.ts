import { apiResponseJson } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { getReviews, getReviewById, createReview, updateReview, deleteReview, findUserById } from "@/lib/db";
import { getAuthTokenFromRequest, verifySessionToken } from "@/lib/auth";

async function getEffectiveUserRole(session: any): Promise<{ isAdmin: boolean; userId: string; role: string }> {
  if (!session?.id) return { isAdmin: false, userId: "", role: "user" };
  try {
    const liveUser = await findUserById(session.id);
    const role = liveUser?.role || session.role || "user";
    const isAdmin = role === "admin" || role === "super_admin";
    return { isAdmin, userId: session.id, role };
  } catch {
    const role = session.role || "user";
    const isAdmin = role === "admin" || role === "super_admin";
    return { isAdmin, userId: session.id, role };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const offeringId = searchParams.get("offeringId");
    const clientId = searchParams.get("clientId") || request.headers.get("x-client-id");

    if (!offeringId) {
      return apiResponseJson(
        { success: false, message: "شناسه ارائه الزامی است." },
        { status: 400 }
      );
    }

    const token = getAuthTokenFromRequest(request);
    const session = token ? await verifySessionToken(token) : null;
    const userId = session?.id || null;

    const reviews = await getReviews("offering", offeringId, userId, clientId);
    return apiResponseJson({ success: true, data: reviews });
  } catch (error) {
    console.error("GET offering reviews error:", error);
    return apiResponseJson(
      { success: false, message: "خطا در دریافت نظرات ارائه" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(request);
    const session = token ? await verifySessionToken(token) : null;

    const body: any = await request.json();
    const { offeringId, comment, isAnonymous, criteriaRatings, studentGrade } = body;

    if (!offeringId || !comment || !comment.trim()) {
      return apiResponseJson(
        { success: false, message: "شناسه ارائه و متن نظر الزامی است." },
        { status: 400 }
      );
    }

    let overallRating: number | null = null;
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

    let parsedGrade: number | null = null;
    if (studentGrade !== undefined && studentGrade !== null && studentGrade !== "") {
      const numGrade = Number(studentGrade);
      if (!isNaN(numGrade) && numGrade >= 0 && numGrade <= 20) {
        parsedGrade = numGrade;
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
      studentGrade: parsedGrade,
    });

    return apiResponseJson({
      success: true,
      message: "نظر شما با موفقیت ثبت شد.",
      data: newRev,
    });
  } catch (error) {
    console.error("POST offering review error:", error);
    return apiResponseJson(
      { success: false, message: "خطا در ثبت نظر" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(request);
    const session = token ? await verifySessionToken(token) : null;

    if (!session) {
      return apiResponseJson(
        { success: false, message: "لطفاً ابتدا وارد حساب کاربری خود شوید." },
        { status: 401 }
      );
    }

    const body: any = await request.json();
    const { id, comment, isAnonymous, criteriaRatings, studentGrade } = body;

    if (!id || !comment || !comment.trim()) {
      return apiResponseJson(
        { success: false, message: "شناسه نظر و متن نظر الزامی است." },
        { status: 400 }
      );
    }

    const existing = await getReviewById(id);
    if (!existing) {
      return apiResponseJson(
        { success: false, message: "نظر یافت نشد یا حذف شده است." },
        { status: 404 }
      );
    }

    // Security check: Author or Admin
    const { isAdmin, userId } = await getEffectiveUserRole(session);
    const isAuthor = existing.userId && existing.userId === userId;

    if (!isAuthor && !isAdmin) {
      return apiResponseJson(
        { success: false, message: "شما دسترسی ویرایش این نظر را ندارید." },
        { status: 403 }
      );
    }

    let overallRating: number | null = null;
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

    let parsedGrade: number | null = null;
    if (studentGrade !== undefined && studentGrade !== null && studentGrade !== "") {
      const numGrade = Number(studentGrade);
      if (!isNaN(numGrade) && numGrade >= 0 && numGrade <= 20) {
        parsedGrade = numGrade;
      }
    }

    const updated = await updateReview(id, {
      comment: comment.trim(),
      isAnonymous: Boolean(isAnonymous),
      criteriaRatings: criteriaRatings || undefined,
      overallRating,
      studentGrade: parsedGrade,
    });

    return apiResponseJson({
      success: true,
      message: "نظر با موفقیت ویرایش شد.",
      data: updated,
    });
  } catch (error) {
    console.error("PUT offering review error:", error);
    return apiResponseJson(
      { success: false, message: "خطا در ویرایش نظر" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(request);
    const session = token ? await verifySessionToken(token) : null;

    if (!session) {
      return apiResponseJson(
        { success: false, message: "لطفاً ابتدا وارد حساب کاربری خود شوید." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return apiResponseJson(
        { success: false, message: "شناسه نظر الزامی است." },
        { status: 400 }
      );
    }

    const existing = await getReviewById(id);
    if (!existing) {
      return apiResponseJson(
        { success: false, message: "نظر یافت نشد یا قبلاً حذف شده است." },
        { status: 404 }
      );
    }

    // Security check: Author or Admin
    const { isAdmin, userId } = await getEffectiveUserRole(session);
    const isAuthor = existing.userId && existing.userId === userId;

    if (!isAuthor && !isAdmin) {
      return apiResponseJson(
        { success: false, message: "شما اجازه حذف این نظر را ندارید." },
        { status: 403 }
      );
    }

    const success = await deleteReview(id);
    if (!success) {
      return apiResponseJson(
        { success: false, message: "خطا در حذف نظر." },
        { status: 500 }
      );
    }

    return apiResponseJson({
      success: true,
      message: "نظر با موفقیت حذف شد.",
    });
  } catch (error) {
    console.error("DELETE offering review error:", error);
    return apiResponseJson(
      { success: false, message: "خطا در حذف نظر" },
      { status: 500 }
    );
  }
}
