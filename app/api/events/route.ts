import { NextRequest, NextResponse } from "next/server";
import { getEvents, createEvent, createCustomUserEvent, updateEvent, deleteEvent } from "@/lib/db";
import { getAuthTokenFromRequest, verifySessionToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(request);
    const session = token ? await verifySessionToken(token) : null;

    const { searchParams } = new URL(request.url);
    const offeringId = searchParams.get("offeringId") || undefined;
    const term = searchParams.get("term") || undefined;
    const facultyId = searchParams.get("facultyId") || undefined;
    const courseId = searchParams.get("courseId") || undefined;
    const customOnly = searchParams.get("customOnly") === "true";

    const data = await getEvents({
      offeringId,
      term,
      facultyId,
      courseId,
      userId: session?.id,
      customOnly: customOnly && (session?.role === "admin" || session?.role === "super_admin"),
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET events error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در دریافت زمان‌بندی رویدادها" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(request);
    const session = token ? await verifySessionToken(token) : null;
    if (!session) {
      return NextResponse.json(
        { success: false, message: "عدم احراز هویت" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      offeringId,
      courseId,
      professorName,
      term,
      groupCode,
      capacity,
      location,
      examDate,
      examStartTime,
      examEndTime,
      slots,
      isUserCustom,
    } = body;

    // Student custom event creation
    if (isUserCustom || (!offeringId && courseId && professorName)) {
      if (!courseId || !professorName) {
        return NextResponse.json(
          { success: false, message: "انتخاب درس و نام استاد الزامی است." },
          { status: 400 }
        );
      }

      const newCustomEvent = await createCustomUserEvent({
        userId: session.id,
        courseId,
        professorName,
        term: term || "1403-1",
        location: location || "",
        examDate: examDate || "",
        examStartTime: examStartTime || "",
        examEndTime: examEndTime || "",
        slots: slots || [],
      });

      return NextResponse.json({
        success: true,
        message: "ارائه شخصی شما با موفقیت ثبت شد.",
        data: newCustomEvent,
      });
    }

    // Official admin event creation
    if (!offeringId) {
      return NextResponse.json(
        { success: false, message: "شناسه ارائه الزامی است." },
        { status: 400 }
      );
    }

    if (session.role !== "admin" && session.role !== "super_admin") {
      return NextResponse.json(
        { success: false, message: "تنها مدیران می‌توانند رویداد رسمی ثبت کنند." },
        { status: 403 }
      );
    }

    const newEvent = await createEvent({
      offeringId,
      term: term || "1403-1",
      location: location || "",
      examDate: examDate || "",
      examStartTime: examStartTime || "",
      examEndTime: examEndTime || "",
      isUserCustom: false,
      slots: slots || [],
    });

    return NextResponse.json({
      success: true,
      message: "زمان‌بندی رویداد با موفقیت ذخیره شد.",
      data: newEvent,
    });
  } catch (error) {
    console.error("POST event error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در ثبت زمان‌بندی رویداد" },
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
        { success: false, message: "عدم احراز هویت" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      id,
      offeringId,
      term,
      groupCode,
      capacity,
      location,
      examDate,
      examStartTime,
      examEndTime,
      slots,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "شناسه رویداد الزامی است." },
        { status: 400 }
      );
    }

    const updated = await updateEvent(id, {
      offeringId,
      term,
      groupCode,
      capacity: capacity !== undefined ? Number(capacity) : undefined,
      location,
      examDate,
      examStartTime,
      examEndTime,
      slots,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, message: "رویداد مورد نظر یافت نشد." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "زمان‌بندی رویداد با موفقیت به‌روزرسانی شد.",
      data: updated,
    });
  } catch (error) {
    console.error("PUT event error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در ویرایش زمان‌بندی رویداد" },
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
        { success: false, message: "عدم دسترسی کافی" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "شناسه رویداد الزامی است." },
        { status: 400 }
      );
    }

    const success = await deleteEvent(id);
    if (!success) {
      return NextResponse.json(
        { success: false, message: "رویداد مورد نظر یافت نشد." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "رویداد با موفقیت حذف شد.",
    });
  } catch (error) {
    console.error("DELETE event error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در حذف رویداد" },
      { status: 500 }
    );
  }
}
