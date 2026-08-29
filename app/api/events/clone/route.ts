import { NextRequest, NextResponse } from "next/server";
import { getEvents, createEvent } from "@/lib/db";
import { getAuthTokenFromRequest, verifySessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(request);
    const session = token ? await verifySessionToken(token) : null;
    if (!session || (session.role !== "admin" && session.role !== "super_admin")) {
      return NextResponse.json(
        { success: false, message: "دسترسی غیرمجاز. فقط مدیران می‌توانند رویدادها را کپی کنند." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { sourceTerm, targetTerm, resetExamDates = false } = body;

    if (!sourceTerm || !targetTerm) {
      return NextResponse.json(
        { success: false, message: "نیمسال مبدأ و نیمسال مقصد الزامی هستند." },
        { status: 400 }
      );
    }

    if (sourceTerm === targetTerm) {
      return NextResponse.json(
        { success: false, message: "نیمسال مبدأ و مقصد نمی‌توانند یکسان باشند." },
        { status: 400 }
      );
    }

    const sourceEvents = await getEvents({ term: sourceTerm });
    if (sourceEvents.length === 0) {
      return NextResponse.json(
        { success: false, message: `هیچ رویدادی در نیمسال مبدأ (${sourceTerm}) یافت نشد.` },
        { status: 404 }
      );
    }

    let clonedCount = 0;
    for (const evt of sourceEvents) {
      await createEvent({
        offeringId: evt.offeringId,
        term: targetTerm,
        groupCode: evt.groupCode || "01",
        capacity: evt.capacity || 40,
        location: evt.location || "",
        examDate: resetExamDates ? "" : evt.examDate || "",
        examStartTime: resetExamDates ? "" : evt.examStartTime || "",
        examEndTime: resetExamDates ? "" : evt.examEndTime || "",
        slots: evt.slots?.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        })) || [],
      });
      clonedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `تعداد ${clonedCount} رویداد با موفقیت از نیمسال ${sourceTerm} به ${targetTerm} کپی شد.`,
      count: clonedCount,
    });
  } catch (error) {
    console.error("Clone events error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در کپی رویدادهای کلاسی" },
      { status: 500 }
    );
  }
}
