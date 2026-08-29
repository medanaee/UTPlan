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
    const { id, title, trackId, semesters } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: "شناسه چارت الزامی است." }, { status: 400 });
    }

    const existing = await getChartById(id);
    if (!existing) {
      return NextResponse.json({ success: false, message: "چارت مورد نظر یافت نشد." }, { status: 404 });
    }

    // Permission check: only owner or super_admin
    if (existing.userId !== session.id && session.role !== "super_admin" && session.role !== "admin") {
      return NextResponse.json({ success: false, message: "شما دسترسی ویرایش این چارت را ندارید." }, { status: 403 });
    }

    const updated = await updateChart(id, {
      title,
      trackId,
      semesters,
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

    if (existing.userId !== session.id && session.role !== "super_admin") {
      return NextResponse.json({ success: false, message: "دسترسی حذف این چارت را ندارید." }, { status: 403 });
    }

    await deleteChart(id, session.id);
    return NextResponse.json({ success: true, message: "چارت با موفقیت حذف شد." });
  } catch (err: any) {
    console.error("DELETE /api/charts error:", err);
    return NextResponse.json({ success: false, message: "خطا در حذف چارت" }, { status: 500 });
  }
}
