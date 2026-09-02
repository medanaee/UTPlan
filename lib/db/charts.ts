import type { StudentChart, ChartSemester } from "../types";
import { getD1 } from "./client";

export async function getCharts(userId?: string, trackId?: string): Promise<StudentChart[]> {
  const d1 = getD1();
  if (!d1) return [];

  try {
    let query = "SELECT * FROM charts WHERE 1=1";
    const params: any[] = [];
    if (userId) {
      query += " AND (user_id = ? OR is_approved_template = 1)";
      params.push(userId);
    }
    if (trackId) {
      query += " AND track_id = ?";
      params.push(trackId);
    }
    query += " ORDER BY created_at DESC";

    const { results: chartRows } = await d1.prepare(query).bind(...params).all();
    const chartsList = chartRows || [];

    // Fetch all terms and courses for these charts
    const { results: termRows } = await d1.prepare("SELECT * FROM chart_terms ORDER BY term_index ASC").all();
    const { results: courseRows } = await d1.prepare("SELECT * FROM chart_courses ORDER BY sort_order ASC").all();

    const termsList = termRows || [];
    const chartCoursesList = courseRows || [];

    return chartsList.map((c: any) => {
      const terms = termsList.filter((t: any) => t.chart_id === c.id);
      const semesters: ChartSemester[] = terms.map((t: any) => {
        const courseEventsMap: Record<string, string> = {};
        const coursesInTerm = chartCoursesList
          .filter((cc: any) => cc.term_id === t.id)
          .map((cc: any) => {
            if (cc.selected_event_id) {
              courseEventsMap[cc.course_id] = cc.selected_event_id;
            }
            return cc.course_id;
          });

        return {
          semesterNumber: Number(t.term_index) || 1,
          courseIds: coursesInTerm,
          courseEventsMap,
        };
      });

      let waivedCourseIds: string[] = [];
      if (c.waived_course_ids) {
        try {
          waivedCourseIds = JSON.parse(c.waived_course_ids);
        } catch {}
      }

      return {
        id: c.id,
        userId: c.user_id,
        trackId: c.track_id,
        title: c.title,
        isApprovedDefault: Boolean(c.is_approved_template),
        semesters,
        waivedCourseIds,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      };
    });
  } catch (err) {
    console.error("D1 getCharts error:", err);
    return [];
  }
}

export async function getApprovedTrackCharts(trackId?: string): Promise<StudentChart[]> {
  const charts = await getCharts(undefined, trackId);
  return charts.filter((c) => c.isApprovedDefault);
}

export async function getApprovedTrackChart(trackId: string): Promise<StudentChart | null> {
  const approved = await getApprovedTrackCharts(trackId);
  return approved[0] || null;
}

export async function setPrimaryApprovedChart(chartId: string, trackId?: string): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;

  try {
    if (trackId) {
      await d1.prepare("UPDATE charts SET is_approved_template = 0 WHERE track_id = ?").bind(trackId).run();
    }
    await d1.prepare("UPDATE charts SET is_approved_template = 1 WHERE id = ?").bind(chartId).run();
    return true;
  } catch (err) {
    console.error("D1 setPrimaryApprovedChart error:", err);
    return false;
  }
}

export async function cloneChart(chartId: string, newUserId: string, title?: string): Promise<StudentChart | null> {
  const source = await getChartById(chartId);
  if (!source) return null;

  return await createChart({
    userId: newUserId,
    trackId: source.trackId,
    title: title || `${source.title} (کپی)`,
    isApprovedDefault: false,
    semesters: source.semesters,
  });
}

export async function getChartById(id: string): Promise<StudentChart | null> {
  const d1 = getD1();
  if (!d1) return null;

  try {
    const c = await d1.prepare("SELECT * FROM charts WHERE id = ?").bind(id).first();
    if (!c) return null;

    const { results: termRows } = await d1
      .prepare("SELECT * FROM chart_terms WHERE chart_id = ? ORDER BY term_index ASC")
      .bind(id)
      .all();

    const { results: courseRows } = await d1
      .prepare(
        `SELECT cc.* FROM chart_courses cc
         JOIN chart_terms ct ON cc.term_id = ct.id
         WHERE ct.chart_id = ?
         ORDER BY cc.sort_order ASC`
      )
      .bind(id)
      .all();

    const terms = termRows || [];
    const courses = courseRows || [];

    const semesters: ChartSemester[] = terms.map((t: any) => {
      const courseEventsMap: Record<string, string> = {};
      const courseIds = courses
        .filter((cc: any) => cc.term_id === t.id)
        .map((cc: any) => {
          if (cc.selected_event_id) {
            courseEventsMap[cc.course_id] = cc.selected_event_id;
          }
          return cc.course_id;
        });

      return {
        semesterNumber: Number(t.term_index) || 1,
        courseIds,
        courseEventsMap,
      };
    });

    let waivedCourseIds: string[] = [];
    if ((c as any).waived_course_ids) {
      try {
        waivedCourseIds = JSON.parse((c as any).waived_course_ids);
      } catch {}
    }

    return {
      id: (c as any).id,
      userId: (c as any).user_id,
      trackId: (c as any).track_id,
      title: (c as any).title,
      isApprovedDefault: Boolean((c as any).is_approved_template),
      semesters,
      waivedCourseIds,
      createdAt: (c as any).created_at,
      updatedAt: (c as any).updated_at,
    };
  } catch (err) {
    console.error("D1 getChartById error:", err);
    return null;
  }
}

export async function createChart(data: {
  userId: string;
  trackId: string;
  title: string;
  isApprovedDefault?: boolean;
  semesters?: ChartSemester[];
  waivedCourseIds?: string[];
}): Promise<StudentChart> {
  const chartId = `ch_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const isApproved = data.isApprovedDefault ? 1 : 0;
  const waivedCourseIdsJson = JSON.stringify(data.waivedCourseIds || []);

  // Default to 8 empty semesters if not provided or empty
  const defaultSemesters: ChartSemester[] = [1, 2, 3, 4, 5, 6, 7, 8].map((num) => ({
    id: `sem_${num}`,
    semesterNumber: num,
    courseIds: [],
    courseEventsMap: {},
  }));
  const semesters = data.semesters && data.semesters.length > 0 ? data.semesters : defaultSemesters;

  const d1 = getD1();
  if (!d1) throw new Error("پایگاه‌داده در دسترس نیست.");

  try {
    try {
      await d1.prepare("ALTER TABLE charts ADD COLUMN waived_course_ids TEXT").run();
    } catch {}

    await d1
      .prepare(
        `INSERT INTO charts (id, user_id, track_id, title, is_approved_template, waived_course_ids, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(chartId, data.userId, data.trackId, data.title, isApproved, waivedCourseIdsJson, now, now)
      .run();

    for (const s of semesters) {
      const termId = `term_${chartId}_${s.semesterNumber}`;
      await d1
        .prepare("INSERT INTO chart_terms (id, chart_id, term_index) VALUES (?, ?, ?)")
        .bind(termId, chartId, s.semesterNumber)
        .run();

      let order = 0;
      for (const courseId of s.courseIds || []) {
        const ccId = `cc_${crypto.randomUUID().slice(0, 8)}`;
        const selectedEventId = s.courseEventsMap?.[courseId] || null;
        await d1
          .prepare(
            "INSERT INTO chart_courses (id, term_id, course_id, selected_event_id, sort_order) VALUES (?, ?, ?, ?, ?)"
          )
          .bind(ccId, termId, courseId, selectedEventId, order++)
          .run();
      }
    }
  } catch (err) {
    console.error("D1 createChart error:", err);
    throw err;
  }

  return {
    id: chartId,
    userId: data.userId,
    trackId: data.trackId,
    title: data.title,
    isApprovedDefault: Boolean(data.isApprovedDefault),
    semesters,
    waivedCourseIds: data.waivedCourseIds || [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateChart(
  id: string,
  data: Partial<StudentChart>
): Promise<StudentChart | null> {
  const now = new Date().toISOString();
  const d1 = getD1();
  if (!d1) return null;

  try {
    try {
      await d1.prepare("ALTER TABLE charts ADD COLUMN waived_course_ids TEXT").run();
    } catch {}

    if (
      data.title !== undefined ||
      data.trackId !== undefined ||
      data.isApprovedDefault !== undefined ||
      data.waivedCourseIds !== undefined
    ) {
      await d1
        .prepare(
          `UPDATE charts
           SET title = COALESCE(?, title),
               track_id = COALESCE(?, track_id),
               is_approved_template = COALESCE(?, is_approved_template),
               waived_course_ids = COALESCE(?, waived_course_ids),
               updated_at = ?
           WHERE id = ?`
        )
        .bind(
          data.title || null,
          data.trackId || null,
          data.isApprovedDefault !== undefined ? (data.isApprovedDefault ? 1 : 0) : null,
          data.waivedCourseIds !== undefined ? JSON.stringify(data.waivedCourseIds) : null,
          now,
          id
        )
        .run();
    }

    if (data.semesters) {
      // Clear old terms and chart courses
      const { results: existingTerms } = await d1
        .prepare("SELECT id FROM chart_terms WHERE chart_id = ?")
        .bind(id)
        .all();

      for (const t of existingTerms || []) {
        await d1.prepare("DELETE FROM chart_courses WHERE term_id = ?").bind((t as any).id).run();
      }
      await d1.prepare("DELETE FROM chart_terms WHERE chart_id = ?").bind(id).run();

      // Re-insert terms
      for (const s of data.semesters) {
        const termId = `term_${id}_${s.semesterNumber}`;
        await d1
          .prepare("INSERT INTO chart_terms (id, chart_id, term_index) VALUES (?, ?, ?)")
          .bind(termId, id, s.semesterNumber)
          .run();

        let order = 0;
        for (const courseId of s.courseIds || []) {
          const ccId = `cc_${crypto.randomUUID().slice(0, 8)}`;
          const selectedEventId = s.courseEventsMap?.[courseId] || null;
          await d1
            .prepare(
              "INSERT INTO chart_courses (id, term_id, course_id, selected_event_id, sort_order) VALUES (?, ?, ?, ?, ?)"
            )
            .bind(ccId, termId, courseId, selectedEventId, order++)
            .run();
        }
      }
    }

    return await getChartById(id);
  } catch (err) {
    console.error("D1 updateChart error:", err);
    return null;
  }
}

export async function updateChartCourseEvent(
  chartId: string,
  termIndex: number,
  courseId: string,
  selectedEventId: string | null
): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;

  try {
    const term = await d1
      .prepare("SELECT id FROM chart_terms WHERE chart_id = ? AND term_index = ?")
      .bind(chartId, termIndex)
      .first();

    if (!term) return false;

    await d1
      .prepare("UPDATE chart_courses SET selected_event_id = ? WHERE term_id = ? AND course_id = ?")
      .bind(selectedEventId, (term as any).id, courseId)
      .run();

    await d1.prepare("UPDATE charts SET updated_at = ? WHERE id = ?").bind(new Date().toISOString(), chartId).run();
    return true;
  } catch (err) {
    console.error("D1 updateChartCourseEvent error:", err);
    return false;
  }
}

export async function deleteChart(id: string): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;

  try {
    await d1
      .prepare("DELETE FROM chart_courses WHERE term_id IN (SELECT id FROM chart_terms WHERE chart_id = ?)")
      .bind(id)
      .run();
    await d1.prepare("DELETE FROM chart_terms WHERE chart_id = ?").bind(id).run();
    await d1.prepare("DELETE FROM charts WHERE id = ?").bind(id).run();
    return true;
  } catch (err) {
    console.error("D1 deleteChart error:", err);
    return false;
  }
}
