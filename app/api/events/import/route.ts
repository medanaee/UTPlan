import { apiResponseJson, withApiTiming } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { getOfferings, getD1, logAdminAction } from "@/lib/db";
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

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function POSTHandler(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;

    const body: any = await request.json();
    const { term, facultyId, events } = body as {
      term: string;
      facultyId?: string;
      events: IncomingEvent[];
    };

    if (!term || typeof term !== "string" || !term.trim()) {
      return apiResponseJson(
        { success: false, message: "نیمسال تحصیلی هدف (term) مشخص نشده است." },
        { status: 400 }
      );
    }

    if (!Array.isArray(events) || events.length === 0) {
      return apiResponseJson(
        { success: false, message: "هیچ رویدادی برای ورود ارسال نشده است یا آرایه خالی است." },
        { status: 400 }
      );
    }

    const d1 = getD1();
    if (!d1) {
      return apiResponseJson({ success: false, message: "پایگاه داده در دسترس نیست." }, { status: 500 });
    }

    // 1. Fetch available offerings for matching
    const allOfferings = await getOfferings(facultyId);
    const offeringMap = new Map<string, (typeof allOfferings)[0]>();
    for (const off of allOfferings) {
      if (off.code) {
        offeringMap.set(off.code.trim().toUpperCase(), off);
      }
    }

    // 2. Fetch existing events in target term for code matching (Upsert - including soft-deleted)
    const { results: existingRows } = await d1
      .prepare("SELECT id, code, offering_id FROM course_events WHERE term = ?")
      .bind(term)
      .all();

    const existingMap = new Map<string, any>();
    for (const evt of existingRows || []) {
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
      return apiResponseJson(
        {
          success: false,
          message: "داده‌های فایل دارای خطاهای اعتبارسنجی است.",
          errors: validationErrors,
        },
        { status: 400 }
      );
    }

    // 4. Execution Pass (Upsert with D1 batch)
    let createdCount = 0;
    let updatedCount = 0;
    let totalSlots = 0;
    const warnings: string[] = [];
    const stmts: any[] = [];
    const now = new Date().toISOString();

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
        stmts.push(
          d1.prepare(`
            UPDATE course_events
            SET offering_id = ?, location = ?, exam_date = ?, exam_start_time = ?, exam_end_time = ?,
                is_user_custom = 0, user_id = NULL, deleted_at = NULL
            WHERE id = ?
          `).bind(
            offering.id,
            item.location || "",
            item.examDate || "",
            item.examStartTime || "",
            item.examEndTime || "",
            existingEvent.id
          )
        );

        // Remove old slots and insert new slots
        stmts.push(
          d1.prepare("DELETE FROM course_event_slots WHERE event_id = ?").bind(existingEvent.id)
        );

        for (const slot of formattedSlots) {
          const slotId = `slot_${crypto.randomUUID().slice(0, 8)}`;
          stmts.push(
            d1.prepare("INSERT INTO course_event_slots (id, event_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?)")
              .bind(slotId, existingEvent.id, slot.dayOfWeek, slot.startTime, slot.endTime)
          );
        }
        updatedCount++;
      } else {
        // Create new event
        const newEventId = `evt_${crypto.randomUUID().slice(0, 8)}`;
        stmts.push(
          d1.prepare(`
            INSERT INTO course_events (id, code, offering_id, term, location, exam_date, exam_start_time, exam_end_time, is_user_custom, user_id, created_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, NULL)
          `).bind(
            newEventId,
            cleanCode,
            offering.id,
            term,
            item.location || "",
            item.examDate || "",
            item.examStartTime || "",
            item.examEndTime || "",
            now
          )
        );

        for (const slot of formattedSlots) {
          const slotId = `slot_${crypto.randomUUID().slice(0, 8)}`;
          stmts.push(
            d1.prepare("INSERT INTO course_event_slots (id, event_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?)")
              .bind(slotId, newEventId, slot.dayOfWeek, slot.startTime, slot.endTime)
          );
        }
        createdCount++;
        existingMap.set(cleanCode, { id: newEventId, code: cleanCode, offering_id: offering.id });
      }

      totalSlots += formattedSlots.length;
    }

    if (stmts.length > 0) {
      for (const bChunk of chunkArray(stmts, 50)) {
        await d1.batch(bChunk);
      }
    }

    await logAdminAction({
      userId: auth.user!.id,
      userName: auth.user!.name,
      userEmail: auth.user!.email,
      action: "IMPORT",
      entityType: "event",
      entityId: term,
      entityName: `ورود دسته‌ای رویدادهای کلاسی ترم ${term} (${createdCount} جدید، ${updatedCount} ویرایش)`,
      details: {
        term,
        facultyId,
        totalEventsReceived: events.length,
        createdCount,
        updatedCount,
        totalSlots,
        warningsCount: warnings.length,
        warnings: warnings.slice(0, 10),
      },
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    });

    return apiResponseJson({
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
    return apiResponseJson(
      { success: false, message: error?.message || "خطا در ورود رویدادها" },
      { status: 500 }
    );
  }
}

export const POST = withApiTiming(POSTHandler);
