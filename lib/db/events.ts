import type { CourseEvent, CourseEventSlot } from "../types";
import { getD1 } from "./client";

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
      SELECT e.id, e.offering_id, e.term, e.location, e.exam_date, e.exam_start_time, e.exam_end_time,
             e.is_user_custom, e.user_id, e.global_event_id, e.created_at,
             c.id AS course_id, c.name AS course_name, c.code AS course_code, c.units AS course_units,
             p.id AS professor_id, p.name AS professor_name, p.title AS professor_title, p.avatar_url AS professor_avatar_url
      FROM course_events e
      JOIN course_offerings o ON e.offering_id = o.id
      JOIN courses c ON o.course_id = c.id
      LEFT JOIN offering_professors op ON op.offering_id = o.id AND op.is_primary = 1
      LEFT JOIN professors p ON op.professor_id = p.id
      WHERE o.deleted_at IS NULL
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
      query += " AND c.faculty_id = ?";
      params.push(facultyId);
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

    // Fetch event slots
    const { results: slotRows } = await d1.prepare("SELECT * FROM course_event_slots").all();
    const slotsList = slotRows || [];

    // Fetch professor links for all offerings
    const { results: allProfLinks } = await d1
      .prepare(`
        SELECT op.offering_id, op.is_primary, p.id, p.name, p.code, p.title, p.avatar_url, p.email
        FROM offering_professors op
        JOIN professors p ON op.professor_id = p.id
        WHERE p.deleted_at IS NULL
        ORDER BY op.is_primary DESC, p.name ASC
      `)
      .all();
    const profLinksList = allProfLinks || [];

    return eventsList.map((e: any) => {
      const slots = slotsList
        .filter((s: any) => s.event_id === e.id)
        .map((s: any) => ({
          id: s.id,
          eventId: s.event_id,
          dayOfWeek: Number(s.day_of_week),
          startTime: s.start_time,
          endTime: s.end_time,
        }));

      const offProfs = profLinksList.filter((lp: any) => lp.offering_id === e.offering_id);
      const primaryProf = offProfs.find((p: any) => p.is_primary) || offProfs[0];
      const profNames = offProfs.length > 0 ? offProfs.map((p: any) => p.name).join(" و ") : e.professor_name;

      return {
        id: e.id,
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
        courseId: e.course_id,
        courseName: e.course_name,
        courseCode: e.course_code,
        courseUnits: Number(e.course_units) || 3,
        professorId: primaryProf?.id || e.professor_id,
        professorName: profNames || e.professor_name || "استاد نامشخص",
        professorTitle: primaryProf?.title || e.professor_title,
        professorAvatarUrl: primaryProf?.avatar_url || e.professor_avatar_url,
        slots,
      };
    });
  } catch (err) {
    console.error("D1 getEvents error:", err);
    return [];
  }
}

export async function createEvent(data: {
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
  const eventId = `evt_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  const d1 = getD1();
  if (!d1) throw new Error("پایگاه‌داده در دسترس نیست.");

  try {
    await d1
      .prepare(
        `INSERT INTO course_events (id, offering_id, term, location, exam_date, exam_start_time, exam_end_time, is_user_custom, user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        eventId,
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
  offeringId: string;
  term: string;
  location?: string;
  examDate?: string;
  examStartTime?: string;
  examEndTime?: string;
  slots: { dayOfWeek: number; startTime: string; endTime: string }[];
}): Promise<CourseEvent> {
  const created = await createEvent({
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
    if (
      data.offeringId !== undefined ||
      data.location !== undefined ||
      data.examDate !== undefined ||
      data.examStartTime !== undefined ||
      data.examEndTime !== undefined
    ) {
      await d1
        .prepare(
          `UPDATE course_events
           SET offering_id = COALESCE(?, offering_id),
               location = COALESCE(?, location),
               exam_date = COALESCE(?, exam_date),
               exam_start_time = COALESCE(?, exam_start_time),
               exam_end_time = COALESCE(?, exam_end_time)
           WHERE id = ?`
        )
        .bind(
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
  } catch (err) {
    console.error("D1 updateEvent error:", err);
  }
  return null;
}

export async function deleteEvent(id: string): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;

  try {
    await d1.prepare("DELETE FROM course_event_slots WHERE event_id = ?").bind(id).run();
    await d1.prepare("DELETE FROM course_events WHERE id = ?").bind(id).run();
    return true;
  } catch (err) {
    console.error("D1 deleteEvent error:", err);
    return false;
  }
}
