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
    const professorId = searchParams.get("professorId");

    if (!professorId) {
      return NextResponse.json(
        { success: false, message: "شناسه استاد الزامی است." },
        { status: 400 }
      );
    }

    const reviews = await getReviews("professor", professorId);
    return NextResponse.json({ success: true, data: reviews });
  } catch (error) {
    console.error("GET professor reviews error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در دریافت نظرات استاد" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(request);
    const session = token ? await verifySessionToken(token) : null;

    const body: any = await request.json();
    const { professorId, comment, isAnonymous, criteriaRatings } = body;

    if (!professorId || !comment || !comment.trim()) {
      return NextResponse.json(
        { success: false, message: "شناسه استاد و متن نظر الزامی است." },
        { status: 400 }
      );
    }

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
      targetType: "professor",
      targetId: professorId,
      comment: comment.trim(),
      isAnonymous: Boolean(isAnonymous),
      overallRating,
      criteriaRatings: criteriaRatings || undefined,
    });

    return NextResponse.json({
      success: true,
      message: "نظر شما با موفقیت برای این استاد ثبت شد.",
      data: newRev,
    });
  } catch (error) {
    console.error("POST professor review error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در ثبت نظر استاد" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(request);
    const session = token ? await verifySessionToken(token) : null;

    if (!session) {
      return NextResponse.json(
        { success: false, message: "لطفاً ابتدا وارد حساب کاربری خود شوید." },
        { status: 401 }
      );
    }

    const { isAdmin, userId } = await getEffectiveUserRole(session);

    const body: any = await request.json();
    const { id, comment, isAnonymous, criteriaRatings } = body;

    if (!id || !comment || !comment.trim()) {
      return NextResponse.json(
        { success: false, message: "شناسه نظر و متن نظر الزامی است." },
        { status: 400 }
      );
    }

    const existing = await getReviewById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "نظر یافت نشد یا حذف شده است." },
        { status: 404 }
      );
    }

    // Security check: Author or Admin
    const isAuthor = existing.userId && existing.userId === userId;

    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { success: false, message: "شما دسترسی ویرایش این نظر را ندارید." },
        { status: 403 }
      );
    }

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

    const updated = await updateReview(id, {
      comment: comment.trim(),
      isAnonymous: Boolean(isAnonymous),
      criteriaRatings: criteriaRatings || undefined,
      overallRating,
    });

    return NextResponse.json({
      success: true,
      message: "نظر با موفقیت ویرایش شد.",
      data: updated,
    });
  } catch (error) {
    console.error("PUT professor review error:", error);
    return NextResponse.json(
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
      return NextResponse.json(
        { success: false, message: "لطفاً ابتدا وارد حساب کاربری خود شوید." },
        { status: 401 }
      );
    }

    const { isAdmin, userId } = await getEffectiveUserRole(session);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "شناسه نظر الزامی است." },
        { status: 400 }
      );
    }

    const existing = await getReviewById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "نظر یافت نشد یا قبلاً حذف شده است." },
        { status: 404 }
      );
    }

    // Security check: Author or Admin
    const isAuthor = existing.userId && existing.userId === userId;

    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { success: false, message: "شما اجازه حذف این نظر را ندارید." },
        { status: 403 }
      );
    }

    const success = await deleteReview(id);
    if (!success) {
      return NextResponse.json(
        { success: false, message: "خطا در حذف نظر." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "نظر با موفقیت حذف شد.",
    });
  } catch (error) {
    console.error("DELETE professor review error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در حذف نظر" },
      { status: 500 }
    );
  }
}
