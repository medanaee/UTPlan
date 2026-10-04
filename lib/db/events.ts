import type { CourseEvent, CourseEventSlot } from "../types";
import { getD1 } from "./client";
import { getEffectiveFacultyIds } from "./structure";
import { generateUniqueCode, isCodeDuplicate } from "./code-generator";

export async function getEvents(
  filterOrTerm?: string | {
    offeringId?: string;
    term?: string;
    facultyId?: string;
    courseId?: string;
    userId?: string;
    customOnly?: boolean;
    eventId?: string;
  }
): Promise<CourseEvent[]> {
  const term = typeof filterOrTerm === "string" ? filterOrTerm : filterOrTerm?.term;
  const offeringId = typeof filterOrTerm === "object" ? filterOrTerm?.offeringId : undefined;
  const facultyId = typeof filterOrTerm === "object" ? filterOrTerm?.facultyId : undefined;
  const courseId = typeof filterOrTerm === "object" ? filterOrTerm?.courseId : undefined;
  const userId = typeof filterOrTerm === "object" ? filterOrTerm?.userId : undefined;
  const customOnly = typeof filterOrTerm === "object" ? Boolean(filterOrTerm?.customOnly) : false;
  const eventId = typeof filterOrTerm === "object" ? filterOrTerm?.eventId : undefined;

  const d1 = getD1();
  if (!d1) return [];

  try {
    let query = `
      SELECT e.id, e.code, e.offering_id, e.term, e.location, e.exam_date, e.exam_start_time, e.exam_end_time,
             e.is_user_custom, e.user_id, e.global_event_id, e.created_at, e.deleted_at,
             o.deleted_at AS offering_deleted_at,
             c.id AS course_id, c.name AS course_name, c.code AS course_code, c.units AS course_units,
             c.faculty_id AS faculty_id, f.name AS faculty_name,
             (
               SELECT json_group_array(
                 json_object(
                   'id', s.id,
                   'day_of_week', s.day_of_week,
                   'start_time', s.start_time,
                   'end_time', s.end_time
                 )
               )
               FROM course_event_slots s
               WHERE s.event_id = e.id
             ) AS slots_json,
             (
               SELECT json_group_array(
                 json_object(
                   'id', p.id,
                   'is_primary', op.is_primary,
                   'first_name', p.first_name,
                   'last_name', p.last_name,
                   'code', p.code,
                   'title', p.title,
                   'avatar_url', p.avatar_url,
                   'email', p.email
                 )
               )
               FROM offering_professors op
               JOIN professors p ON op.professor_id = p.id
               WHERE op.offering_id = e.offering_id AND p.deleted_at IS NULL
             ) AS professors_json
      FROM course_events e
      LEFT JOIN course_offerings o ON e.offering_id = o.id
      LEFT JOIN courses c ON o.course_id = c.id
      LEFT JOIN faculties f ON c.faculty_id = f.id
      WHERE e.deleted_at IS NULL
    `;
    const params: any[] = [];
    if (eventId) {
      query += " AND e.id = ?";
      params.push(eventId);
    }
    if (term) {
      query += " AND e.term = ?";
      params.push(term);
    }
    if (offeringId) {
      query += " AND e.offering_id = ?";
      params.push(offeringId);
    }
    if (courseId) {
      query += " AND o.course_id = ?";
      params.push(courseId);
    }
    if (facultyId) {
      const effectiveIds = await getEffectiveFacultyIds(facultyId);
      const placeholders = effectiveIds.map(() => "?").join(",");
      query += ` AND c.faculty_id IN (${placeholders})`;
      params.push(...effectiveIds);
    }

    if (customOnly) {
      query += " AND e.is_user_custom = 1";
    } else if (userId) {
      query += " AND (e.is_user_custom = 0 OR e.user_id = ?)";
      params.push(userId);
    } else if (!eventId) {
      query += " AND e.is_user_custom = 0";
    }

    const { results: eventRows } = await d1.prepare(query).bind(...params).all();
    const eventsList = eventRows || [];

    if (eventsList.length === 0) {
      return [];
    }

    return eventsList.map((e: any) => {
      let rawSlots: any[] = [];
      try {
        if (e.slots_json) {
          const parsed = JSON.parse(e.slots_json);
          if (Array.isArray(parsed)) rawSlots = parsed;
        }
      } catch (err) {}

      const slots: CourseEventSlot[] = rawSlots.map((s: any) => ({
        id: s.id,
        eventId: e.id,
        dayOfWeek: Number(s.day_of_week),
        startTime: s.start_time,
        endTime: s.end_time,
      }));

      let offProfs: any[] = [];
      try {
        if (e.professors_json) {
          const parsed = JSON.parse(e.professors_json);
          if (Array.isArray(parsed)) offProfs = parsed;
        }
      } catch (err) {}

      offProfs.sort((a: any, b: any) => {
        const pDiff = (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0);
        if (pDiff !== 0) return pDiff;
        const lDiff = (a.last_name || "").localeCompare(b.last_name || "");
        if (lDiff !== 0) return lDiff;
        return (a.first_name || "").localeCompare(b.first_name || "");
      });

      const primaryProf = offProfs.find((p: any) => p.is_primary) || offProfs[0];
      const profNames =
        offProfs.length > 0
          ? offProfs
              .map((p: any) => [p.first_name, p.last_name].filter(Boolean).join(" ") || "استاد")
              .join(" و ")
          : "نامشخص";

      return {
        id: e.id,
        code: e.code || undefined,
        offeringId: e.offering_id,
        term: e.term,
        location: e.location || "",
        examDate: e.exam_date || "",
        examStartTime: e.exam_start_time || "",
        examEndTime: e.exam_end_time || "",
        isUserCustom: Boolean(e.is_user_custom),
        userId: e.user_id || null,
        globalEventId: e.global_event_id || null,
        createdAt: e.created_at,
        deletedAt: e.deleted_at || null,
        courseId: e.course_id,
        courseName: e.course_name,
        courseCode: e.course_code || undefined,
        courseUnits: Number(e.course_units) || 3,
        facultyId: e.faculty_id,
        facultyName: e.faculty_name || undefined,
        professorId: primaryProf?.id || undefined,
        professorName: profNames || "استاد نامشخص",
        professorTitle: primaryProf?.title || undefined,
        professorAvatarUrl: primaryProf?.avatar_url || undefined,
        isOfferingDeleted: Boolean(e.offering_deleted_at),
        slots,
      };
    });
  } catch (err) {
    console.error("D1 getEvents error:", err);
    return [];
  }
}

export async function createEvent(data: {
  code?: string;
  offeringId: string;
  term: string;
  location?: string;
  examDate?: string;
  examStartTime?: string;
  examEndTime?: string;
  isUserCustom?: boolean;
  userId?: string | null;
  slots: { dayOfWeek: number; startTime: string; endTime: string }[];
}): Promise<CourseEvent> {
  const d1 = getD1();
  if (!d1) throw new Error("پایگاه‌داده در دسترس نیست.");

  let cleanCode: string;
  if (data.code?.trim()) {
    cleanCode = data.code.trim().toUpperCase();
    if (await isCodeDuplicate("course_events", cleanCode)) {
      throw new Error(`کد رویداد «${cleanCode}» تکراری است و قبلاً در سامانه ثبت شده است.`);
    }
  } else {
    cleanCode = await generateUniqueCode("course_events", "EVT");
  }

  let eventId = "";
  const now = new Date().toISOString();

  try {
    // Check if an event with this code already exists (e.g. soft-deleted)
    const existing = await d1
      .prepare("SELECT id FROM course_events WHERE code = ? LIMIT 1")
      .bind(cleanCode)
      .first();

    if (existing && (existing as any).id) {
      eventId = (existing as any).id;
      await d1
        .prepare(
          `UPDATE course_events
           SET offering_id = ?, term = ?, location = ?, exam_date = ?, exam_start_time = ?, exam_end_time = ?,
               is_user_custom = ?, user_id = ?, deleted_at = NULL
           WHERE id = ?`
        )
        .bind(
          data.offeringId,
          data.term,
          data.location || "",
          data.examDate || "",
          data.examStartTime || "",
          data.examEndTime || "",
          data.isUserCustom ? 1 : 0,
          data.userId || null,
          eventId
        )
        .run();
    } else {
      eventId = `evt_${crypto.randomUUID().slice(0, 8)}`;
      await d1
        .prepare(
          `INSERT INTO course_events (id, code, offering_id, term, location, exam_date, exam_start_time, exam_end_time, is_user_custom, user_id, created_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
        )
        .bind(
          eventId,
          cleanCode,
          data.offeringId,
          data.term,
          data.location || "",
          data.examDate || "",
          data.examStartTime || "",
          data.examEndTime || "",
          data.isUserCustom ? 1 : 0,
          data.userId || null,
          now
        )
        .run();
    }

    // Refresh slots
    await d1.prepare("DELETE FROM course_event_slots WHERE event_id = ?").bind(eventId).run();
    for (const slot of data.slots || []) {
      const slotId = `slot_${crypto.randomUUID().slice(0, 8)}`;
      await d1
        .prepare("INSERT INTO course_event_slots (id, event_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?)")
        .bind(slotId, eventId, slot.dayOfWeek, slot.startTime, slot.endTime)
        .run();
    }

    const evts = await getEvents({ eventId });
    if (evts.length > 0) return evts[0];
  } catch (err) {
    console.error("D1 createEvent error:", err);
    throw err;
  }

  return {
    id: eventId,
    code: cleanCode,
    offeringId: data.offeringId,
    term: data.term,
    location: data.location || "",
    examDate: data.examDate || "",
    examStartTime: data.examStartTime || "",
    examEndTime: data.examEndTime || "",
    isUserCustom: Boolean(data.isUserCustom),
    userId: data.userId || null,
    createdAt: now,
    slots: (data.slots || []).map((s) => ({
      id: `slot_${crypto.randomUUID().slice(0, 8)}`,
      eventId,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
    })),
  };
}

export async function createCustomUserEvent(data: {
  userId: string;
  code?: string;
  offeringId: string;
  term: string;
  location?: string;
  examDate?: string;
  examStartTime?: string;
  examEndTime?: string;
  slots: { dayOfWeek: number; startTime: string; endTime: string }[];
}): Promise<CourseEvent> {
  const created = await createEvent({
    code: data.code,
    offeringId: data.offeringId,
    term: data.term,
    location: data.location || "",
    examDate: data.examDate || "",
    examStartTime: data.examStartTime || "",
    examEndTime: data.examEndTime || "",
    isUserCustom: true,
    userId: data.userId,
    slots: data.slots,
  });

  const evts = await getEvents({ offeringId: data.offeringId, userId: data.userId });
  const fullEvt = evts.find((e) => e.id === created.id);
  return fullEvt || created;
}

export async function promoteCustomEventToGlobal(eventId: string): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;

  try {
    await d1
      .prepare("UPDATE course_events SET is_user_custom = 0, user_id = NULL WHERE id = ?")
      .bind(eventId)
      .run();
    return true;
  } catch (err) {
    console.error("D1 promoteCustomEventToGlobal error:", err);
    return false;
  }
}

export async function updateEvent(
  id: string,
  data: Partial<CourseEvent> & { slots?: { dayOfWeek: number; startTime: string; endTime: string }[] }
): Promise<CourseEvent | null> {
  const d1 = getD1();
  if (!d1) return null;

  try {
    let cleanCode: string | null | undefined = undefined;
    if (data.code !== undefined) {
      if (data.code && data.code.trim()) {
        cleanCode = data.code.trim().toUpperCase();
        if (await isCodeDuplicate("course_events", cleanCode, id)) {
          throw new Error(`کد رویداد «${cleanCode}» تکراری است و به رویداد دیگری اختصاص دارد.`);
        }
      } else {
        cleanCode = null;
      }
    }

    if (
      cleanCode !== undefined ||
      data.offeringId !== undefined ||
      data.location !== undefined ||
      data.examDate !== undefined ||
      data.examStartTime !== undefined ||
      data.examEndTime !== undefined
    ) {
      await d1
        .prepare(
          `UPDATE course_events
           SET code = COALESCE(?, code),
               offering_id = COALESCE(?, offering_id),
               location = COALESCE(?, location),
               exam_date = COALESCE(?, exam_date),
               exam_start_time = COALESCE(?, exam_start_time),
               exam_end_time = COALESCE(?, exam_end_time),
               deleted_at = NULL
           WHERE id = ?`
        )
        .bind(
          cleanCode !== undefined ? cleanCode : null,
          data.offeringId || null,
          data.location !== undefined ? data.location : null,
          data.examDate !== undefined ? data.examDate : null,
          data.examStartTime !== undefined ? data.examStartTime : null,
          data.examEndTime !== undefined ? data.examEndTime : null,
          id
        )
        .run();
    }

    if (data.slots) {
      await d1.prepare("DELETE FROM course_event_slots WHERE event_id = ?").bind(id).run();
      for (const slot of data.slots) {
        const slotId = `slot_${crypto.randomUUID().slice(0, 8)}`;
        await d1
          .prepare("INSERT INTO course_event_slots (id, event_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?)")
          .bind(slotId, id, slot.dayOfWeek, slot.startTime, slot.endTime)
          .run();
      }
    }

    const evts = await getEvents({ eventId: id });
    if (evts.length > 0) return evts[0];
    return null;
  } catch (err) {
    console.error("D1 updateEvent error:", err);
    throw err;
  }
}

export async function hardDeleteCustomEvent(id: string, userId?: string): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;

  try {
    // 1. Delete associated slots first to prevent orphan records
    await d1.prepare("DELETE FROM course_event_slots WHERE event_id = ?").bind(id).run();

    // 2. Hard-delete the event record itself if it's an unapproved custom event
    let query = "DELETE FROM course_events WHERE id = ? AND is_user_custom = 1";
    const params: any[] = [id];
    if (userId) {
      query += " AND user_id = ?";
      params.push(userId);
    }
    const res = await d1.prepare(query).bind(...params).run();
    return (res.meta?.changes ?? 1) > 0;
  } catch (err) {
    console.error("D1 hardDeleteCustomEvent error:", err);
    return false;
  }
}

export async function deleteEvent(id: string): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;

  try {
    const now = new Date().toISOString();
    await d1.prepare("UPDATE course_events SET deleted_at = ? WHERE id = ?").bind(now, id).run();
    return true;
  } catch (err) {
    console.error("D1 deleteEvent error:", err);
    return false;
  }
}

export async function deleteEventsByFacultyAndTerm(
  optionsOrFacultyId:
    | {
        facultyId?: string;
        term?: string;
        eventIds?: string[];
      }
    | string,
  maybeTerm?: string
): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;

  try {
    const now = new Date().toISOString();

    let facultyId: string | undefined;
    let term: string | undefined;
    let eventIds: string[] | undefined;

    if (typeof optionsOrFacultyId === "string") {
      facultyId = optionsOrFacultyId;
      term = maybeTerm;
    } else if (optionsOrFacultyId) {
      facultyId = optionsOrFacultyId.facultyId;
      term = optionsOrFacultyId.term;
      eventIds = optionsOrFacultyId.eventIds;
    }

    // 1. If explicit event IDs are provided, batch update in chunks (fast & index-backed)
    if (eventIds && eventIds.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < eventIds.length; i += chunkSize) {
        const chunk = eventIds.slice(i, i + chunkSize);
        const placeholders = chunk.map(() => "?").join(",");
        await d1
          .prepare(
            `UPDATE course_events SET deleted_at = ? WHERE id IN (${placeholders}) AND deleted_at IS NULL`
          )
          .bind(now, ...chunk)
          .run();
      }
      return true;
    }

    // 2. Otherwise update by term and/or faculty
    let query = `
      UPDATE course_events
      SET deleted_at = ?
      WHERE deleted_at IS NULL
    `;
    const params: any[] = [now];

    if (term) {
      query += " AND term = ?";
      params.push(term);
    }

    if (facultyId && facultyId !== "all") {
      const effectiveIds = await getEffectiveFacultyIds(facultyId);
      if (effectiveIds.length > 0) {
        const placeholders = effectiveIds.map(() => "?").join(",");
        query += `
          AND offering_id IN (
            SELECT o.id FROM course_offerings o
            JOIN courses c ON o.course_id = c.id
            WHERE c.faculty_id IN (${placeholders})
          )
        `;
        params.push(...effectiveIds);
      }
    }

    await d1.prepare(query).bind(...params).run();
    return true;
  } catch (err) {
    console.error("D1 deleteEventsByFacultyAndTerm error:", err);
    return false;
  }
}
