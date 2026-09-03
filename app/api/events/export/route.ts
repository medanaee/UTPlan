import { NextRequest, NextResponse } from "next/server";
import { getEvents, getOfferings, getFaculties } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;

    const { searchParams } = new URL(request.url);
    const term = searchParams.get("term");
    const facultyId = searchParams.get("facultyId") || undefined;

    if (!term) {
      return NextResponse.json(
        { success: false, message: "نیمسال تحصیلی (term) الزامی است." },
        { status: 400 }
      );
    }

    // Fetch events for this semester and faculty scope
    const events = await getEvents({ term, facultyId });

    // Fetch offerings to map offering_id -> offering.code
    const offerings = await getOfferings(facultyId);
    const offeringCodeMap = new Map<string, string>();
    for (const o of offerings) {
      if (o.id && o.code) {
        offeringCodeMap.set(o.id, o.code);
      }
    }

    // Build export data without 'term'
    const exportData = events.map((evt) => ({
      code: evt.code || `EVT-${evt.id}`,
      offeringCode: offeringCodeMap.get(evt.offeringId) || "",
      location: evt.location || undefined,
      examDate: evt.examDate || undefined,
      examStartTime: evt.examStartTime || undefined,
      examEndTime: evt.examEndTime || undefined,
      slots: (evt.slots || []).map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
    }));

    let facultySlug = "all";
    if (facultyId) {
      const faculties = await getFaculties();
      const fac = faculties.find((f) => f.id === facultyId);
      if (fac) {
        facultySlug = (fac.code || fac.name).replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, "_");
      }
    }

    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `events-${term}-${facultySlug}-${dateStr}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error: any) {
    console.error("Events export error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "خطا در دریافت خروجی رویدادها" },
      { status: 500 }
    );
  }
}
