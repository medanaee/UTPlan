import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromRequest, verifySessionToken } from "@/lib/auth";
import {
  getCharts,
  getChartById,
  createChart,
  updateChart,
  deleteChart,
  getApprovedTrackChart,
  getApprovedTrackCharts,
  setPrimaryApprovedChart,
} from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(req);
    const session = token ? await verifySessionToken(token) : null;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const trackId = searchParams.get("trackId");
    const approved = searchParams.get("approved");

    if (id) {
      const chart = await getChartById(id);
      if (!chart) {
        return NextResponse.json({ success: false, message: "چارت مورد نظر یافت نشد" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: chart });
    }

    if (approved === "true") {
      const approvedCharts = await getApprovedTrackCharts(trackId || undefined);
      return NextResponse.json({ success: true, data: approvedCharts });
    }

    const userId = session?.id;
    const charts = await getCharts(userId);
    return NextResponse.json({ success: true, data: charts });
  } catch (err: any) {
    console.error("GET /api/charts error:", err);
    return NextResponse.json({ success: false, message: "خطا در دریافت چارت‌ها" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(req);
    const session = token ? await verifySessionToken(token) : null;
    if (!session) {
      return NextResponse.json(
        { success: false, message: "لطفاً ابتدا وارد حساب کاربری خود شوید." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { title, trackId, cloneFromId, isApprovedDefault, semesters } = body;

    if (!trackId) {
      return NextResponse.json({ success: false, message: "شناسه گرایش الزامی است." }, { status: 400 });
    }

    let initialSemesters = semesters;

    // Clone from an existing chart (e.g. approved curriculum)
    if (cloneFromId) {
      const sourceChart = await getChartById(cloneFromId);
      if (sourceChart) {
        initialSemesters = sourceChart.semesters;
      }
    }

    const newChart = await createChart({
      userId: session.id,
      trackId,
      title: title || "چارت تحصیلی من",
      semesters: initialSemesters,
      isApprovedDefault: (session.role === "super_admin" || session.role === "admin") && isApprovedDefault,
    });

    return NextResponse.json({ success: true, data: newChart, message: "چارت جدید با موفقیت ایجاد شد." });
  } catch (err: any) {
    console.error("POST /api/charts error:", err);
    return NextResponse.json({ success: false, message: "خطا در ایجاد چارت" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(req);
    const session = token ? await verifySessionToken(token) : null;
    if (!session) {
      return NextResponse.json(
        { success: false, message: "لطفاً ابتدا وارد حساب کاربری خود شوید." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { id, title, trackId, semesters, isPrimaryApproved, isApprovedDefault, action } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: "شناسه چارت الزامی است." }, { status: 400 });
    }

    const existing = await getChartById(id);
    if (!existing) {
      return NextResponse.json({ success: false, message: "چارت مورد نظر یافت نشد." }, { status: 404 });
    }

    const isAdmin = session.role === "super_admin" || session.role === "admin";

    // Strict Security Guard:
    // 1. If this is an official approved default track chart, ONLY admins can edit it!
    if (existing.isApprovedDefault && !isAdmin) {
      return NextResponse.json(
        {
          success: false,
          message: "دسترسی غیرمجاز: چارت‌های مصوب و رسمی دانشگاه فقط توسط مدیران قابل ویرایش هستند.",
        },
        { status: 403 }
      );
    }

    // 2. If this is a student's private chart, only the owner or admins can edit it.
    if (!existing.isApprovedDefault && existing.userId !== session.id && !isAdmin) {
      return NextResponse.json(
        {
          success: false,
          message: "دسترسی غیرمجاز: شما دسترسی ویرایش این چارت تحصیلی را ندارید.",
        },
        { status: 403 }
      );
    }

    if (action === "set_primary" || isPrimaryApproved) {
      if (!isAdmin) {
        return NextResponse.json({ success: false, message: "دسترسی غیرمجاز" }, { status: 403 });
      }
      await setPrimaryApprovedChart(existing.trackId, id);
      const updated = await getChartById(id);
      return NextResponse.json({
        success: true,
        data: updated,
        message: "این چارت به عنوان چارت مصوب اصلی گرایش تعیین شد.",
      });
    }

    const updated = await updateChart(id, {
      title,
      trackId,
      semesters,
      isApprovedDefault: isAdmin ? isApprovedDefault : undefined,
      isPrimaryApproved: isAdmin ? isPrimaryApproved : undefined,
    });

    return NextResponse.json({ success: true, data: updated, message: "چارت با موفقیت ذخیره شد." });
  } catch (err: any) {
    console.error("PUT /api/charts error:", err);
    return NextResponse.json({ success: false, message: "خطا در به‌روزرسانی چارت" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(req);
    const session = token ? await verifySessionToken(token) : null;
    if (!session) {
      return NextResponse.json(
        { success: false, message: "لطفاً ابتدا وارد حساب کاربری خود شوید." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "شناسه چارت الزامی است." }, { status: 400 });
    }

    const existing = await getChartById(id);
    if (!existing) {
      return NextResponse.json({ success: false, message: "چارت یافت نشد." }, { status: 404 });
    }

    const isAdmin = session.role === "super_admin" || session.role === "admin";

    // Strict Security Guard for DELETE:
    if (existing.isApprovedDefault && !isAdmin) {
      return NextResponse.json(
        { success: false, message: "دسترسی غیرمجاز: چارت‌های مصوب رسمی دانشگاه فقط توسط مدیران قابل حذف هستند." },
        { status: 403 }
      );
    }

    if (!existing.isApprovedDefault && existing.userId !== session.id && !isAdmin) {
      return NextResponse.json(
        { success: false, message: "دسترسی غیرمجاز: شما اجازه حذف این چارت را ندارید." },
        { status: 403 }
      );
    }

    await deleteChart(id);
    return NextResponse.json({ success: true, message: "چارت با موفقیت حذف شد." });
  } catch (err: any) {
    console.error("DELETE /api/charts error:", err);
    return NextResponse.json({ success: false, message: "خطا در حذف چارت" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(req);
    const session = token ? await verifySessionToken(token) : null;
    if (!session) {
      return NextResponse.json({ success: false, message: "عدم احراز هویت" }, { status: 401 });
    }

    const body = await req.json();
    const { chartId, termIndex, courseId, selectedEventId } = body;

    if (!chartId || termIndex === undefined || !courseId) {
      return NextResponse.json({ success: false, message: "اطلاعات ارسالی ناقص است." }, { status: 400 });
    }

    const chart = await getChartById(chartId);
    if (!chart) {
      return NextResponse.json({ success: false, message: "چارت یافت نشد." }, { status: 404 });
    }

    const isAdmin = session.role === "super_admin" || session.role === "admin";
    if (!chart.isApprovedDefault && chart.userId !== session.id && !isAdmin) {
      return NextResponse.json({ success: false, message: "دسترسی غیرمجاز" }, { status: 403 });
    }

    await updateChartCourseEvent(chartId, Number(termIndex), courseId, selectedEventId || null);
    const updated = await getChartById(chartId);

    return NextResponse.json({
      success: true,
      message: "رویداد درسی برای این ترم با موفقیت ذخیره شد.",
      data: updated,
    });
  } catch (err: any) {
    console.error("PATCH /api/charts error:", err);
    return NextResponse.json({ success: false, message: "خطا در ثبت رویداد درس" }, { status: 500 });
  }
}
