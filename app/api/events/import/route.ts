import { NextRequest, NextResponse } from "next/server";
import { getEvents, getOfferings, createEvent, updateEvent } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

interface IncomingSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface IncomingEvent {
  code: string;
  offeringCode: string;
  location?: string;
  examDate?: string;
  examStartTime?: string;
  examEndTime?: string;
  slots: IncomingSlot[];
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;

    const body = await request.json();
    const { term, facultyId, events } = body as {
      term: string;
      facultyId?: string;
      events: IncomingEvent[];
    };

    if (!term || typeof term !== "string" || !term.trim()) {
      return NextResponse.json(
        { success: false, message: "نیمسال تحصیلی هدف (term) مشخص نشده است." },
        { status: 400 }
      );
    }

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { success: false, message: "هیچ رویدادی برای ورود ارسال نشده است یا آرایه خالی است." },
        { status: 400 }
      );
    }

    // 1. Fetch available offerings for matching
    const allOfferings = await getOfferings(facultyId);
    const offeringMap = new Map<string, (typeof allOfferings)[0]>();
    for (const off of allOfferings) {
      if (off.code) {
        offeringMap.set(off.code.trim().toUpperCase(), off);
      }
    }

    // 2. Fetch existing events in target term for code matching (Upsert)
    const existingEvents = await getEvents({ term, facultyId });
    const existingMap = new Map<string, (typeof existingEvents)[0]>();
    for (const evt of existingEvents) {
      if (evt.code) {
        existingMap.set(evt.code.trim().toUpperCase(), evt);
      }
    }

    // 3. Validation Pass
    const validationErrors: string[] = [];
    const seenCodesInFile = new Set<string>();

    events.forEach((item, idx) => {
      const rowNum = idx + 1;
      if (!item.code || typeof item.code !== "string" || !item.code.trim()) {
        validationErrors.push(`ردیف ${rowNum}: فیلد 'code' الزامی است.`);
        return;
      }

      const cleanCode = item.code.trim().toUpperCase();
      if (seenCodesInFile.has(cleanCode)) {
        validationErrors.push(`ردیف ${rowNum}: کد رویداد '${cleanCode}' در فایل تکراری است.`);
      }
      seenCodesInFile.add(cleanCode);

      if (!item.offeringCode || typeof item.offeringCode !== "string" || !item.offeringCode.trim()) {
        validationErrors.push(`ردیف ${rowNum} (کد ${cleanCode}): فیلد 'offeringCode' الزامی است.`);
      }

      if (!Array.isArray(item.slots) || item.slots.length === 0) {
        validationErrors.push(
          `ردیف ${rowNum} (کد ${cleanCode}): داشتن حداقل یک اسلات کلاسی ('slots') الزامی است.`
        );
      } else {
        item.slots.forEach((slot, sIdx) => {
          if (typeof slot.dayOfWeek !== "number" || slot.dayOfWeek < 0 || slot.dayOfWeek > 5) {
            validationErrors.push(
              `ردیف ${rowNum} (جلسه ${sIdx + 1}): روز هفته نامعتبر است (باید عددی بین ۰ تا ۵ باشد).`
            );
          }
          if (!slot.startTime || !slot.endTime) {
            validationErrors.push(
              `ردیف ${rowNum} (جلسه ${sIdx + 1}): ساعت شروع و پایان الزامی هستند.`
            );
          }
        });
      }
    });

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "داده‌های فایل دارای خطاهای اعتبارسنجی است.",
          errors: validationErrors,
        },
        { status: 400 }
      );
    }

    // 4. Execution Pass (Upsert)
    let createdCount = 0;
    let updatedCount = 0;
    let totalSlots = 0;
    const warnings: string[] = [];

    for (const item of events) {
      const cleanCode = item.code.trim().toUpperCase();
      const cleanOfferingCode = item.offeringCode.trim().toUpperCase();
      const offering = offeringMap.get(cleanOfferingCode);

      if (!offering) {
        warnings.push(
          `رویداد ${cleanCode}: ارائه با کد '${cleanOfferingCode}' در پایگاه‌داده یافت نشد؛ رد شد.`
        );
        continue;
      }

      const formattedSlots = item.slots.map((s) => ({
        dayOfWeek: Number(s.dayOfWeek),
        startTime: String(s.startTime).trim(),
        endTime: String(s.endTime).trim(),
      }));

      const existingEvent = existingMap.get(cleanCode);

      if (existingEvent) {
        // Update existing event
        await updateEvent(existingEvent.id, {
          code: cleanCode,
          offeringId: offering.id,
          term,
          location: item.location || "",
          examDate: item.examDate || "",
          examStartTime: item.examStartTime || "",
          examEndTime: item.examEndTime || "",
          slots: formattedSlots,
        });
        updatedCount++;
      } else {
        // Create new event
        await createEvent({
          code: cleanCode,
          offeringId: offering.id,
          term,
          location: item.location || "",
          examDate: item.examDate || "",
          examStartTime: item.examStartTime || "",
          examEndTime: item.examEndTime || "",
          slots: formattedSlots,
        });
        createdCount++;
      }

      totalSlots += formattedSlots.length;
    }

    return NextResponse.json({
      success: true,
      message: `پردازش با موفقیت انجام شد: ${createdCount} رویداد جدید ایجاد شد و ${updatedCount} رویداد به‌روزرسانی گردید.`,
      stats: {
        created: createdCount,
        updated: updatedCount,
        totalSlots,
        warnings,
      },
    });
  } catch (error: any) {
    console.error("Events import error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "خطا در ورود رویدادها" },
      { status: 500 }
    );
  }
}
