import { apiResponseJson } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { getEvents, createEvent, logAdminAction } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const body: any = await request.json();
    const { sourceTerm, targetTerm, resetExamDates = false } = body;

    if (!sourceTerm || !targetTerm) {
      return apiResponseJson(
        { success: false, message: "نیمسال مبدأ و نیمسال مقصد الزامی هستند." },
        { status: 400 }
      );
    }

    if (sourceTerm === targetTerm) {
      return apiResponseJson(
        { success: false, message: "نیمسال مبدأ و مقصد نمی‌توانند یکسان باشند." },
        { status: 400 }
      );
    }

    const sourceEvents = await getEvents({ term: sourceTerm });
    if (sourceEvents.length === 0) {
      return apiResponseJson(
        { success: false, message: `هیچ رویدادی در نیمسال مبدأ (${sourceTerm}) یافت نشد.` },
        { status: 404 }
      );
    }

    let clonedCount = 0;
    for (const evt of sourceEvents) {
      await createEvent({
        offeringId: evt.offeringId,
        term: targetTerm,
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

    await logAdminAction({
      userId: auth.user!.id,
      userName: auth.user!.name,
      userEmail: auth.user!.email,
      action: "CREATE",
      entityType: "event",
      entityId: targetTerm,
      entityName: `کپی رویدادهای کلاسی از ترم ${sourceTerm} به ${targetTerm} (${clonedCount} رویداد)`,
      details: {
        sourceTerm,
        targetTerm,
        resetExamDates,
        clonedCount,
      },
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    });

    return apiResponseJson({
      success: true,
      message: `تعداد ${clonedCount} رویداد با موفقیت از نیمسال ${sourceTerm} به ${targetTerm} کپی شد.`,
      count: clonedCount,
    });
  } catch (error) {
    console.error("Clone events error:", error);
    return apiResponseJson(
      { success: false, message: "خطا در کپی رویدادهای کلاسی" },
      { status: 500 }
    );
  }
}
