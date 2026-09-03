import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export interface ConflictItem {
  id: string;
  sourceEntityType: "course" | "professor" | "offering" | "event";
  sourceEntityId: string;
  sourceEntityName: string;
  relationType: "offering" | "prerequisite" | "track_assignment" | "chart_course" | "event" | "offering_professor" | "student_event_selection";
  dependentEntityType: "course" | "professor" | "offering" | "event" | "prerequisite" | "track_assignment" | "chart_course" | "offering_professor";
  dependentEntityId: string;
  dependentEntityName: string;
  description: string;
  allowedActions: Array<"replace" | "cascade_delete" | "unlink" | "trash_delete">;
  requiresCascadeInspection: boolean;
  isDependentInTrash?: boolean;
  replacementCandidates?: Array<{ id: string; label: string; code?: string }>;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const body = await request.json();
    const rawItems: Array<{ type: string; id: string }> =
      body?.items || (body?.entityType && body?.entityId ? [{ type: body.entityType, id: body.entityId }] : []);

    if (rawItems.length === 0) {
      return NextResponse.json({ success: false, message: "هیچ موجودیتی برای بررسی مشخص نشده است." }, { status: 400 });
    }

    const d1 = getD1();
    if (!d1) {
      return NextResponse.json({ success: false, message: "پایگاه داده در دسترس نیست." }, { status: 500 });
    }

    // Set of all items slated for deletion in this operation (for mutual conflict suppression)
    const selectedDeleteKeys = new Set(rawItems.map((it) => `${it.type}:${it.id}`));

    const dependencies: ConflictItem[] = [];
    const seenConflictIds = new Set<string>();

    for (const item of rawItems) {
      const entityType = item.type;
      const entityId = item.id;

      // ----------------------------------------------------
      // 1. COURSE DEPENDENCIES
      // ----------------------------------------------------
      if (entityType === "course") {
        const courseRow = await d1
          .prepare("SELECT id, name, code, faculty_id FROM courses WHERE id = ?")
          .bind(entityId)
          .first();
        const courseName = courseRow ? `${(courseRow as any).name} (کد درس: ${(courseRow as any).code || "-"})` : "این درس";

        // Candidate courses (excluding all items currently in delete batch)
        const { results: otherCourses } = await d1
          .prepare("SELECT id, name, code, units FROM courses WHERE deleted_at IS NULL ORDER BY name ASC")
          .all();

        const courseCandidates = (otherCourses || [])
          .filter((c: any) => !selectedDeleteKeys.has(`course:${c.id}`))
          .map((c: any) => ({
            id: c.id as string,
            label: `${c.name} (${c.code || "بدون کد"}) - ${c.units || 3} واحد`,
            code: c.code as string,
          }));

        // A. Offerings
        const { results: offerings } = await d1
          .prepare("SELECT id, code, description, deleted_at FROM course_offerings WHERE course_id = ?")
          .bind(entityId)
          .all();

        for (const off of offerings || []) {
          // Rule 1: If offering is already in delete batch, ignore this conflict!
          if (selectedDeleteKeys.has(`offering:${off.id}`)) continue;

          const conflictKey = `dep_offering_${off.id}`;
          if (seenConflictIds.has(conflictKey)) continue;
          seenConflictIds.add(conflictKey);

          const isTrashed = Boolean(off.deleted_at);
          const allowedActions: Array<"replace" | "cascade_delete" | "trash_delete"> = isTrashed
            ? ["trash_delete", "replace"]
            : ["replace", "cascade_delete"];

          dependencies.push({
            id: conflictKey,
            sourceEntityType: "course",
            sourceEntityId: entityId,
            sourceEntityName: courseName,
            relationType: "offering",
            dependentEntityType: "offering",
            dependentEntityId: off.id as string,
            dependentEntityName: `ارائه با کد ${off.code || "-"} (درس ${courseName})`,
            description: isTrashed
              ? `درس «${courseName}» دارای ارائه با کد «${off.code || "-"}» است که هم‌اکنون در سطل بازیافت قرار دارد. می‌توانید آن را نیز مستقیماً به طور دائمی پاک کنید.`
              : `درس «${courseName}» دارای ارائه درسی فعال با کد «${off.code || "-"}» است. برای حذف درس، این ارائه باید با درس دیگری جایگزین شود یا خود ارائه نیز حذف گردد.`,
            allowedActions,
            requiresCascadeInspection: !isTrashed,
            isDependentInTrash: isTrashed,
            replacementCandidates: courseCandidates,
          });
        }

        // B. Prerequisites where this course is required
        const { results: prereqs } = await d1
          .prepare(
            `SELECT p.id, p.course_id, c.name as dependent_course_name, c.code as dependent_course_code, c.deleted_at, p.type
             FROM prerequisites p
             JOIN courses c ON p.course_id = c.id
             WHERE p.required_course_id = ?`
          )
          .bind(entityId)
          .all();

        for (const pr of prereqs || []) {
          // If the dependent course is also in delete batch, skip!
          if (selectedDeleteKeys.has(`course:${pr.course_id}`)) continue;

          const conflictKey = `dep_prereq_${pr.id}`;
          if (seenConflictIds.has(conflictKey)) continue;
          seenConflictIds.add(conflictKey);

          const typeLabel = pr.type === "corequisite" ? "هم‌نیاز" : "پیش‌نیاز";
          const isTrashed = Boolean(pr.deleted_at);

          dependencies.push({
            id: conflictKey,
            sourceEntityType: "course",
            sourceEntityId: entityId,
            sourceEntityName: courseName,
            relationType: "prerequisite",
            dependentEntityType: "prerequisite",
            dependentEntityId: pr.id as string,
            dependentEntityName: `${typeLabel} برای درس ${pr.dependent_course_name} (کد: ${pr.dependent_course_code || "-"})`,
            description: `درس «${courseName}» به عنوان ${typeLabel} برای درس «${pr.dependent_course_name}» (${pr.dependent_course_code || "-"}) تعریف شده است.`,
            allowedActions: ["replace", "unlink"],
            requiresCascadeInspection: false,
            isDependentInTrash: isTrashed,
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
          const conflictKey = `dep_track_${ta.id}`;
          if (seenConflictIds.has(conflictKey)) continue;
          seenConflictIds.add(conflictKey);

          dependencies.push({
            id: conflictKey,
            sourceEntityType: "course",
            sourceEntityId: entityId,
            sourceEntityName: courseName,
            relationType: "track_assignment",
            dependentEntityType: "track_assignment",
            dependentEntityId: ta.id as string,
            dependentEntityName: `چارت گرایش ${ta.track_name} (رشته ${ta.major_name})`,
            description: `درس «${courseName}» در چارت گرایش «${ta.track_name}» (رشته ${ta.major_name}) انتساب داده شده است.`,
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
          const conflictKey = `dep_chart_courses_${entityId}`;
          if (!seenConflictIds.has(conflictKey)) {
            seenConflictIds.add(conflictKey);
            dependencies.push({
              id: conflictKey,
              sourceEntityType: "course",
              sourceEntityId: entityId,
              sourceEntityName: courseName,
              relationType: "chart_course",
              dependentEntityType: "chart_course",
              dependentEntityId: entityId,
              dependentEntityName: `انتخاب توسط دانشجویان (${chartCount} چارت دانشجو)`,
              description: `درس «${courseName}» در چارت تحصیلی ${chartCount} دانشجو انتخاب شده است.`,
              allowedActions: ["replace", "unlink"],
              requiresCascadeInspection: false,
              replacementCandidates: courseCandidates,
            });
          }
        }
      }

      // ----------------------------------------------------
      // 2. PROFESSOR DEPENDENCIES
      // ----------------------------------------------------
      else if (entityType === "professor") {
        const profRow = await d1
          .prepare("SELECT id, first_name, last_name, code FROM professors WHERE id = ?")
          .bind(entityId)
          .first();
        const profName = profRow ? `${(profRow as any).first_name} ${(profRow as any).last_name} (کد: ${(profRow as any).code || "-"})` : "این استاد";

        // Offerings taught
        const { results: offProfs } = await d1
          .prepare(
            `SELECT op.id, op.offering_id, o.code as offering_code, o.deleted_at as offering_deleted_at, c.name as course_name, c.code as course_code
             FROM offering_professors op
             JOIN course_offerings o ON op.offering_id = o.id
             JOIN courses c ON o.course_id = c.id
             WHERE op.professor_id = ?`
          )
          .bind(entityId)
          .all();

        // Candidate professors
        const { results: otherProfs } = await d1
          .prepare("SELECT id, first_name, last_name, code, title FROM professors WHERE deleted_at IS NULL ORDER BY last_name, first_name ASC")
          .all();

        const profCandidates = (otherProfs || [])
          .filter((p: any) => !selectedDeleteKeys.has(`professor:${p.id}`))
          .map((p: any) => ({
            id: p.id as string,
            label: `${p.first_name} ${p.last_name} (${p.title || "استاد"}) - کد: ${p.code || "-"}`,
            code: p.code as string,
          }));

        for (const op of offProfs || []) {
          // If offering is also in delete batch, ignore!
          if (selectedDeleteKeys.has(`offering:${op.offering_id}`)) continue;

          const conflictKey = `dep_offprof_${op.id}`;
          if (seenConflictIds.has(conflictKey)) continue;
          seenConflictIds.add(conflictKey);

          const isOfferingTrashed = Boolean(op.offering_deleted_at);

          dependencies.push({
            id: conflictKey,
            sourceEntityType: "professor",
            sourceEntityId: entityId,
            sourceEntityName: profName,
            relationType: "offering_professor",
            dependentEntityType: "offering_professor",
            dependentEntityId: op.id as string,
            dependentEntityName: `تدریس در ارائه درس ${op.course_name} (کد ارائه: ${op.offering_code || "-"} | کد درس: ${op.course_code || "-"})`,
            description: `استاد «${profName}» مدرس ارائه درس «${op.course_name}» (کد ارائه: ${op.offering_code || "-"}) است.${
              isOfferingTrashed ? " (این ارائه در سطل بازیافت قرار دارد)" : ""
            }`,
            allowedActions: ["replace", "unlink"],
            requiresCascadeInspection: false,
            isDependentInTrash: isOfferingTrashed,
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
            `SELECT o.id, o.code, o.course_id, c.name as course_name, c.code as course_code
             FROM course_offerings o
             LEFT JOIN courses c ON o.course_id = c.id
             WHERE o.id = ?`
          )
          .bind(entityId)
          .first();

        const courseName = (offRow as any)?.course_name || "نامشخص";
        const courseCode = (offRow as any)?.course_code;
        const offCode = (offRow as any)?.code || "-";
        const offeringName = `ارائه درس ${courseName} (کد ارائه: ${offCode}${courseCode ? ` | کد درس: ${courseCode}` : ""})`;

        // Candidate offerings
        const { results: otherOfferings } = await d1
          .prepare(
            `SELECT o.id, o.code, c.name as course_name, c.code as course_code
             FROM course_offerings o
             JOIN courses c ON o.course_id = c.id
             WHERE o.deleted_at IS NULL
             ORDER BY c.name ASC`
          )
          .all();

        const offeringCandidates = (otherOfferings || [])
          .filter((o: any) => !selectedDeleteKeys.has(`offering:${o.id}`))
          .map((o: any) => ({
            id: o.id as string,
            label: `ارائه ${o.course_name} (کد ارائه: ${o.code || "-"}${o.course_code ? ` | کد درس: ${o.course_code}` : ""})`,
            code: o.code as string,
          }));

        // Events belonging to this offering
        const { results: events } = await d1
          .prepare("SELECT id, code, term, location, deleted_at FROM course_events WHERE offering_id = ?")
          .bind(entityId)
          .all();

        for (const evt of events || []) {
          // If event is also in delete batch, ignore!
          if (selectedDeleteKeys.has(`event:${evt.id}`)) continue;

          const conflictKey = `dep_event_${evt.id}`;
          if (seenConflictIds.has(conflictKey)) continue;
          seenConflictIds.add(conflictKey);

          const isEventTrashed = Boolean(evt.deleted_at);
          const allowedActions: Array<"replace" | "cascade_delete" | "trash_delete"> = isEventTrashed
            ? ["trash_delete", "replace"]
            : ["replace", "cascade_delete"];

          dependencies.push({
            id: conflictKey,
            sourceEntityType: "offering",
            sourceEntityId: entityId,
            sourceEntityName: offeringName,
            relationType: "event",
            dependentEntityType: "event",
            dependentEntityId: evt.id as string,
            dependentEntityName: `رویداد کلاسی کد ${evt.code || "بدون کد"} (نیمسال ${evt.term})`,
            description: isEventTrashed
              ? `ارائه «${offeringName}» دارای رویداد کلاسی با کد «${evt.code || "-"}» در نیمسال «${evt.term}» است که در سطل بازیافت قرار دارد. می‌توانید آن را نیز مستقیماً پاک کنید.`
              : `ارائه «${offeringName}» دارای رویداد کلاسی فعال با کد «${evt.code || "-"}» در نیمسال «${evt.term}» (محل: ${evt.location || "نامشخص"}) است. با حذف این ارائه، این رویداد کلاسی باید به ارائه دیگری منتقل شود یا حذف گردد.`,
            allowedActions,
            requiresCascadeInspection: !isEventTrashed,
            isDependentInTrash: isEventTrashed,
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
            `SELECT e.id, e.code, e.term, e.offering_id, o.code as offering_code, c.name as course_name, c.code as course_code
             FROM course_events e
             JOIN course_offerings o ON e.offering_id = o.id
             JOIN courses c ON o.course_id = c.id
             WHERE e.id = ?`
          )
          .bind(entityId)
          .first();

        const courseName = (evtRow as any)?.course_name || "نامشخص";
        const courseCode = (evtRow as any)?.course_code;
        const offCode = (evtRow as any)?.offering_code || "-";
        const evtCode = (evtRow as any)?.code || "-";
        const eventName = `رویداد کلاسی درس ${courseName} (کد رویداد: ${evtCode} | کد ارائه: ${offCode}${courseCode ? ` | کد درس: ${courseCode}` : ""})`;
        const term = evtRow ? (evtRow as any).term : "";

        // Student chart selections of this event
        const chartEventCountRow = await d1
          .prepare("SELECT count(*) as count FROM chart_courses WHERE selected_event_id = ?")
          .bind(entityId)
          .first();
        const chartEventCount = Number(chartEventCountRow?.count) || 0;

        if (chartEventCount > 0) {
          const { results: otherEvents } = await d1
            .prepare(
              `SELECT e.id, e.code, e.location, o.code as offering_code, c.name as course_name, c.code as course_code
               FROM course_events e
               JOIN course_offerings o ON e.offering_id = o.id
               JOIN courses c ON o.course_id = c.id
               WHERE e.term = ? AND e.deleted_at IS NULL`
            )
            .bind(term)
            .all();

          const eventCandidates = (otherEvents || [])
            .filter((e: any) => !selectedDeleteKeys.has(`event:${e.id}`))
            .map((e: any) => ({
              id: e.id as string,
              label: `${e.course_name} (کد رویداد: ${e.code || "-"} | ارائه: ${e.offering_code || "-"} | محل: ${e.location || "نامشخص"})`,
              code: e.code as string,
            }));

          const conflictKey = `dep_event_charts_${entityId}`;
          if (!seenConflictIds.has(conflictKey)) {
            seenConflictIds.add(conflictKey);
            dependencies.push({
              id: conflictKey,
              sourceEntityType: "event",
              sourceEntityId: entityId,
              sourceEntityName: eventName,
              relationType: "student_event_selection",
              dependentEntityType: "chart_course",
              dependentEntityId: entityId,
              dependentEntityName: `انتخاب برنامه هفتگی دانشجویان (${chartEventCount} دانشجو)`,
              description: `رویداد «${eventName}» در برنامه هفتگی و چارت تحصیلی ${chartEventCount} دانشجو انتخاب شده است. می‌توانید آن را با رویداد دیگری جایگزین کنید یا انتخاب دانشجو را خالی نمایید.`,
              allowedActions: ["replace", "unlink"],
              requiresCascadeInspection: false,
              replacementCandidates: eventCandidates,
            });
          }
        }
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
