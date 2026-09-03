import { NextRequest, NextResponse } from "next/server";
import { getEvents, createEvent, createCustomUserEvent, updateEvent, deleteEvent, findUserById, getD1 } from "@/lib/db";
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
    const token = getAuthTokenFromRequest(request);
    const session = token ? await verifySessionToken(token) : null;
    const { isAdmin, userId } = await getEffectiveUserRole(session);

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
      userId: userId || undefined,
      customOnly: customOnly && isAdmin,
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

    const { isAdmin, userId } = await getEffectiveUserRole(session);

    const body = await request.json();
    const {
      code,
      offeringId,
      professorName,
      term,
      capacity,
      location,
      examDate,
      examStartTime,
      examEndTime,
      slots,
      isUserCustom,
    } = body;

    // Student custom event creation
    if (isUserCustom) {
      if (!offeringId) {
        return NextResponse.json(
          { success: false, message: "انتخاب ارائه درس الزامی است." },
          { status: 400 }
        );
      }

      const newCustomEvent = await createCustomUserEvent({
        userId: userId,
        code,
        offeringId,
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

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: "تنها مدیران می‌توانند رویداد رسمی ثبت کنند." },
        { status: 403 }
      );
    }

    const newEvent = await createEvent({
      code,
      offeringId,
      term: term || "1403-1",
      capacity: capacity !== undefined ? Number(capacity) : 40,
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

    const { isAdmin, userId } = await getEffectiveUserRole(session);

    const body = await request.json();
    const {
      id,
      code,
      offeringId,
      term,
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

    // Authorization check
    if (!isAdmin) {
      const d1 = getD1();
      if (d1) {
        const existing = await d1
          .prepare("SELECT user_id, is_user_custom FROM course_events WHERE id = ?")
          .bind(id)
          .first();
        if (!existing || (existing as any).user_id !== userId) {
          return NextResponse.json(
            { success: false, message: "تنها صاحب رویداد یا مدیر می‌تواند آن را ویرایش کند." },
            { status: 403 }
          );
        }
      }
    }

    const updated = await updateEvent(id, {
      code,
      offeringId,
      term,
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
    if (!session) {
      return NextResponse.json(
        { success: false, message: "عدم احراز هویت" },
        { status: 401 }
      );
    }

    const { isAdmin, userId } = await getEffectiveUserRole(session);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "شناسه رویداد الزامی است." },
        { status: 400 }
      );
    }

    // Check permissions: Admin can delete all, users can delete their own custom events
    if (!isAdmin) {
      const d1 = getD1();
      if (d1) {
        const existing = await d1
          .prepare("SELECT user_id, is_user_custom FROM course_events WHERE id = ?")
          .bind(id)
          .first();
        if (!existing || (existing as any).user_id !== userId) {
          return NextResponse.json(
            { success: false, message: "تنها صاحب رویداد یا مدیر می‌تواند آن را حذف کند." },
            { status: 403 }
          );
        }
      }
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
