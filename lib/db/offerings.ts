import type { CourseOffering } from "../types";
import { getD1 } from "./client";
import { getEvents } from "./events";
import { getOfferingResources } from "./resources";

export async function getOfferings(filter?: {
  courseId?: string;
  professorId?: string;
  facultyId?: string;
} | string): Promise<CourseOffering[]> {
  const normFilter = typeof filter === "string" ? { facultyId: filter } : filter;
  const d1 = getD1();
  if (!d1) return [];

  try {
    let query = `
      SELECT o.*,
             c.name AS course_name, c.code AS course_code, c.units AS course_units, c.faculty_id AS course_faculty_id
      FROM course_offerings o
      JOIN courses c ON o.course_id = c.id
      WHERE o.deleted_at IS NULL
    `;
    const params: any[] = [];
    if (normFilter?.courseId) {
      query += " AND o.course_id = ?";
      params.push(normFilter.courseId);
    }
    if (normFilter?.facultyId) {
      query += " AND c.faculty_id = ?";
      params.push(normFilter.facultyId);
    }
    query += " ORDER BY c.name ASC";

    const { results } = await d1.prepare(query).bind(...params).all();
    const offeringRows = results || [];

    // Fetch professor links from offering_professors junction table
    let profLinksList: any[] = [];
    try {
      const { results: allProfLinks } = await d1
        .prepare(`
          SELECT op.offering_id, op.is_primary, p.id, p.first_name, p.last_name, p.code, p.title, p.avatar_url, p.email
          FROM offering_professors op
          JOIN professors p ON op.professor_id = p.id
          WHERE p.deleted_at IS NULL
          ORDER BY op.is_primary DESC, p.last_name ASC, p.first_name ASC
        `)
        .all();
      profLinksList = allProfLinks || [];
    } catch (e) {
      // Safe fallback if junction table is not yet populated
    }

    let list = offeringRows.map((r: any) => {
      const finalProfs = profLinksList
        .filter((lp: any) => lp.offering_id === r.id)
        .map((lp: any) => {
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

      const primaryProf = finalProfs.find((p: any) => p.isPrimary) || finalProfs[0];
      const profNames = finalProfs.map((p: any) => p.name).join(" و ");

      let finSems: string[] = [];
      try {
        if (r.finalized_semesters) {
          const parsed = JSON.parse(r.finalized_semesters);
          if (Array.isArray(parsed)) finSems = parsed;
        }
      } catch (e) {}

      return {
        id: r.id,
        code: r.code || undefined,
        courseId: r.course_id,
        description: r.description || undefined,
        finalizedSemesters: finSems,
        professorId: primaryProf?.id || "",
        professorIds: finalProfs.map((p: any) => p.id),
        professors: finalProfs,
        createdAt: r.created_at,
        deletedAt: r.deleted_at || null,
        courseName: r.course_name,
        courseCode: r.course_code,
        courseUnits: Number(r.course_units) || 3,
        facultyId: r.course_faculty_id,
        professorName: profNames || "استاد نامشخص",
        professorTitle: primaryProf?.title,
        professorAvatarUrl: primaryProf?.avatarUrl,
      };
    });

    if (normFilter?.professorId) {
      list = list.filter(
        (o) => o.professorId === normFilter.professorId || o.professorIds?.includes(normFilter.professorId!)
      );
    }

    return list;
  } catch (err) {
    console.error("D1 getOfferings error:", err);
    return [];
  }
}

export async function getOfferingById(id: string): Promise<CourseOffering | null> {
  const d1 = getD1();
  if (!d1) return null;

  try {
    const query = `
      SELECT o.*,
             c.name AS course_name, c.code AS course_code, c.units AS course_units, c.description AS course_description, c.faculty_id AS course_faculty_id,
             f.name AS faculty_name
      FROM course_offerings o
      JOIN courses c ON o.course_id = c.id
      LEFT JOIN faculties f ON c.faculty_id = f.id
      WHERE o.id = ? AND o.deleted_at IS NULL
    `;
    const row = await d1.prepare(query).bind(id).first();
    if (!row) return null;

    let profRows: any[] = [];
    try {
      const { results } = await d1
        .prepare(`
          SELECT op.is_primary, p.id, p.first_name, p.last_name, p.code, p.title, p.avatar_url, p.email
          FROM offering_professors op
          JOIN professors p ON op.professor_id = p.id
          WHERE op.offering_id = ? AND p.deleted_at IS NULL
          ORDER BY op.is_primary DESC, p.last_name ASC, p.first_name ASC
        `)
        .bind(id)
        .all();
      profRows = results || [];
    } catch (e) {
      // Safe fallback
    }

    const finalProfs = (profRows || []).map((lp: any) => {
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

    const primaryProf = finalProfs.find((p: any) => p.isPrimary) || finalProfs[0];
    const profNames = finalProfs.map((p: any) => p.name).join(" و ");

    const events = await getEvents({ offeringId: id });
    const resources = await getOfferingResources(id);

    // Review stats
    let revCount = 0;
    let avgRating = 0;
    try {
      const { results: reviewRows } = await d1
        .prepare("SELECT overall_rating FROM reviews WHERE target_type = 'offering' AND target_id = ? AND deleted_at IS NULL")
        .bind(id)
        .all();

      revCount = reviewRows?.length || 0;
      avgRating =
        revCount > 0
          ? (reviewRows || []).reduce((sum: number, r: any) => sum + Number(r.overall_rating), 0) / revCount
          : 0;
    } catch (e) {}

    let finSems: string[] = [];
    try {
      if ((row as any).finalized_semesters) {
        const parsed = JSON.parse((row as any).finalized_semesters);
        if (Array.isArray(parsed)) finSems = parsed;
      }
    } catch (e) {}

    return {
      id: (row as any).id,
      code: (row as any).code || undefined,
      courseId: (row as any).course_id,
      description: (row as any).description || "",
      finalizedSemesters: finSems,
      professorId: primaryProf?.id || "",
      professorIds: finalProfs.map((p: any) => p.id),
      professors: finalProfs,
      resources,
      createdAt: (row as any).created_at,
      deletedAt: (row as any).deleted_at || null,
      courseName: (row as any).course_name,
      courseCode: (row as any).course_code,
      courseUnits: Number((row as any).course_units) || 3,
      courseDescription: (row as any).course_description || "",
      facultyId: (row as any).course_faculty_id,
      facultyName: (row as any).faculty_name || "دانشکده مهندسی برق و کامپیوتر",
      professorName: profNames || "استاد نامشخص",
      professorTitle: primaryProf?.title,
      professorAvatarUrl: primaryProf?.avatarUrl,
      professorEmail: primaryProf?.email,
      events,
      reviewsCount: revCount,
      averageRating: Number(avgRating.toFixed(1)),
    };
  } catch (err) {
    console.error("D1 getOfferingById error:", err);
    return null;
  }
}

export async function createOffering(
  courseIdOrData:
    | string
    | {
        courseId: string;
        professorId?: string;
        professorIds?: string[];
        code?: string;
        description?: string;
        finalizedSemesters?: string[];
        id?: string;
      },
  professorIdArg?: string,
  codeArg?: string
): Promise<CourseOffering> {
  const courseId = typeof courseIdOrData === "object" ? courseIdOrData.courseId : courseIdOrData;
  const profIds: string[] =
    typeof courseIdOrData === "object"
      ? Array.isArray(courseIdOrData.professorIds) && courseIdOrData.professorIds.length > 0
        ? courseIdOrData.professorIds
        : courseIdOrData.professorId
        ? [courseIdOrData.professorId]
        : []
      : professorIdArg
      ? [professorIdArg]
      : [];

  const primaryProfId = profIds[0] || "";
  const code =
    typeof courseIdOrData === "object"
      ? courseIdOrData.code?.trim().toUpperCase() || `OFF-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
      : codeArg?.trim().toUpperCase() || `OFF-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const description =
    typeof courseIdOrData === "object" && courseIdOrData.description
      ? courseIdOrData.description.trim()
      : null;
  const finalizedSemesters =
    typeof courseIdOrData === "object" && Array.isArray(courseIdOrData.finalizedSemesters)
      ? courseIdOrData.finalizedSemesters
      : [];
  const finalizedSemestersStr = JSON.stringify(finalizedSemesters);
  const id =
    typeof courseIdOrData === "object" && courseIdOrData.id
      ? courseIdOrData.id.trim()
      : `off_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  const d1 = getD1();
  if (!d1) throw new Error("پایگاه‌داده در دسترس نیست.");

  try {
    await d1
      .prepare("INSERT INTO course_offerings (id, code, course_id, description, finalized_semesters, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, code, courseId, description, finalizedSemestersStr, now)
      .run();

    // Insert junction rows for all professors
    for (let i = 0; i < profIds.length; i++) {
      const pId = profIds[i];
      const isPrimary = i === 0 ? 1 : 0;
      const opId = `op_${id}_${pId}`;
      await d1
        .prepare(
          `INSERT INTO offering_professors (id, offering_id, professor_id, is_primary, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(offering_id, professor_id) DO UPDATE SET is_primary = excluded.is_primary`
        )
        .bind(opId, id, pId, isPrimary, now)
        .run()
        .catch(() => {});
    }

    const offs = await getOfferings();
    const created = offs.find((o) => o.id === id);
    return (
      created || {
        id,
        code,
        courseId,
        description: description || undefined,
        finalizedSemesters,
        professorId: primaryProfId,
        professorIds: profIds,
        createdAt: now,
        deletedAt: null,
      }
    );
  } catch (err) {
    console.error("D1 createOffering error:", err);
    throw err;
  }
}

export async function updateOffering(
  id: string,
  data: {
    courseId?: string;
    professorId?: string;
    professorIds?: string[];
    code?: string;
    description?: string;
    finalizedSemesters?: string[];
  }
): Promise<CourseOffering | null> {
  const d1 = getD1();
  if (!d1) return null;

  try {
    const profIds: string[] | undefined =
      Array.isArray(data.professorIds) && data.professorIds.length > 0
        ? data.professorIds
        : data.professorId
        ? [data.professorId]
        : undefined;

    const code = data.code ? data.code.trim().toUpperCase() : undefined;

    const sets: string[] = [];
    const params: any[] = [];
    if (data.courseId) {
      sets.push("course_id = ?");
      params.push(data.courseId);
    }
    if (code) {
      sets.push("code = ?");
      params.push(code);
    }
    if (data.description !== undefined) {
      sets.push("description = ?");
      params.push(data.description ? data.description.trim() : null);
    }
    if (data.finalizedSemesters !== undefined) {
      sets.push("finalized_semesters = ?");
      params.push(JSON.stringify(data.finalizedSemesters || []));
    }
    if (data.deletedAt !== undefined) {
      sets.push("deleted_at = ?");
      params.push(data.deletedAt);
    }

    if (sets.length > 0) {
      params.push(id);
      await d1
        .prepare(`UPDATE course_offerings SET ${sets.join(", ")} WHERE id = ?`)
        .bind(...params)
        .run();
    }

    // If professorIds was provided, update offering_professors
    if (profIds && profIds.length > 0) {
      const now = new Date().toISOString();
      await d1.prepare("DELETE FROM offering_professors WHERE offering_id = ?").bind(id).run();

      for (let i = 0; i < profIds.length; i++) {
        const pId = profIds[i];
        const isPrimary = i === 0 ? 1 : 0;
        const opId = `op_${id}_${pId}`;
        await d1
          .prepare(
            `INSERT INTO offering_professors (id, offering_id, professor_id, is_primary, created_at)
             VALUES (?, ?, ?, ?, ?)`
          )
          .bind(opId, id, pId, isPrimary, now)
          .run();
      }
    }

    const offs = await getOfferings();
    const updated = offs.find((o) => o.id === id);
    return updated || null;
  } catch (err) {
    console.error("D1 updateOffering error:", err);
    return null;
  }
}

export async function deleteOffering(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const d1 = getD1();
  if (!d1) return false;

  try {
    await d1.prepare("UPDATE course_offerings SET deleted_at = ? WHERE id = ?").bind(now, id).run();
    return true;
  } catch (err) {
    console.error("D1 deleteOffering error:", err);
    return false;
  }
}

export async function deleteOfferingsByFaculty(facultyId: string): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;

  try {
    const now = new Date().toISOString();
    await d1
      .prepare(
        `UPDATE course_offerings SET deleted_at = ?
         WHERE course_id IN (SELECT id FROM courses WHERE faculty_id = ?) AND deleted_at IS NULL`
      )
      .bind(now, facultyId)
      .run();

    return true;
  } catch (err) {
    console.error("D1 deleteOfferingsByFaculty error:", err);
    return false;
  }
}

