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

    const { results: offRows } = await d1
      .prepare(
        `SELECT DISTINCT o.id, o.code, o.course_id, o.created_at,
                c.name AS course_name, c.code AS course_code, c.units AS course_units
         FROM course_offerings o
         JOIN courses c ON o.course_id = c.id
         JOIN offering_professors op ON o.id = op.offering_id
         WHERE op.professor_id = ? AND o.deleted_at IS NULL AND c.deleted_at IS NULL`
      )
      .bind(id)
      .all();

    const { results: revRows } = await d1
      .prepare("SELECT overall_rating FROM reviews WHERE target_type = 'professor' AND target_id = ? AND deleted_at IS NULL")
      .bind(id)
      .all();

    const revCount = revRows?.length || 0;
    const avg =
      revCount > 0
        ? (revRows || []).reduce((sum: number, r: any) => sum + Number(r.overall_rating), 0) / revCount
        : 0;

    return {
      id: (p as any).id,
      code: (p as any).code || undefined,
      name: (p as any).name,
      facultyId: (p as any).faculty_id,
      facultyName: (p as any).faculty_name || "نامشخص",
      title: (p as any).title || undefined,
      email: (p as any).email || undefined,
      avatarUrl: (p as any).avatar_url || undefined,
      links,
      offerings: (offRows || []).map((o: any) => ({
        id: o.id,
        code: o.code || undefined,
        courseId: o.course_id,
        courseName: o.course_name,
        courseCode: o.course_code,
        courseUnits: Number(o.course_units) || 3,
        createdAt: o.created_at,
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
  facultyId: string;
  name: string;
  code?: string;
  title?: string;
  email?: string;
  avatarUrl?: string;
  links?: Record<string, string>;
}): Promise<Professor> {
  const id = `prf_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const cleanName = data.name.trim();
  const code = data.code?.trim().toUpperCase() || `PRF-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const cleanTitle = data.title?.trim() || null;
  const cleanEmail = data.email?.trim() || null;
  const cleanAvatarUrl = data.avatarUrl?.trim() || null;
  const linksStr = data.links ? JSON.stringify(data.links) : null;

  const d1 = getD1();
  if (!d1) throw new Error("پایگاه‌داده در دسترس نیست.");

  try {
    await d1
      .prepare(
        `INSERT INTO professors (id, code, faculty_id, name, title, email, avatar_url, links, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, code, data.facultyId, cleanName, cleanTitle, cleanEmail, cleanAvatarUrl, linksStr, now)
      .run();

    return {
      id,
      code,
      facultyId: data.facultyId,
      name: cleanName,
      title: cleanTitle || undefined,
      email: cleanEmail || undefined,
      avatarUrl: cleanAvatarUrl || undefined,
      links: data.links,
      createdAt: now,
      deletedAt: null,
    };
  } catch (err) {
    console.error("D1 createProfessor error:", err);
    throw err;
  }
}

export async function updateProfessor(
  id: string,
  data: Partial<Omit<Professor, "id" | "createdAt" | "deletedAt">>
): Promise<Professor | null> {
  const d1 = getD1();
  if (!d1) return null;

  try {
    const sets: string[] = [];
    const params: any[] = [];

    if (data.facultyId) {
      sets.push("faculty_id = ?");
      params.push(data.facultyId);
    }
    if (data.name) {
      sets.push("name = ?");
      params.push(data.name.trim());
    }
    if (data.code) {
      sets.push("code = ?");
      params.push(data.code.trim().toUpperCase());
    }
    if (data.title !== undefined) {
      sets.push("title = ?");
      params.push(data.title ? data.title.trim() : null);
    }
    if (data.email !== undefined) {
      sets.push("email = ?");
      params.push(data.email ? data.email.trim() : null);
    }
    if (data.avatarUrl !== undefined) {
      sets.push("avatar_url = ?");
      params.push(data.avatarUrl ? data.avatarUrl.trim() : null);
    }
    if (data.links !== undefined) {
      sets.push("links = ?");
      params.push(data.links ? JSON.stringify(data.links) : null);
    }
    if (data.deletedAt !== undefined) {
      sets.push("deleted_at = ?");
      params.push(data.deletedAt);
    }

    if (sets.length === 0) return await getProfessorById(id);

    params.push(id);
    await d1
      .prepare(`UPDATE professors SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...params)
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
    const now = new Date().toISOString();
    await d1
      .prepare("UPDATE professors SET deleted_at = ? WHERE faculty_id = ? AND deleted_at IS NULL")
      .bind(now, facultyId)
      .run();

    return true;
  } catch (err) {
    console.error("D1 deleteProfessorsByFaculty error:", err);
    return false;
  }
}

