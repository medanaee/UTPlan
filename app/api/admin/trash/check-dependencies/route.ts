import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export interface ConflictItem {
  id: string; // unique conflict id, e.g. "dep_offering_123"
  sourceEntityType: "course" | "professor" | "offering" | "event";
  sourceEntityId: string;
  sourceEntityName: string;
  relationType: "offering" | "prerequisite" | "track_assignment" | "chart_course" | "event" | "offering_professor" | "student_event_selection";
  dependentEntityType: "course" | "professor" | "offering" | "event" | "prerequisite" | "track_assignment" | "chart_course" | "offering_professor";
  dependentEntityId: string;
  dependentEntityName: string;
  description: string;
  allowedActions: Array<"replace" | "cascade_delete" | "unlink">;
  requiresCascadeInspection: boolean; // if true, choosing cascade_delete triggers inspect on dependentEntity
  replacementCandidates?: Array<{ id: string; label: string; code?: string }>;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const body = await request.json();
    const { entityType, entityId } = body || {};

    if (!entityType || !entityId) {
      return NextResponse.json({ success: false, message: "نوع و شناسه موجودیت الزامی است." }, { status: 400 });
    }

    const d1 = getD1();
    if (!d1) {
      return NextResponse.json({ success: false, message: "پایگاه داده در دسترس نیست." }, { status: 500 });
    }

    const dependencies: ConflictItem[] = [];

    // ----------------------------------------------------
    // 1. COURSE DEPENDENCIES
    // ----------------------------------------------------
    if (entityType === "course") {
      const courseRow = await d1.prepare("SELECT id, name, code, faculty_id FROM courses WHERE id = ?").bind(entityId).first();
      const courseName = courseRow ? `${courseRow.name} (${courseRow.code || "بدون کد"})` : "این درس";

      // A. Offerings
      const { results: offerings } = await d1
        .prepare("SELECT id, code, description FROM course_offerings WHERE course_id = ?")
        .bind(entityId)
        .all();

      // Replacement candidate courses
      const { results: otherCourses } = await d1
        .prepare("SELECT id, name, code, units FROM courses WHERE id != ? AND deleted_at IS NULL ORDER BY name ASC")
        .bind(entityId)
        .all();

      const courseCandidates = (otherCourses || []).map((c: any) => ({
        id: c.id as string,
        label: `${c.name} (${c.code || "بدون کد"}) - ${c.units || 3} واحد`,
        code: c.code as string,
      }));

      for (const off of offerings || []) {
        dependencies.push({
          id: `dep_offering_${off.id}`,
          sourceEntityType: "course",
          sourceEntityId: entityId,
          sourceEntityName: courseName,
          relationType: "offering",
          dependentEntityType: "offering",
          dependentEntityId: off.id as string,
          dependentEntityName: `ارائه با کد ${off.code || "بدون کد"} (${off.description || "بدون توضیحات"})`,
          description: `این درس دارای ارائه درسی با کد «${off.code || "بدون کد"}» است. برای حذف درس، این ارائه باید با درس دیگری جایگزین شود یا خود ارائه نیز حذف گردد.`,
          allowedActions: ["replace", "cascade_delete"],
          requiresCascadeInspection: true,
          replacementCandidates: courseCandidates,
        });
      }

      // B. Prerequisites where this course is required
      const { results: prereqs } = await d1
        .prepare(
          `SELECT p.id, p.course_id, c.name as dependent_course_name, c.code as dependent_course_code, p.type
           FROM prerequisites p
           JOIN courses c ON p.course_id = c.id
           WHERE p.prerequisite_course_id = ?`
        )
        .bind(entityId)
        .all();

      for (const pr of prereqs || []) {
        const typeLabel = pr.type === "corequisite" ? "هم‌نیاز" : "پیش‌نیاز";
        dependencies.push({
          id: `dep_prereq_${pr.id}`,
          sourceEntityType: "course",
          sourceEntityId: entityId,
          sourceEntityName: courseName,
          relationType: "prerequisite",
          dependentEntityType: "prerequisite",
          dependentEntityId: pr.id as string,
          dependentEntityName: `${typeLabel} برای درس ${pr.dependent_course_name} (${pr.dependent_course_code || "-"})`,
          description: `این درس به عنوان ${typeLabel} برای درس «${pr.dependent_course_name}» تعریف شده است.`,
          allowedActions: ["replace", "unlink"],
          requiresCascadeInspection: false,
          replacementCandidates: courseCandidates,
        });
      }

      // C. Track Assignments
      const { results: trackAssigns } = await d1
        .prepare(
          `SELECT a.id, a.track_id, t.name as track_name, m.name as major_name
           FROM track_course_assignments a
           JOIN tracks t ON a.track_id = t.id
           JOIN majors m ON t.major_id = m.id
           WHERE a.course_id = ?`
        )
        .bind(entityId)
        .all();

      for (const ta of trackAssigns || []) {
        dependencies.push({
          id: `dep_track_${ta.id}`,
          sourceEntityType: "course",
          sourceEntityId: entityId,
          sourceEntityName: courseName,
          relationType: "track_assignment",
          dependentEntityType: "track_assignment",
          dependentEntityId: ta.id as string,
          dependentEntityName: `چارت گرایش ${ta.track_name} (رشته ${ta.major_name})`,
          description: `این درس در چارت گرایش «${ta.track_name}» انتساب داده شده است.`,
          allowedActions: ["replace", "unlink"],
          requiresCascadeInspection: false,
          replacementCandidates: courseCandidates,
        });
      }

      // D. Student Chart Courses
      const chartCountRow = await d1
        .prepare("SELECT count(*) as count FROM chart_courses WHERE course_id = ?")
        .bind(entityId)
        .first();
      const chartCount = Number(chartCountRow?.count) || 0;

      if (chartCount > 0) {
        dependencies.push({
          id: `dep_chart_courses_${entityId}`,
          sourceEntityType: "course",
          sourceEntityId: entityId,
          sourceEntityName: courseName,
          relationType: "chart_course",
          dependentEntityType: "chart_course",
          dependentEntityId: entityId,
          dependentEntityName: `انتخاب توسط دانشجویان (${chartCount} چارت دانشجو)`,
          description: `این درس در چارت تحصیلی ${chartCount} دانشجو انتخاب شده است.`,
          allowedActions: ["replace", "unlink"],
          requiresCascadeInspection: false,
          replacementCandidates: courseCandidates,
        });
      }
    }

    // ----------------------------------------------------
    // 2. PROFESSOR DEPENDENCIES
    // ----------------------------------------------------
    else if (entityType === "professor") {
      const profRow = await d1.prepare("SELECT id, first_name, last_name, code FROM professors WHERE id = ?").bind(entityId).first();
      const profName = profRow ? `${profRow.first_name} ${profRow.last_name}` : "این استاد";

      // Offerings taught
      const { results: offProfs } = await d1
        .prepare(
          `SELECT op.id, op.offering_id, o.code as offering_code, c.name as course_name, c.code as course_code
           FROM offering_professors op
           JOIN course_offerings o ON op.offering_id = o.id
           JOIN courses c ON o.course_id = c.id
           WHERE op.professor_id = ?`
        )
        .bind(entityId)
        .all();

      // Candidate professors
      const { results: otherProfs } = await d1
        .prepare("SELECT id, first_name, last_name, code, title FROM professors WHERE id != ? AND deleted_at IS NULL ORDER BY last_name, first_name ASC")
        .bind(entityId)
        .all();

      const profCandidates = (otherProfs || []).map((p: any) => ({
        id: p.id as string,
        label: `${p.first_name} ${p.last_name} (${p.title || "استاد"}) - کد: ${p.code || "-"}`,
        code: p.code as string,
      }));

      for (const op of offProfs || []) {
        dependencies.push({
          id: `dep_offprof_${op.id}`,
          sourceEntityType: "professor",
          sourceEntityId: entityId,
          sourceEntityName: profName,
          relationType: "offering_professor",
          dependentEntityType: "offering_professor",
          dependentEntityId: op.id as string,
          dependentEntityName: `تدریس در ارائه درس ${op.course_name} (${op.offering_code || "کد نامشخص"})`,
          description: `این استاد مدرس ارائه «${op.course_name} (${op.offering_code || "-"})» است.`,
          allowedActions: ["replace", "unlink"],
          requiresCascadeInspection: false,
          replacementCandidates: profCandidates,
        });
      }
    }

    // ----------------------------------------------------
    // 3. OFFERING DEPENDENCIES
    // ----------------------------------------------------
    else if (entityType === "offering") {
      const offRow = await d1
        .prepare(
          `SELECT o.id, o.code, o.course_id, c.name as course_name
           FROM course_offerings o
           JOIN courses c ON o.course_id = c.id
           WHERE o.id = ?`
        )
        .bind(entityId)
        .first();

      const offeringName = offRow ? `ارائه درس ${(offRow as any).course_name} (کد ${(offRow as any).code || "-"})` : "این ارائه";
      const courseId = offRow ? (offRow as any).course_id : "";

      // Candidate offerings (other offerings of same or other courses)
      const { results: otherOfferings } = await d1
        .prepare(
          `SELECT o.id, o.code, c.name as course_name
           FROM course_offerings o
           JOIN courses c ON o.course_id = c.id
           WHERE o.id != ? AND o.deleted_at IS NULL
           ORDER BY c.name ASC`
        )
        .bind(entityId)
        .all();

      const offeringCandidates = (otherOfferings || []).map((o: any) => ({
        id: o.id as string,
        label: `ارائه ${o.course_name} (کد: ${o.code || "ندارد"})`,
        code: o.code as string,
      }));

      // Events belonging to this offering
      const { results: events } = await d1
        .prepare("SELECT id, code, term, location FROM course_events WHERE offering_id = ?")
        .bind(entityId)
        .all();

      for (const evt of events || []) {
        dependencies.push({
          id: `dep_event_${evt.id}`,
          sourceEntityType: "offering",
          sourceEntityId: entityId,
          sourceEntityName: offeringName,
          relationType: "event",
          dependentEntityType: "event",
          dependentEntityId: evt.id as string,
          dependentEntityName: `رویداد کلاسی کد ${evt.code || "بدون کد"} (نیمسال ${evt.term})`,
          description: `این ارائه دارای رویداد کلاسی در نیمسال «${evt.term}» (محل: ${evt.location || "نامشخص"}) است. با حذف ارائه، این رویداد باید به ارائه دیگری منتقل شود یا حذف گردد.`,
          allowedActions: ["replace", "cascade_delete"],
          requiresCascadeInspection: true,
          replacementCandidates: offeringCandidates,
        });
      }
    }

    // ----------------------------------------------------
    // 4. EVENT DEPENDENCIES
    // ----------------------------------------------------
    else if (entityType === "event") {
      const evtRow = await d1
        .prepare(
          `SELECT e.id, e.code, e.term, e.offering_id, c.name as course_name
           FROM course_events e
           JOIN course_offerings o ON e.offering_id = o.id
           JOIN courses c ON o.course_id = c.id
           WHERE e.id = ?`
        )
        .bind(entityId)
        .first();

      const eventName = evtRow ? `رویداد کلاسی ${(evtRow as any).course_name} (کد ${(evtRow as any).code || "-"})` : "این رویداد";
      const offeringId = evtRow ? (evtRow as any).offering_id : "";
      const term = evtRow ? (evtRow as any).term : "";

      // Student chart selections of this event
      const chartEventCountRow = await d1
        .prepare("SELECT count(*) as count FROM chart_courses WHERE selected_event_id = ?")
        .bind(entityId)
        .first();
      const chartEventCount = Number(chartEventCountRow?.count) || 0;

      if (chartEventCount > 0) {
        // Candidate alternate events in same offering or term
        const { results: otherEvents } = await d1
          .prepare(
            `SELECT e.id, e.code, e.location, c.name as course_name
             FROM course_events e
             JOIN course_offerings o ON e.offering_id = o.id
             JOIN courses c ON o.course_id = c.id
             WHERE e.id != ? AND e.term = ? AND e.deleted_at IS NULL`
          )
          .bind(entityId, term)
          .all();

        const eventCandidates = (otherEvents || []).map((e: any) => ({
          id: e.id as string,
          label: `${e.course_name} - کد: ${e.code || "-"} (${e.location || "بدون محل"})`,
          code: e.code as string,
        }));

        dependencies.push({
          id: `dep_event_charts_${entityId}`,
          sourceEntityType: "event",
          sourceEntityId: entityId,
          sourceEntityName: eventName,
          relationType: "student_event_selection",
          dependentEntityType: "chart_course",
          dependentEntityId: entityId,
          dependentEntityName: `انتخاب برنامه هفتگی دانشجویان (${chartEventCount} دانشجو)`,
          description: `این رویداد در برنامه هفتگی و چارت ${chartEventCount} دانشجو انتخاب شده است. می‌توانید آن را با رویداد دیگری جایگزین کنید یا انتخاب دانشجو را خالی نمایید.`,
          allowedActions: ["replace", "unlink"],
          requiresCascadeInspection: false,
          replacementCandidates: eventCandidates,
        });
      }
    }

    return NextResponse.json({
      success: true,
      safeToDeleteDirectly: dependencies.length === 0,
      dependencies,
    });
  } catch (err: any) {
    console.error("Check dependencies error:", err);
    return NextResponse.json({ success: false, message: "خطا در استعلام وابستگی‌ها: " + err?.message }, { status: 500 });
  }
}
