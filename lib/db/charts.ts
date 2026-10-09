import type { StudentChart, ChartSemester, ChartSummary } from "../types";
import { getD1 } from "./client";

function mapChartRow(c: any): StudentChart {
  let terms: any[] = [];
  try {
    if (c.terms_json) {
      const parsed = JSON.parse(c.terms_json);
      if (Array.isArray(parsed)) terms = parsed;
    }
  } catch {}

  const semesters: ChartSemester[] = terms.map((t: any) => {
    const courseEventsMap: Record<string, string> = {};
    let termCourses: any[] = [];
    try {
      if (typeof t.courses === "string") {
        termCourses = JSON.parse(t.courses);
      } else if (Array.isArray(t.courses)) {
        termCourses = t.courses;
      }
    } catch {}

    const coursesInTerm = termCourses.map((cc: any) => {
      if (cc.selected_event_id) {
        courseEventsMap[cc.course_id] = cc.selected_event_id;
      }
      return cc.course_id;
    });

    const semNum = Number(t.term_index) || 1;
    return {
      semesterNumber: semNum,
      isSummer: semNum % 1 !== 0,
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
}

const CHART_SELECT_SQL = `
  SELECT c.*,
    (
      SELECT json_group_array(
        json_object(
          'id', t.id,
          'term_index', t.term_index,
          'courses', (
            SELECT json_group_array(
              json_object(
                'course_id', cc.course_id,
                'selected_event_id', cc.selected_event_id
              )
            )
            FROM chart_courses cc
            WHERE cc.term_id = t.id
            ORDER BY cc.sort_order ASC
          )
        )
      )
      FROM chart_terms t
      WHERE t.chart_id = c.id
      ORDER BY t.term_index ASC
    ) AS terms_json
  FROM charts c
`;

const CHART_SUMMARY_SELECT_SQL = `
  SELECT
    c.id,
    c.user_id,
    c.track_id,
    c.title,
    c.is_approved_template,
    c.created_at,
    c.updated_at,
    (SELECT COUNT(*) FROM chart_terms t WHERE t.chart_id = c.id) AS semester_count,
    (
      SELECT COUNT(*)
      FROM chart_courses cc
      INNER JOIN chart_terms t ON t.id = cc.term_id
      WHERE t.chart_id = c.id
    ) AS course_count
  FROM charts c
`;

function mapChartSummaryRow(c: any): ChartSummary {
  return {
    id: c.id,
    userId: c.user_id,
    trackId: c.track_id,
    title: c.title,
    isApprovedDefault: Boolean(c.is_approved_template),
    semesterCount: Number(c.semester_count) || 0,
    courseCount: Number(c.course_count) || 0,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

export async function getChartSummaries(userId?: string, trackId?: string): Promise<ChartSummary[]> {
  const d1 = getD1();
  if (!d1) return [];

  try {
    let query = `${CHART_SUMMARY_SELECT_SQL} WHERE 1=1`;
    const params: any[] = [];
    if (userId) {
      query += " AND (c.user_id = ? OR c.is_approved_template = 1)";
      params.push(userId);
    }
    if (trackId) {
      query += " AND c.track_id = ?";
      params.push(trackId);
    }
    query += " ORDER BY c.created_at DESC";

    const { results } = await d1.prepare(query).bind(...params).all();
    return (results || []).map(mapChartSummaryRow);
  } catch (err) {
    console.error("D1 getChartSummaries error:", err);
    return [];
  }
}

export async function getCharts(userId?: string, trackId?: string): Promise<StudentChart[]> {
  const d1 = getD1();
  if (!d1) return [];

  try {
    let query = `${CHART_SELECT_SQL} WHERE 1=1`;
    const params: any[] = [];
    if (userId) {
      query += " AND (c.user_id = ? OR c.is_approved_template = 1)";
      params.push(userId);
    }
    if (trackId) {
      query += " AND c.track_id = ?";
      params.push(trackId);
    }
    query += " ORDER BY c.created_at DESC";

    const { results } = await d1.prepare(query).bind(...params).all();
    return (results || []).map(mapChartRow);
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
    const query = `${CHART_SELECT_SQL} WHERE c.id = ?`;
    const c = await d1.prepare(query).bind(id).first();
    if (!c) return null;
    return mapChartRow(c);
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
    const stmts: any[] = [];
    stmts.push(
      d1.prepare(
        `INSERT INTO charts (id, user_id, track_id, title, is_approved_template, waived_course_ids, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(chartId, data.userId, data.trackId, data.title, isApproved, waivedCourseIdsJson, now, now)
    );

    for (const s of semesters) {
      const termId = `term_${chartId}_${s.semesterNumber}`;
      stmts.push(
        d1.prepare("INSERT INTO chart_terms (id, chart_id, term_index) VALUES (?, ?, ?)")
          .bind(termId, chartId, s.semesterNumber)
      );

      let order = 0;
      for (const courseId of s.courseIds || []) {
        const ccId = `cc_${crypto.randomUUID().slice(0, 8)}`;
        const selectedEventId = s.courseEventsMap?.[courseId] || null;
        stmts.push(
          d1.prepare(
            "INSERT INTO chart_courses (id, term_id, course_id, selected_event_id, sort_order) VALUES (?, ?, ?, ?, ?)"
          ).bind(ccId, termId, courseId, selectedEventId, order++)
        );
      }
    }

    if (stmts.length > 0) {
      await d1.batch(stmts);
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
      const stmts: any[] = [];
      // 1. Delete old chart courses belonging to this chart
      stmts.push(
        d1.prepare("DELETE FROM chart_courses WHERE term_id IN (SELECT id FROM chart_terms WHERE chart_id = ?)").bind(id)
      );
      // 2. Delete old chart terms
      stmts.push(
        d1.prepare("DELETE FROM chart_terms WHERE chart_id = ?").bind(id)
      );

      // 3. Re-insert terms and chart courses
      for (const s of data.semesters) {
        const termId = `term_${id}_${s.semesterNumber}`;
        stmts.push(
          d1.prepare("INSERT INTO chart_terms (id, chart_id, term_index) VALUES (?, ?, ?)")
            .bind(termId, id, s.semesterNumber)
        );

        let order = 0;
        for (const courseId of s.courseIds || []) {
          const ccId = `cc_${crypto.randomUUID().slice(0, 8)}`;
          const selectedEventId = s.courseEventsMap?.[courseId] || null;
          stmts.push(
            d1.prepare(
              "INSERT INTO chart_courses (id, term_id, course_id, selected_event_id, sort_order) VALUES (?, ?, ?, ?, ?)"
            ).bind(ccId, termId, courseId, selectedEventId, order++)
          );
        }
      }

      if (stmts.length > 0) {
        await d1.batch(stmts);
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
