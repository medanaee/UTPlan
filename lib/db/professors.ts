import type { Professor } from "../types";
import { getD1 } from "./client";

export async function getProfessors(facultyId?: string): Promise<Professor[]> {
  const d1 = getD1();
  if (!d1) return [];

  try {
    let query = "SELECT * FROM professors WHERE deleted_at IS NULL";
    const params: any[] = [];
    if (facultyId) {
      query += " AND faculty_id = ?";
      params.push(facultyId);
    }
    query += " ORDER BY name ASC";
    const { results } = await d1.prepare(query).bind(...params).all();
    return (results || []).map((p: any) => {
      let links: any = undefined;
      if (p.links) {
        try {
          links = typeof p.links === "string" ? JSON.parse(p.links) : p.links;
        } catch {
          links = undefined;
        }
      }
      return {
        id: p.id,
        facultyId: p.faculty_id,
        code: p.code || undefined,
        firstName: p.first_name || undefined,
        lastName: p.last_name || undefined,
        name: p.name,
        avatarUrl: p.avatar_url || "",
        title: p.title || "استاد تمام",
        email: p.email || "",
        links,
        createdAt: p.created_at,
        deletedAt: p.deleted_at || null,
      };
    });
  } catch (err) {
    console.error("D1 getProfessors error:", err);
    return [];
  }
}

export async function getProfessorById(id: string): Promise<Professor | null> {
  const d1 = getD1();
  if (!d1) return null;

  try {
    const p = await d1
      .prepare(
        `SELECT p.*, f.name AS faculty_name
         FROM professors p
         LEFT JOIN faculties f ON p.faculty_id = f.id
         WHERE p.id = ? AND p.deleted_at IS NULL`
      )
      .bind(id)
      .first();
    if (!p) return null;

    let links: any = undefined;
    if ((p as any).links) {
      try {
        links = typeof (p as any).links === "string" ? JSON.parse((p as any).links) : (p as any).links;
      } catch {}
    }

    // Offerings taught by this professor (either primary or co-instructor)
    const { results: offRows } = await d1
      .prepare(
        `SELECT DISTINCT o.id, o.code, o.course_id, o.professor_id, o.created_at,
                c.name AS course_name, c.code AS course_code, c.units AS course_units
         FROM course_offerings o
         JOIN courses c ON o.course_id = c.id
         LEFT JOIN offering_professors op ON o.id = op.offering_id
         WHERE (o.professor_id = ? OR op.professor_id = ?) AND o.deleted_at IS NULL AND c.deleted_at IS NULL`
      )
      .bind(id, id)
      .all();

    // Review stats
    const { results: revRows } = await d1
      .prepare("SELECT overall_rating FROM reviews WHERE target_type = 'professor' AND target_id = ? AND deleted_at IS NULL")
      .bind(id)
      .all();

    const revCount = revRows?.length || 0;
    const avg =
      revCount > 0
        ? (revRows || []).reduce((sum: number, r: any) => sum + Number(r.overall_rating), 0) / revCount
        : 10;

    return {
      id: (p as any).id,
      facultyId: (p as any).faculty_id,
      code: (p as any).code || undefined,
      facultyName: (p as any).faculty_name || "دانشکده مهندسی برق و کامپیوتر",
      firstName: (p as any).first_name || undefined,
      lastName: (p as any).last_name || undefined,
      name: (p as any).name,
      avatarUrl: (p as any).avatar_url || "",
      title: (p as any).title || "استاد تمام",
      email: (p as any).email || "",
      links,
      offerings: (offRows || []).map((o: any) => ({
        id: o.id,
        courseId: o.course_id,
        professorId: o.professor_id,
        courseName: o.course_name,
        courseCode: o.course_code,
        courseUnits: Number(o.course_units) || 3,
        createdAt: o.created_at,
        deletedAt: null,
      })),
      reviewsCount: revCount,
      averageRating: Number(avg.toFixed(1)),
      createdAt: (p as any).created_at,
      deletedAt: (p as any).deleted_at || null,
    };
  } catch (err) {
    console.error("D1 getProfessorById error:", err);
    return null;
  }
}

export async function createProfessor(data: {
  id?: string;
  facultyId: string;
  code?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  title?: string;
  email?: string;
  avatarUrl?: string;
  links?: Professor["links"];
}): Promise<Professor> {
  const id = data.id || `prf_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const code = data.code?.trim()
    ? data.code.trim().toUpperCase()
    : `PRF-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const firstName = data.firstName?.trim() || "";
  const lastName = data.lastName?.trim() || "";
  const fullName = data.name?.trim() || [firstName, lastName].filter(Boolean).join(" ") || "استاد";
  const linksJson = data.links ? JSON.stringify(data.links) : null;

  const d1 = getD1();
  if (!d1) throw new Error("پایگاه‌داده در دسترس نیست.");

  try {
    await d1
      .prepare(
        `INSERT INTO professors (id, faculty_id, code, first_name, last_name, name, title, email, avatar_url, links, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        data.facultyId,
        code,
        firstName || null,
        lastName || null,
        fullName,
        data.title || "استاد تمام",
        data.email || "",
        data.avatarUrl || "",
        linksJson,
        now
      )
      .run();
  } catch (err) {
    console.error("D1 createProfessor error:", err);
    throw err;
  }

  return {
    id,
    facultyId: data.facultyId,
    code: code || undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    name: fullName,
    title: data.title || "استاد تمام",
    email: data.email || "",
    avatarUrl: data.avatarUrl || "",
    links: data.links,
    createdAt: now,
    deletedAt: null,
  };
}

export async function updateProfessor(
  id: string,
  data: Partial<Pick<Professor, "code" | "firstName" | "lastName" | "name" | "title" | "email" | "avatarUrl" | "facultyId" | "links">>
): Promise<Professor | null> {
  const d1 = getD1();
  if (!d1) return null;

  try {
    const existing = await getProfessorById(id);
    if (!existing) return null;

    const code =
      data.code !== undefined
        ? (data.code?.trim() ? data.code.trim().toUpperCase() : existing.code || `PRF-${crypto.randomUUID().slice(0, 6).toUpperCase()}`)
        : existing.code || `PRF-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const firstName = data.firstName !== undefined ? data.firstName.trim() : (existing.firstName || "");
    const lastName = data.lastName !== undefined ? data.lastName.trim() : (existing.lastName || "");
    let name = data.name !== undefined ? data.name.trim() : existing.name;
    if (data.name === undefined && (data.firstName !== undefined || data.lastName !== undefined)) {
      name = [firstName, lastName].filter(Boolean).join(" ") || name;
    }
    const title = data.title !== undefined ? data.title : existing.title;
    const email = data.email !== undefined ? data.email : existing.email;
    const avatarUrl = data.avatarUrl !== undefined ? data.avatarUrl : existing.avatarUrl;
    const facultyId = data.facultyId !== undefined ? data.facultyId : existing.facultyId;
    const links = data.links !== undefined ? data.links : existing.links;
    const linksJson = links ? JSON.stringify(links) : null;

    await d1
      .prepare(
        `UPDATE professors
         SET code = ?, first_name = ?, last_name = ?, name = ?, title = ?, email = ?, avatar_url = ?, faculty_id = ?, links = ?
         WHERE id = ?`
      )
      .bind(
        code,
        firstName || null,
        lastName || null,
        name,
        title || "استاد تمام",
        email || "",
        avatarUrl || "",
        facultyId,
        linksJson,
        id
      )
      .run();

    return await getProfessorById(id);
  } catch (err) {
    console.error("D1 updateProfessor error:", err);
    return null;
  }
}

export async function deleteProfessor(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const d1 = getD1();
  if (!d1) return false;

  try {
    await d1.prepare("UPDATE professors SET deleted_at = ? WHERE id = ?").bind(now, id).run();
    return true;
  } catch (err) {
    console.error("D1 deleteProfessor error:", err);
    return false;
  }
}

export async function deleteProfessorsByFaculty(facultyId: string): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;

  try {
    await d1
      .prepare(
        `DELETE FROM reviews 
         WHERE (target_type = 'professor' AND target_id IN (SELECT id FROM professors WHERE faculty_id = ?))
            OR (target_type = 'offering' AND target_id IN (SELECT id FROM course_offerings WHERE professor_id IN (SELECT id FROM professors WHERE faculty_id = ?)))`
      )
      .bind(facultyId, facultyId)
      .run();

    await d1
      .prepare(
        `DELETE FROM course_offerings 
         WHERE professor_id IN (SELECT id FROM professors WHERE faculty_id = ?)`
      )
      .bind(facultyId)
      .run();

    await d1
      .prepare("DELETE FROM professors WHERE faculty_id = ?")
      .bind(facultyId)
      .run();

    return true;
  } catch (err) {
    console.error("D1 deleteProfessorsByFaculty error:", err);
    return false;
  }
}

