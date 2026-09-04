import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export interface ConflictItem {
  id: string;
  sourceEntityType: "course" | "professor" | "offering" | "event" | "faculty" | "major" | "track";
  sourceEntityId: string;
  sourceEntityName: string;
  relationType:
    | "offering"
    | "prerequisite"
    | "track_assignment"
    | "chart_course"
    | "event"
    | "offering_professor"
    | "student_event_selection"
    | "faculty_major"
    | "faculty_course"
    | "faculty_professor"
    | "faculty_user"
    | "major_track"
    | "major_user"
    | "track_assignment"
    | "track_chart"
    | "track_user";
  dependentEntityType:
    | "course"
    | "professor"
    | "offering"
    | "event"
    | "faculty"
    | "major"
    | "track"
    | "prerequisite"
    | "track_assignment"
    | "chart_course"
    | "offering_professor"
    | "user";
  dependentEntityId: string;
  dependentEntityName: string;
  description: string;
  allowedActions: Array<"replace" | "cascade_delete" | "unlink" | "trash_delete">;
  requiresCascadeInspection: boolean;
  isDependentInTrash?: boolean;
  replacementCandidates?: Array<{ id: string; label: string; code?: string }>;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
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

    // Lazy candidate loaders (cached once per request)
    let cachedCourseCandidates: Array<{ id: string; label: string; code?: string }> | null = null;
    const getCourseCandidates = async () => {
      if (!cachedCourseCandidates) {
        const { results: otherCourses } = await d1
          .prepare("SELECT id, name, code, units FROM courses WHERE deleted_at IS NULL ORDER BY name ASC")
          .all();
        cachedCourseCandidates = (otherCourses || []).map((c: any) => ({
          id: c.id as string,
          label: `${c.name} (${c.code || "بدون کد"}) - ${c.units || 3} واحد`,
          code: c.code as string,
        }));
      }
      return cachedCourseCandidates.filter((c) => !selectedDeleteKeys.has(`course:${c.id}`));
    };

    let cachedProfCandidates: Array<{ id: string; label: string; code?: string }> | null = null;
    const getProfCandidates = async () => {
      if (!cachedProfCandidates) {
        const { results: otherProfs } = await d1
          .prepare("SELECT id, first_name, last_name, code, title FROM professors WHERE deleted_at IS NULL ORDER BY last_name, first_name ASC")
          .all();
        cachedProfCandidates = (otherProfs || []).map((p: any) => ({
          id: p.id as string,
          label: `${p.first_name} ${p.last_name} (${p.title || "استاد"}) - کد: ${p.code || "-"}`,
          code: p.code as string,
        }));
      }
      return cachedProfCandidates.filter((p) => !selectedDeleteKeys.has(`professor:${p.id}`));
    };

    let cachedOfferingCandidates: Array<{ id: string; label: string; code?: string }> | null = null;
    const getOfferingCandidates = async () => {
      if (!cachedOfferingCandidates) {
        const { results: otherOfferings } = await d1
          .prepare(
            `SELECT o.id, o.code, c.name as course_name, c.code as course_code
             FROM course_offerings o
             JOIN courses c ON o.course_id = c.id
             WHERE o.deleted_at IS NULL
             ORDER BY c.name ASC`
          )
          .all();
        cachedOfferingCandidates = (otherOfferings || []).map((o: any) => ({
          id: o.id as string,
          label: `ارائه ${o.course_name} (کد ارائه: ${o.code || "-"}${o.course_code ? ` | کد درس: ${o.course_code}` : ""})`,
          code: o.code as string,
        }));
      }
      return cachedOfferingCandidates.filter((o) => !selectedDeleteKeys.has(`offering:${o.id}`));
    };

    let cachedFacultyCandidates: Array<{ id: string; label: string; code?: string }> | null = null;
    const getFacultyCandidates = async () => {
      if (!cachedFacultyCandidates) {
        const { results: otherFacs } = await d1
          .prepare("SELECT id, name, code FROM faculties WHERE deleted_at IS NULL ORDER BY name ASC")
          .all();
        cachedFacultyCandidates = (otherFacs || []).map((f: any) => ({
          id: f.id as string,
          label: `دانشکده ${f.name} (کد: ${f.code || "-"})`,
          code: f.code as string,
        }));
      }
      return cachedFacultyCandidates.filter((f) => !selectedDeleteKeys.has(`faculty:${f.id}`));
    };

    let cachedMajorCandidates: Array<{ id: string; label: string; code?: string }> | null = null;
    const getMajorCandidates = async () => {
      if (!cachedMajorCandidates) {
        const { results: otherMajors } = await d1
          .prepare(
            `SELECT m.id, m.name, m.code, f.name as faculty_name
             FROM majors m
             LEFT JOIN faculties f ON m.faculty_id = f.id
             WHERE m.deleted_at IS NULL
             ORDER BY m.name ASC`
          )
          .all();
        cachedMajorCandidates = (otherMajors || []).map((m: any) => ({
          id: m.id as string,
          label: `رشته ${m.name} (${m.faculty_name || "-"} | کد: ${m.code || "-"})`,
          code: m.code as string,
        }));
      }
      return cachedMajorCandidates.filter((m) => !selectedDeleteKeys.has(`major:${m.id}`));
    };

    let cachedTrackCandidates: Array<{ id: string; label: string; code?: string }> | null = null;
    const getTrackCandidates = async () => {
      if (!cachedTrackCandidates) {
        const { results: otherTracks } = await d1
          .prepare(
            `SELECT t.id, t.name, t.code, m.name as major_name
             FROM tracks t
             LEFT JOIN majors m ON t.major_id = m.id
             WHERE t.deleted_at IS NULL
             ORDER BY t.name ASC`
          )
          .all();
        cachedTrackCandidates = (otherTracks || []).map((t: any) => ({
          id: t.id as string,
          label: `گرایش ${t.name} (${t.major_name || "-"} | کد: ${t.code || "-"})`,
          code: t.code as string,
        }));
      }
      return cachedTrackCandidates.filter((t) => !selectedDeleteKeys.has(`track:${t.id}`));
    };

    // ----------------------------------------------------
    // 1. BATCH PROCESS COURSE DEPENDENCIES
    // ----------------------------------------------------
    const courseItems = rawItems.filter((it) => it.type === "course");
    if (courseItems.length > 0) {
      const courseCandidates = await getCourseCandidates();
      for (const chunk of chunkArray(courseItems, 50)) {
        const chunkIds = chunk.map((c) => c.id);
        const placeholders = chunkIds.map(() => "?").join(",");

        const [
          { results: courseRows },
          { results: offerings },
          { results: prereqs },
          { results: trackAssigns },
          { results: chartCounts },
        ] = await Promise.all([
          d1.prepare(`SELECT id, name, code, faculty_id FROM courses WHERE id IN (${placeholders})`).bind(...chunkIds).all(),
          d1.prepare(`SELECT id, code, description, deleted_at, course_id FROM course_offerings WHERE course_id IN (${placeholders})`).bind(...chunkIds).all(),
          d1.prepare(`
            SELECT p.id, p.course_id, p.required_course_id, c.name as dependent_course_name, c.code as dependent_course_code, c.deleted_at, p.type
            FROM prerequisites p
            JOIN courses c ON p.course_id = c.id
            WHERE p.required_course_id IN (${placeholders})
          `).bind(...chunkIds).all(),
          d1.prepare(`
            SELECT a.id, a.course_id, a.track_id, t.name as track_name, m.name as major_name
            FROM track_course_assignments a
            JOIN tracks t ON a.track_id = t.id
            JOIN majors m ON t.major_id = m.id
            WHERE a.course_id IN (${placeholders})
          `).bind(...chunkIds).all(),
          d1.prepare(`
            SELECT course_id, count(*) as count
            FROM chart_courses
            WHERE course_id IN (${placeholders})
            GROUP BY course_id
          `).bind(...chunkIds).all(),
        ]);

        const courseMap = new Map((courseRows || []).map((c: any) => [c.id, c]));
        const chartCountMap = new Map((chartCounts || []).map((cc: any) => [cc.course_id, Number(cc.count) || 0]));

        for (const item of chunk) {
          const entityId = item.id;
          const courseRow = courseMap.get(entityId);
          const courseName = courseRow ? `${(courseRow as any).name} (کد درس: ${(courseRow as any).code || "-"})` : "این درس";

          // A. Offerings
          const itemOfferings = (offerings || []).filter((o: any) => o.course_id === entityId);
          for (const off of itemOfferings) {
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

          // B. Prerequisites
          const itemPrereqs = (prereqs || []).filter((p: any) => p.required_course_id === entityId);
          for (const pr of itemPrereqs) {
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
          const itemTrackAssigns = (trackAssigns || []).filter((ta: any) => ta.course_id === entityId);
          for (const ta of itemTrackAssigns) {
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
          const chartCount = chartCountMap.get(entityId) || 0;
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
      }
    }

    // ----------------------------------------------------
    // 2. PROCESS OTHER ENTITIES (professor, offering, event, faculty, major, track)
    // ----------------------------------------------------
    const otherItems = rawItems.filter((it) => it.type !== "course");
    for (const item of otherItems) {
      const entityType = item.type;
      const entityId = item.id;

      // ----------------------------------------------------
      // 2. PROFESSOR DEPENDENCIES
      // ----------------------------------------------------
      if (entityType === "professor") {
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

        // Candidate professors (cached)
        const profCandidates = await getProfCandidates();

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

        // Candidate offerings (cached)
        const offeringCandidates = await getOfferingCandidates();

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

      // ----------------------------------------------------
      // 5. FACULTY DEPENDENCIES
      // ----------------------------------------------------
      else if (entityType === "faculty") {
        const facRow = await d1
          .prepare("SELECT id, name, code FROM faculties WHERE id = ?")
          .bind(entityId)
          .first();
        const facName = facRow ? `دانشکده ${(facRow as any).name} (کد: ${(facRow as any).code || "-"})` : "این دانشکده";

        // Candidate faculties for replacement (cached)
        const facultyCandidates = await getFacultyCandidates();

        // A. Majors belonging to this faculty
        const { results: majors } = await d1
          .prepare("SELECT id, name, code, deleted_at FROM majors WHERE faculty_id = ?")
          .bind(entityId)
          .all();

        for (const m of majors || []) {
          if (selectedDeleteKeys.has(`major:${m.id}`)) continue;

          const conflictKey = `dep_fac_major_${m.id}`;
          if (seenConflictIds.has(conflictKey)) continue;
          seenConflictIds.add(conflictKey);

          const isMajorTrashed = Boolean(m.deleted_at);
          const allowedActions: Array<"replace" | "cascade_delete" | "trash_delete"> = isMajorTrashed
            ? ["trash_delete", "replace"]
            : ["replace", "cascade_delete"];

          dependencies.push({
            id: conflictKey,
            sourceEntityType: "faculty",
            sourceEntityId: entityId,
            sourceEntityName: facName,
            relationType: "faculty_major",
            dependentEntityType: "major",
            dependentEntityId: m.id as string,
            dependentEntityName: `رشته ${m.name} (کد: ${m.code || "-"})`,
            description: isMajorTrashed
              ? `دانشکده «${facName}» دارای رشته «${m.name}» در سطل بازیافت است. می‌توانید آن را به دانشکده دیگری منتقل کرده یا مستقیماً پاک نمایید.`
              : `دانشکده «${facName}» دارای رشته فعال «${m.name}» است. برای حذف قطعی دانشکده، این رشته باید به دانشکده دیگری منتقل شده یا حذف گردد.`,
            allowedActions,
            requiresCascadeInspection: !isMajorTrashed,
            isDependentInTrash: isMajorTrashed,
            replacementCandidates: facultyCandidates,
          });
        }

        // B. Courses belonging to this faculty
        const { results: courses } = await d1
          .prepare("SELECT id, name, code, units, deleted_at FROM courses WHERE faculty_id = ?")
          .bind(entityId)
          .all();

        for (const c of courses || []) {
          if (selectedDeleteKeys.has(`course:${c.id}`)) continue;

          const conflictKey = `dep_fac_course_${c.id}`;
          if (seenConflictIds.has(conflictKey)) continue;
          seenConflictIds.add(conflictKey);

          const isCourseTrashed = Boolean(c.deleted_at);
          const allowedActions: Array<"replace" | "cascade_delete" | "trash_delete"> = isCourseTrashed
            ? ["trash_delete", "replace"]
            : ["replace", "cascade_delete"];

          dependencies.push({
            id: conflictKey,
            sourceEntityType: "faculty",
            sourceEntityId: entityId,
            sourceEntityName: facName,
            relationType: "faculty_course",
            dependentEntityType: "course",
            dependentEntityId: c.id as string,
            dependentEntityName: `درس ${c.name} (کد: ${c.code || "-"})`,
            description: isCourseTrashed
              ? `دانشکده «${facName}» مالک درس «${c.name}» در سطل بازیافت است. می‌توانید آن را به دانشکده دیگری منتقل کنید یا مستقیماً پاک نمایید.`
              : `دانشکده «${facName}» مالک درس فعال «${c.name}» است. می‌توانید این درس را به دانشکده دیگری منتقل کنید یا حذف قطعی نمایید.`,
            allowedActions,
            requiresCascadeInspection: !isCourseTrashed,
            isDependentInTrash: isCourseTrashed,
            replacementCandidates: facultyCandidates,
          });
        }

        // C. Professors belonging to this faculty
        const { results: profs } = await d1
          .prepare("SELECT id, first_name, last_name, code, title, deleted_at FROM professors WHERE faculty_id = ?")
          .bind(entityId)
          .all();

        for (const p of profs || []) {
          if (selectedDeleteKeys.has(`professor:${p.id}`)) continue;

          const conflictKey = `dep_fac_prof_${p.id}`;
          if (seenConflictIds.has(conflictKey)) continue;
          seenConflictIds.add(conflictKey);

          const profFullName = `${p.first_name} ${p.last_name}`;
          const isProfTrashed = Boolean(p.deleted_at);
          const allowedActions: Array<"replace" | "cascade_delete" | "trash_delete"> = isProfTrashed
            ? ["trash_delete", "replace"]
            : ["replace", "cascade_delete"];

          dependencies.push({
            id: conflictKey,
            sourceEntityType: "faculty",
            sourceEntityId: entityId,
            sourceEntityName: facName,
            relationType: "faculty_professor",
            dependentEntityType: "professor",
            dependentEntityId: p.id as string,
            dependentEntityName: `استاد ${profFullName} (${p.title || "استاد"}) - کد: ${p.code || "-"}`,
            description: isProfTrashed
              ? `استاد «${profFullName}» عضو هیئت علمی این دانشکده در سطل بازیافت است. می‌توانید او را به دانشکده دیگری منتقل کنید یا مستقیماً پاک نمایید.`
              : `استاد «${profFullName}» عضو هیئت علمی فعال «${facName}» است. می‌توانید او را به دانشکده دیگری منتقل کنید یا حذف قطعی نمایید.`,
            allowedActions,
            requiresCascadeInspection: !isProfTrashed,
            isDependentInTrash: isProfTrashed,
            replacementCandidates: facultyCandidates,
          });
        }

        // D. Users assigned to this faculty
        const userCountRow = await d1
          .prepare("SELECT count(*) as count FROM users WHERE faculty_id = ?")
          .bind(entityId)
          .first();
        const userCount = Number(userCountRow?.count) || 0;

        if (userCount > 0) {
          const conflictKey = `dep_fac_users_${entityId}`;
          if (!seenConflictIds.has(conflictKey)) {
            seenConflictIds.add(conflictKey);
            dependencies.push({
              id: conflictKey,
              sourceEntityType: "faculty",
              sourceEntityId: entityId,
              sourceEntityName: facName,
              relationType: "faculty_user",
              dependentEntityType: "user",
              dependentEntityId: entityId,
              dependentEntityName: `کاربران/دانشجویان منتسب (${userCount} کاربر)`,
              description: `تعداد ${userCount} حساب کاربری در «${facName}» ثبت شده‌اند. می‌توانید دانشکده آن‌ها را به دانشکده دیگری منتقل کنید یا انتساب دانشکده را لغو (خالی) نمایید تا اکانتشان حفظ شود.`,
              allowedActions: ["replace", "unlink"],
              requiresCascadeInspection: false,
              replacementCandidates: facultyCandidates,
            });
          }
        }
      }

      // ----------------------------------------------------
      // 6. MAJOR DEPENDENCIES
      // ----------------------------------------------------
      else if (entityType === "major") {
        const majorRow = await d1
          .prepare(
            `SELECT m.id, m.name, m.code, m.faculty_id, f.name as faculty_name
             FROM majors m
             LEFT JOIN faculties f ON m.faculty_id = f.id
             WHERE m.id = ?`
          )
          .bind(entityId)
          .first();
        const majorName = majorRow
          ? `رشته ${(majorRow as any).name} (کد: ${(majorRow as any).code || "-"} | دانشکده: ${(majorRow as any).faculty_name || "-"})`
          : "این رشته";

        // Candidate majors for replacement (cached)
        const majorCandidates = await getMajorCandidates();

        // A. Tracks belonging to this major
        const { results: tracks } = await d1
          .prepare("SELECT id, name, code, deleted_at FROM tracks WHERE major_id = ?")
          .bind(entityId)
          .all();

        for (const t of tracks || []) {
          if (selectedDeleteKeys.has(`track:${t.id}`)) continue;

          const conflictKey = `dep_major_track_${t.id}`;
          if (seenConflictIds.has(conflictKey)) continue;
          seenConflictIds.add(conflictKey);

          const isTrackTrashed = Boolean(t.deleted_at);
          const allowedActions: Array<"replace" | "cascade_delete" | "trash_delete"> = isTrackTrashed
            ? ["trash_delete", "replace"]
            : ["replace", "cascade_delete"];

          dependencies.push({
            id: conflictKey,
            sourceEntityType: "major",
            sourceEntityId: entityId,
            sourceEntityName: majorName,
            relationType: "major_track",
            dependentEntityType: "track",
            dependentEntityId: t.id as string,
            dependentEntityName: `گرایش ${t.name} (کد: ${t.code || "-"})`,
            description: isTrackTrashed
              ? `رشته «${majorName}» دارای گرایش «${t.name}» در سطل بازیافت است. می‌توانید آن را به رشته دیگری منتقل کرده یا مستقیماً پاک نمایید.`
              : `رشته «${majorName}» دارای گرایش فعال «${t.name}» است. می‌توانید این گرایش را به رشته دیگری منتقل کنید یا حذف قطعی نمایید.`,
            allowedActions,
            requiresCascadeInspection: !isTrackTrashed,
            isDependentInTrash: isTrackTrashed,
            replacementCandidates: majorCandidates,
          });
        }

        // B. Users assigned to this major
        const userCountRow = await d1
          .prepare("SELECT count(*) as count FROM users WHERE major_id = ?")
          .bind(entityId)
          .first();
        const userCount = Number(userCountRow?.count) || 0;

        if (userCount > 0) {
          const conflictKey = `dep_major_users_${entityId}`;
          if (!seenConflictIds.has(conflictKey)) {
            seenConflictIds.add(conflictKey);
            dependencies.push({
              id: conflictKey,
              sourceEntityType: "major",
              sourceEntityId: entityId,
              sourceEntityName: majorName,
              relationType: "major_user",
              dependentEntityType: "user",
              dependentEntityId: entityId,
              dependentEntityName: `دانشجویان رشته (${userCount} دانشجو)`,
              description: `تعداد ${userCount} دانشجو در «${majorName}» ثبت‌نام شده‌اند. می‌توانید رشته آن‌ها را به رشته دیگری منتقل کرده یا انتساب رشته را لغو (خالی) نمایید تا اکانتشان حفظ شود.`,
              allowedActions: ["replace", "unlink"],
              requiresCascadeInspection: false,
              replacementCandidates: majorCandidates,
            });
          }
        }
      }

      // ----------------------------------------------------
      // 7. TRACK DEPENDENCIES
      // ----------------------------------------------------
      else if (entityType === "track") {
        const trackRow = await d1
          .prepare(
            `SELECT t.id, t.name, t.code, m.name as major_name, f.name as faculty_name
             FROM tracks t
             LEFT JOIN majors m ON t.major_id = m.id
             LEFT JOIN faculties f ON m.faculty_id = f.id
             WHERE t.id = ?`
          )
          .bind(entityId)
          .first();
        const trackName = trackRow
          ? `گرایش ${(trackRow as any).name} (کد: ${(trackRow as any).code || "-"} | رشته: ${(trackRow as any).major_name || "-"})`
          : "این گرایش";

        // Candidate tracks for replacement (cached)
        const trackCandidates = await getTrackCandidates();

        // A. Track Course Assignments
        const assignCountRow = await d1
          .prepare("SELECT count(*) as count FROM track_course_assignments WHERE track_id = ?")
          .bind(entityId)
          .first();
        const assignCount = Number(assignCountRow?.count) || 0;

        if (assignCount > 0) {
          const conflictKey = `dep_track_assignments_${entityId}`;
          if (!seenConflictIds.has(conflictKey)) {
            seenConflictIds.add(conflictKey);
            dependencies.push({
              id: conflictKey,
              sourceEntityType: "track",
              sourceEntityId: entityId,
              sourceEntityName: trackName,
              relationType: "track_assignment",
              dependentEntityType: "track_assignment",
              dependentEntityId: entityId,
              dependentEntityName: `دروس انتساب‌داده‌شده در چارت گرایش (${assignCount} درس)`,
              description: `این گرایش دارای ${assignCount} درس در چارت تحصیلی است. می‌توانید این انتساب‌ها را به گرایش دیگری منتقل کنید یا انتساب‌ها را از چارت پاک نمایید.`,
              allowedActions: ["replace", "cascade_delete"],
              requiresCascadeInspection: false,
              replacementCandidates: trackCandidates,
            });
          }
        }

        // B. Student Saved Charts
        const chartCountRow = await d1
          .prepare("SELECT count(*) as count FROM charts WHERE track_id = ?")
          .bind(entityId)
          .first();
        const chartCount = Number(chartCountRow?.count) || 0;

        if (chartCount > 0) {
          const conflictKey = `dep_track_charts_${entityId}`;
          if (!seenConflictIds.has(conflictKey)) {
            seenConflictIds.add(conflictKey);
            dependencies.push({
              id: conflictKey,
              sourceEntityType: "track",
              sourceEntityId: entityId,
              sourceEntityName: trackName,
              relationType: "track_chart",
              dependentEntityType: "chart_course",
              dependentEntityId: entityId,
              dependentEntityName: `برنامه و چارت‌های تحصیلی دانشجویان (${chartCount} چارت)`,
              description: `تعداد ${chartCount} چارت تحصیلی دانشجو بر اساس این گرایش ثبت شده است. می‌توانید گرایش این چارت‌ها را به گرایش دیگری منتقل کرده یا چارت‌ها را حذف نمایید.`,
              allowedActions: ["replace", "cascade_delete"],
              requiresCascadeInspection: false,
              replacementCandidates: trackCandidates,
            });
          }
        }

        // C. Users assigned to this track
        const userCountRow = await d1
          .prepare("SELECT count(*) as count FROM users WHERE track_id = ?")
          .bind(entityId)
          .first();
        const userCount = Number(userCountRow?.count) || 0;

        if (userCount > 0) {
          const conflictKey = `dep_track_users_${entityId}`;
          if (!seenConflictIds.has(conflictKey)) {
            seenConflictIds.add(conflictKey);
            dependencies.push({
              id: conflictKey,
              sourceEntityType: "track",
              sourceEntityId: entityId,
              sourceEntityName: trackName,
              relationType: "track_user",
              dependentEntityType: "user",
              dependentEntityId: entityId,
              dependentEntityName: `دانشجویان دارای این گرایش (${userCount} دانشجو)`,
              description: `تعداد ${userCount} دانشجو دارای گرایش «${trackName}» هستند. می‌توانید گرایش آن‌ها را به گرایش دیگری منتقل کرده یا انتساب گرایش را لغو (خالی) نمایید.`,
              allowedActions: ["replace", "unlink"],
              requiresCascadeInspection: false,
              replacementCandidates: trackCandidates,
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
