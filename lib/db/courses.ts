import type { Course, PrerequisiteRelation, PrerequisiteType } from "../types";
import { getD1 } from "./client";
import { assignCourseToCategories } from "./structure";

// ----------------------------------------------------
// COURSES CRUD
// ----------------------------------------------------
export async function getCourses(facultyId?: string, trackId?: string): Promise<Course[]> {
  const d1 = getD1();
  if (!d1) return [];

  try {
    let query = "SELECT * FROM courses WHERE deleted_at IS NULL";
    const params: any[] = [];
    if (facultyId) {
      query += " AND faculty_id = ?";
      params.push(facultyId);
    }
    query += " ORDER BY name ASC";
    const { results: courseRows } = await d1.prepare(query).bind(...params).all();
    const coursesList = courseRows || [];

    // Fetch all prereqs
    const prereqsQuery = `
      SELECT p.id, p.course_id, p.required_course_id, p.type,
             c.name AS required_course_name, c.code AS required_course_code
      FROM prerequisites p
      LEFT JOIN courses c ON p.required_course_id = c.id
    `;
    const { results: prereqRows } = await d1.prepare(prereqsQuery).all();
    const prereqsList = prereqRows || [];

    // Fetch track assignments
    let assignmentsList: any[] = [];
    if (trackId) {
      const { results: assignRows } = await d1
        .prepare("SELECT * FROM track_course_assignments WHERE track_id = ?")
        .bind(trackId)
        .all();
      assignmentsList = assignRows || [];
    } else {
      const { results: assignRows } = await d1.prepare("SELECT * FROM track_course_assignments").all();
      assignmentsList = assignRows || [];
    }

    return coursesList.map((c: any) => {
      const prereqs = prereqsList
        .filter((p: any) => p.course_id === c.id)
        .map((p: any) => ({
          id: p.id,
          courseId: p.course_id,
          requiredCourseId: p.required_course_id,
          type: p.type as any,
          requiredCourseName: p.required_course_name || "نامشخص",
          requiredCourseCode: p.required_course_code || "---",
        }));

      const assignments = assignmentsList
        .filter((a: any) => a.course_id === c.id)
        .map((a: any) => ({
          id: a.id,
          trackId: a.track_id,
          courseId: a.course_id,
          visualCategoryId: a.visual_category_id || null,
          ruleCategoryId: a.rule_category_id || null,
        }));

      return {
        id: c.id,
        facultyId: c.faculty_id,
        name: c.name,
        code: c.code,
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
        `SELECT o.id, o.code, o.course_id, o.created_at
         FROM course_offerings o
         WHERE o.course_id = ? AND o.deleted_at IS NULL`
      )
      .bind(id)
      .all();

    const { results: allProfLinks } = await d1
      .prepare(`
        SELECT op.offering_id, op.is_primary, p.id, p.name, p.code, p.title, p.avatar_url, p.email
        FROM offering_professors op
        JOIN professors p ON op.professor_id = p.id
        WHERE p.deleted_at IS NULL
        ORDER BY op.is_primary DESC, p.name ASC
      `)
      .all();

    const courseProfLinks = allProfLinks || [];

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
        const offProfs = courseProfLinks
          .filter((lp: any) => lp.offering_id === o.id)
          .map((lp: any) => ({
            id: lp.id,
            name: lp.name,
            code: lp.code || undefined,
            title: lp.title || undefined,
            avatarUrl: lp.avatar_url || undefined,
            email: lp.email || undefined,
            isPrimary: Boolean(lp.is_primary),
          }));

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
        visualCategoryId: a.visual_category_id || null,
        ruleCategoryId: a.rule_category_id || null,
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
  code: string;
  abbreviation?: string;
  units: number;
  offeredIn?: "fall" | "spring" | "both" | "none";
  description?: string;
  trackId?: string;
  visualCategoryId?: string;
  ruleCategoryId?: string;
}): Promise<Course> {
  const id = `crs_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const cleanCode = data.code.trim().toUpperCase();
  const cleanAbbr = data.abbreviation?.trim() || null;
  const units = Number(data.units) || 3;
  const offeredIn = data.offeredIn || "both";

  const d1 = getD1();
  if (!d1) throw new Error("پایگاه‌داده در دسترس نیست.");

  try {
    await d1
      .prepare(
        `INSERT INTO courses (id, faculty_id, name, code, abbreviation, units, offered_in, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, data.facultyId, data.name.trim(), cleanCode, cleanAbbr, units, offeredIn, data.description || "", now)
      .run();

    if (data.trackId) {
      await assignCourseToCategories(data.trackId, id, data.visualCategoryId, data.ruleCategoryId);
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
  data: Partial<Pick<Course, "name" | "code" | "abbreviation" | "units" | "offeredIn" | "description" | "facultyId">> & {
    trackId?: string;
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
    const code = data.code !== undefined ? data.code.trim().toUpperCase() : existing.code;
    const abbreviation = data.abbreviation !== undefined ? (data.abbreviation?.trim() || null) : (existing.abbreviation || null);
    const units = data.units !== undefined ? Number(data.units) : existing.units;
    const offeredIn = data.offeredIn !== undefined ? data.offeredIn : existing.offeredIn;
    const description = data.description !== undefined ? data.description : (existing.description || "");
    const facultyId = data.facultyId !== undefined ? data.facultyId : existing.facultyId;

    const sets: string[] = [
      "name = ?",
      "code = ?",
      "abbreviation = ?",
      "units = ?",
      "offered_in = ?",
      "description = ?",
      "faculty_id = ?",
    ];
    const params: any[] = [name, code, abbreviation, units, offeredIn, description, facultyId];

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
      await assignCourseToCategories(data.trackId, id, data.visualCategoryId, data.ruleCategoryId);
    }

    return await getCourseById(id);
  } catch (err) {
    console.error("D1 updateCourse error:", err);
    return null;
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

