import type { Course, DegreeLevel, PrerequisiteRelation, PrerequisiteType } from "../types";
import { getD1 } from "./client";
import { assignCourseToCategory, assignCourseToCategories, getEffectiveFacultyIds } from "./structure";
import { generateUniqueCode, isCodeDuplicate } from "./code-generator";

// ----------------------------------------------------
// COURSES CRUD
// ----------------------------------------------------
export async function getCourses(
  facultyId?: string,
  trackId?: string,
  directOnly: boolean = false,
  search?: string,
  limit?: number,
  courseIds?: string[]
): Promise<Course[]> {
  const d1 = getD1();
  if (!d1) return [];
  if (courseIds && courseIds.length === 0) return [];

  try {
    const params: any[] = [];
    let assignmentSubquery = `
      (
        SELECT json_group_array(
          json_object(
            'id', a.id,
            'track_id', a.track_id,
            'course_id', a.course_id,
            'category_id', a.category_id
          )
        )
        FROM track_course_assignments a
        WHERE a.course_id = c.id
    `;
    if (trackId) {
      assignmentSubquery += " AND a.track_id = ?";
      params.push(trackId);
    }
    assignmentSubquery += ") AS assignments_json";

    let query = `
      SELECT c.*, f.name AS faculty_name,
        (
          SELECT json_group_array(
            json_object(
              'id', p.id,
              'course_id', p.course_id,
              'required_course_id', p.required_course_id,
              'type', p.type,
              'required_course_name', rc.name,
              'required_course_code', rc.code
            )
          )
          FROM prerequisites p
          LEFT JOIN courses rc ON p.required_course_id = rc.id
          WHERE p.course_id = c.id
        ) AS prereqs_json,
        ${assignmentSubquery}
      FROM courses c
      LEFT JOIN faculties f ON c.faculty_id = f.id
      WHERE c.deleted_at IS NULL
    `;

    if (facultyId) {
      if (directOnly) {
        query += ` AND c.faculty_id = ?`;
        params.push(facultyId);
      } else {
        const effectiveIds = await getEffectiveFacultyIds(facultyId);
        const placeholders = effectiveIds.map(() => "?").join(",");
        query += ` AND c.faculty_id IN (${placeholders})`;
        params.push(...effectiveIds);
      }
    }

    const searchTokens = (search || "")
      .trim()
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
    for (const token of searchTokens) {
      const pattern = `%${token}%`;
      query += ` AND (
        c.name LIKE ? OR c.code LIKE ? OR c.abbreviation LIKE ? OR
        c.description LIKE ? OR f.name LIKE ?
      )`;
      params.push(pattern, pattern, pattern, pattern, pattern);
    }

    if (courseIds) {
      const placeholders = courseIds.map(() => "?").join(",");
      query += ` AND c.id IN (${placeholders})`;
      params.push(...courseIds);
    }

    query += " ORDER BY c.name ASC";
    if (limit) {
      query += " LIMIT ?";
      params.push(Math.min(Math.max(limit, 1), 50));
    }

    const { results: courseRows } = await d1.prepare(query).bind(...params).all();
    const coursesList = courseRows || [];

    if (coursesList.length === 0) {
      return [];
    }

    return coursesList.map((c: any) => {
      let prereqsList: any[] = [];
      try {
        if (c.prereqs_json) {
          const parsed = JSON.parse(c.prereqs_json);
          if (Array.isArray(parsed)) prereqsList = parsed;
        }
      } catch (e) {}

      let assignmentsList: any[] = [];
      try {
        if (c.assignments_json) {
          const parsed = JSON.parse(c.assignments_json);
          if (Array.isArray(parsed)) assignmentsList = parsed;
        }
      } catch (e) {}

      const prereqs = prereqsList.map((p: any) => ({
        id: p.id,
        courseId: p.course_id,
        requiredCourseId: p.required_course_id,
        type: p.type as any,
        requiredCourseName: p.required_course_name || "نامشخص",
        requiredCourseCode: p.required_course_code || "---",
      }));

      const assignments = assignmentsList.map((a: any) => ({
        id: a.id,
        trackId: a.track_id,
        courseId: a.course_id,
        categoryId: a.category_id || null,
        visualCategoryId: a.category_id || null,
        ruleCategoryId: a.category_id || null,
      }));

      return {
        id: c.id,
        facultyId: c.faculty_id,
        facultyName: c.faculty_name || undefined,
        name: c.name,
        code: c.code,
        degreeLevel: (c.degree_level as DegreeLevel) || "undergrad",
        abbreviation: c.abbreviation || undefined,
        units: Number(c.units) || 3,
        offeredIn: c.offered_in || "both",
        description: c.description || "",
        createdAt: c.created_at,
        deletedAt: c.deleted_at || null,
        prerequisites: prereqs,
        trackAssignments: assignments,
      };
    });
  } catch (err) {
    console.error("D1 getCourses error:", err);
    return [];
  }
}

/**
 * Loads the course graph needed by a chart editor:
 * track-assigned courses, courses already placed in the chart, and all
 * prerequisite/corequisite/recommended ancestors of those courses.
 */
export async function getCoursesForChartScope(trackId: string, chartId?: string): Promise<Course[]> {
  const d1 = getD1();
  if (!d1 || !trackId) return [];

  try {
    const scopeQuery = `
      WITH RECURSIVE course_scope(course_id) AS (
        SELECT course_id
        FROM track_course_assignments
        WHERE track_id = ?
        ${chartId ? `
        UNION
        SELECT cc.course_id
        FROM chart_courses cc
        INNER JOIN chart_terms ct ON ct.id = cc.term_id
        WHERE ct.chart_id = ?` : ""}
        UNION
        SELECT p.required_course_id
        FROM prerequisites p
        INNER JOIN course_scope s ON s.course_id = p.course_id
        WHERE p.type IN ('prerequisite', 'corequisite', 'recommended')
      )
      SELECT DISTINCT course_id FROM course_scope
    `;
    const params = chartId ? [trackId, chartId] : [trackId];
    const { results } = await d1.prepare(scopeQuery).bind(...params).all();
    const courseIds = (results || [])
      .map((row: any) => row.course_id)
      .filter((id: unknown): id is string => typeof id === "string" && id.length > 0);

    return getCourses(undefined, trackId, false, undefined, undefined, courseIds);
  } catch (err) {
    console.error("D1 getCoursesForChartScope error:", err);
    return [];
  }
}

export async function getCourseById(id: string): Promise<Course | null> {
  const d1 = getD1();
  if (!d1) return null;

  try {
    const c = await d1
      .prepare(
        `SELECT c.*, f.name AS faculty_name
         FROM courses c
         LEFT JOIN faculties f ON c.faculty_id = f.id
         WHERE c.id = ? AND c.deleted_at IS NULL`
      )
      .bind(id)
      .first();
    if (!c) return null;

    const { results: prereqRows } = await d1
      .prepare(
        `SELECT p.id, p.course_id, p.required_course_id, p.type,
                c.name AS required_course_name, c.code AS required_course_code
         FROM prerequisites p
         LEFT JOIN courses c ON p.required_course_id = c.id
         WHERE p.course_id = ?`
      )
      .bind(id)
      .all();

    const { results: depRows } = await d1
      .prepare(
        `SELECT p.id, p.course_id, p.required_course_id, p.type,
                c.name AS course_name, c.code AS course_code
         FROM prerequisites p
         LEFT JOIN courses c ON p.course_id = c.id
         WHERE p.required_course_id = ? AND c.deleted_at IS NULL`
      )
      .bind(id)
      .all();

    const { results: offeringRows } = await d1
      .prepare(
        `SELECT o.id, o.code, o.course_id, o.created_at,
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
                  WHERE op.offering_id = o.id AND p.deleted_at IS NULL
                ) AS professors_json
         FROM course_offerings o
         WHERE o.course_id = ? AND o.deleted_at IS NULL`
      )
      .bind(id)
      .all();

    const { results: assignRows } = await d1
      .prepare("SELECT * FROM track_course_assignments WHERE course_id = ?")
      .bind(id)
      .all();

    return {
      id: (c as any).id,
      facultyId: (c as any).faculty_id,
      facultyName: (c as any).faculty_name || undefined,
      name: (c as any).name,
      code: (c as any).code,
      degreeLevel: ((c as any).degree_level as DegreeLevel) || "undergrad",
      abbreviation: (c as any).abbreviation || undefined,
      units: Number((c as any).units) || 3,
      offeredIn: (c as any).offered_in || "both",
      description: (c as any).description || "",
      createdAt: (c as any).created_at,
      deletedAt: (c as any).deleted_at || null,
      prerequisites: (prereqRows || []).map((p: any) => ({
        id: p.id,
        courseId: p.course_id,
        requiredCourseId: p.required_course_id,
        type: p.type as any,
        requiredCourseName: p.required_course_name || "نامشخص",
        requiredCourseCode: p.required_course_code || "---",
      })),
      dependentCourses: (depRows || []).map((d: any) => ({
        id: d.id,
        courseId: d.course_id,
        courseName: d.course_name || "نامشخص",
        courseCode: d.course_code || "---",
        type: d.type as any,
      })),
      offerings: (offeringRows || []).map((o: any) => {
        let rawProfs: any[] = [];
        try {
          if (o.professors_json) {
            const parsed = JSON.parse(o.professors_json);
            if (Array.isArray(parsed)) rawProfs = parsed;
          }
        } catch (e) {}

        rawProfs.sort((a: any, b: any) => {
          const pDiff = (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0);
          if (pDiff !== 0) return pDiff;
          const lDiff = (a.last_name || "").localeCompare(b.last_name || "");
          if (lDiff !== 0) return lDiff;
          return (a.first_name || "").localeCompare(b.first_name || "");
        });

        const offProfs = rawProfs.map((lp: any) => {
          const fName = lp.first_name || "";
          const lName = lp.last_name || "";
          const fullName = [fName, lName].filter(Boolean).join(" ") || "استاد";
          return {
            id: lp.id,
            firstName: fName || undefined,
            lastName: lName || undefined,
            name: fullName,
            code: lp.code || undefined,
            title: lp.title || undefined,
            avatarUrl: lp.avatar_url || undefined,
            email: lp.email || undefined,
            isPrimary: Boolean(lp.is_primary),
          };
        });

        const primaryProf = offProfs.find((p: any) => p.isPrimary) || offProfs[0];
        const profNames = offProfs.map((p: any) => p.name).join(" و ");

        return {
          id: o.id,
          code: o.code || undefined,
          courseId: o.course_id,
          professorId: primaryProf?.id || "",
          professorIds: offProfs.map((p: any) => p.id),
          professors: offProfs,
          professorName: profNames || primaryProf?.name || "نامشخص",
          professorTitle: primaryProf?.title || undefined,
          professorAvatarUrl: primaryProf?.avatarUrl || undefined,
          createdAt: o.created_at,
          deletedAt: null,
        };
      }),
      trackAssignments: (assignRows || []).map((a: any) => ({
        id: a.id,
        trackId: a.track_id,
        courseId: a.course_id,
        categoryId: a.category_id || a.rule_category_id || a.visual_category_id || null,
        visualCategoryId: a.category_id || a.visual_category_id || null,
        ruleCategoryId: a.category_id || a.rule_category_id || null,
      })),
    };
  } catch (err) {
    console.error("D1 getCourseById error:", err);
    return null;
  }
}

export async function createCourse(data: {
  facultyId: string;
  name: string;
  code?: string;
  degreeLevel?: DegreeLevel;
  abbreviation?: string | null;
  units: number;
  offeredIn?: "fall" | "spring" | "both" | "none";
  description?: string;
  trackId?: string;
  categoryId?: string;
  visualCategoryId?: string;
  ruleCategoryId?: string;
}): Promise<Course> {
  const id = `crs_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  let cleanCode: string;
  if (data.code?.trim()) {
    cleanCode = data.code.trim().toUpperCase();
    if (await isCodeDuplicate("courses", cleanCode)) {
      throw new Error(`کد درس «${cleanCode}» تکراری است و قبلاً در سامانه ثبت شده است.`);
    }
  } else {
    cleanCode = await generateUniqueCode("courses", "CRS");
  }

  const cleanAbbr = data.abbreviation ? data.abbreviation.trim() || null : null;
  const units = Number(data.units) || 3;
  const offeredIn = data.offeredIn || "both";
  const degreeLevel: DegreeLevel = data.degreeLevel === "master" ? "master" : "undergrad";

  const d1 = getD1();
  if (!d1) throw new Error("پایگاه‌داده در دسترس نیست.");

  try {
    await d1
      .prepare(
        `INSERT INTO courses (id, faculty_id, name, code, degree_level, abbreviation, units, offered_in, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, data.facultyId, data.name.trim(), cleanCode, degreeLevel, cleanAbbr, units, offeredIn, data.description || "", now)
      .run();

    if (data.trackId) {
      const catId = data.categoryId ?? data.ruleCategoryId ?? data.visualCategoryId ?? null;
      await assignCourseToCategory(data.trackId, id, catId);
    }
  } catch (err) {
    console.error("D1 createCourse error:", err);
    throw err;
  }

  return {
    id,
    facultyId: data.facultyId,
    name: data.name.trim(),
    code: cleanCode,
    degreeLevel,
    abbreviation: cleanAbbr || undefined,
    units,
    offeredIn,
    description: data.description || "",
    createdAt: now,
    deletedAt: null,
  };
}

export async function updateCourse(
  id: string,
  data: Partial<Pick<Course, "name" | "code" | "degreeLevel" | "units" | "offeredIn" | "description" | "facultyId">> & {
    abbreviation?: string | null;
    trackId?: string;
    categoryId?: string;
    visualCategoryId?: string;
    ruleCategoryId?: string;
    deletedAt?: string | null;
  }
): Promise<Course | null> {
  const d1 = getD1();
  if (!d1) return null;

  try {
    const existing = await getCourseById(id);
    if (!existing) return null;

    const name = data.name !== undefined ? data.name.trim() : existing.name;
    let code = existing.code;
    if (data.code !== undefined && data.code.trim()) {
      const candidateCode = data.code.trim().toUpperCase();
      if (candidateCode !== existing.code) {
        if (await isCodeDuplicate("courses", candidateCode, id)) {
          throw new Error(`کد درس «${candidateCode}» تکراری است و به درس دیگری اختصاص دارد.`);
        }
        code = candidateCode;
      }
    }
    const degreeLevel: DegreeLevel = data.degreeLevel !== undefined
      ? (data.degreeLevel === "master" ? "master" : "undergrad")
      : (existing.degreeLevel || "undergrad");
    const abbreviation = data.abbreviation !== undefined
      ? (typeof data.abbreviation === "string" ? (data.abbreviation.trim() || null) : null)
      : (existing.abbreviation || null);
    const units = data.units !== undefined ? Number(data.units) : existing.units;
    const offeredIn = data.offeredIn !== undefined ? data.offeredIn : existing.offeredIn;
    const description = data.description !== undefined ? data.description : (existing.description || "");
    const facultyId = data.facultyId !== undefined ? data.facultyId : existing.facultyId;

    const sets: string[] = [
      "name = ?",
      "code = ?",
      "degree_level = ?",
      "abbreviation = ?",
      "units = ?",
      "offered_in = ?",
      "description = ?",
      "faculty_id = ?",
    ];
    const params: any[] = [name, code, degreeLevel, abbreviation, units, offeredIn, description, facultyId];

    if (data.deletedAt !== undefined) {
      sets.push("deleted_at = ?");
      params.push(data.deletedAt);
    }

    params.push(id);
    await d1
      .prepare(`UPDATE courses SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();

    if (data.trackId) {
      const catId = data.categoryId ?? data.ruleCategoryId ?? data.visualCategoryId ?? null;
      await assignCourseToCategory(data.trackId, id, catId);
    }

    return await getCourseById(id);
  } catch (err) {
    console.error("D1 updateCourse error:", err);
    throw err;
  }
}

export async function deleteCourse(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const d1 = getD1();
  if (!d1) return false;

  try {
    await d1.prepare("UPDATE courses SET deleted_at = ? WHERE id = ?").bind(now, id).run();
    return true;
  } catch (err) {
    console.error("D1 deleteCourse error:", err);
    return false;
  }
}

// ----------------------------------------------------
// PREREQUISITES MANAGEMENT
// ----------------------------------------------------
export async function getPrerequisites(courseId?: string): Promise<PrerequisiteRelation[]> {
  const d1 = getD1();
  if (!d1) return [];

  try {
    let query = `
      SELECT p.id, p.course_id, p.required_course_id, p.type,
             c.name AS required_course_name, c.code AS required_course_code
      FROM prerequisites p
      LEFT JOIN courses c ON p.required_course_id = c.id
    `;
    const params: any[] = [];
    if (courseId) {
      query += " WHERE p.course_id = ?";
      params.push(courseId);
    }
    const { results } = await d1.prepare(query).bind(...params).all();
    return (results || []).map((p: any) => ({
      id: p.id,
      courseId: p.course_id,
      requiredCourseId: p.required_course_id,
      type: p.type as any,
      requiredCourseName: p.required_course_name || "نامشخص",
      requiredCourseCode: p.required_course_code || "---",
    }));
  } catch (err) {
    console.error("D1 getPrerequisites error:", err);
    return [];
  }
}

export async function getAllPrerequisites(): Promise<{ courseId: string; requiredCourseId: string; type: string }[]> {
  const d1 = getD1();
  if (!d1) return [];

  try {
    const { results } = await d1.prepare("SELECT course_id, required_course_id, type FROM prerequisites").all();
    return (results || []).map((r: any) => ({
      courseId: r.course_id,
      requiredCourseId: r.required_course_id,
      type: r.type,
    }));
  } catch (err) {
    console.error("D1 getAllPrerequisites error:", err);
    return [];
  }
}

export async function addPrerequisite(
  courseIdOrData: string | { courseId: string; requiredCourseId: string; type?: PrerequisiteType },
  requiredCourseIdParam?: string,
  typeParam: PrerequisiteType = "prerequisite"
): Promise<PrerequisiteRelation> {
  let courseId: string;
  let requiredCourseId: string;
  let type: PrerequisiteType;

  if (typeof courseIdOrData === "object" && courseIdOrData !== null) {
    courseId = courseIdOrData.courseId;
    requiredCourseId = courseIdOrData.requiredCourseId;
    type = courseIdOrData.type || "prerequisite";
  } else {
    courseId = courseIdOrData;
    requiredCourseId = requiredCourseIdParam!;
    type = typeParam;
  }

  const id = `pr_${crypto.randomUUID().slice(0, 8)}`;
  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare(
          `INSERT INTO prerequisites (id, course_id, required_course_id, type)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(course_id, required_course_id, type) DO NOTHING`
        )
        .bind(id, courseId, requiredCourseId, type)
        .run();
    } catch (err) {
      console.error("D1 addPrerequisite error:", err);
      throw err;
    }
  }

  return {
    id,
    courseId,
    requiredCourseId,
    type,
  };
}

export async function removePrerequisite(id: string): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;

  try {
    await d1.prepare("DELETE FROM prerequisites WHERE id = ?").bind(id).run();
    return true;
  } catch (err) {
    console.error("D1 removePrerequisite error:", err);
    return false;
  }
}

export async function deleteCoursesByFaculty(facultyId: string): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;

  try {
    const now = new Date().toISOString();
    await d1
      .prepare("UPDATE courses SET deleted_at = ? WHERE faculty_id = ? AND deleted_at IS NULL")
      .bind(now, facultyId)
      .run();

    return true;
  } catch (err) {
    console.error("D1 deleteCoursesByFaculty error:", err);
    return false;
  }
}

