import type { Professor } from "../types";
import { getD1 } from "./client";
import { getEffectiveFacultyIds } from "./structure";
import { generateUniqueCode, isCodeDuplicate } from "./code-generator";

export async function getProfessors(
  facultyId?: string,
  directOnly: boolean = false,
  search?: string,
  limit?: number
): Promise<Professor[]> {
  const d1 = getD1();
  if (!d1) return [];

  try {
    let query = `
      SELECT p.*, f.name AS faculty_name
      FROM professors p
      LEFT JOIN faculties f ON p.faculty_id = f.id
      WHERE p.deleted_at IS NULL
    `;
    const params: any[] = [];
    if (facultyId) {
      if (directOnly) {
        query += ` AND p.faculty_id = ?`;
        params.push(facultyId);
      } else {
        const effectiveIds = await getEffectiveFacultyIds(facultyId);
        const placeholders = effectiveIds.map(() => "?").join(",");
        query += ` AND p.faculty_id IN (${placeholders})`;
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
        p.first_name LIKE ? OR p.last_name LIKE ? OR p.code LIKE ? OR
        p.email LIKE ? OR p.title LIKE ? OR f.name LIKE ?
      )`;
      params.push(pattern, pattern, pattern, pattern, pattern, pattern);
    }

    query += " ORDER BY p.last_name ASC, p.first_name ASC";
    if (limit) {
      query += " LIMIT ?";
      params.push(Math.min(Math.max(limit, 1), 50));
    }
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
      const firstName = p.first_name || "";
      const lastName = p.last_name || "";
      const fullName = [firstName, lastName].filter(Boolean).join(" ");
      return {
        id: p.id,
        facultyId: p.faculty_id,
        facultyName: p.faculty_name || undefined,
        code: p.code || undefined,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        name: fullName || "استاد",
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

export async function getProfessorsPage(
  facultyId?: string,
  directOnly: boolean = false,
  search?: string,
  title?: string,
  page: number = 1,
  pageSize: number = 12
): Promise<{ items: Professor[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const d1 = getD1();
  const safePageSize = Math.min(Math.max(Math.floor(pageSize) || 12, 1), 50);
  const safePage = Math.max(Math.floor(page) || 1, 1);
  if (!d1) return { items: [], total: 0, page: safePage, pageSize: safePageSize, totalPages: 0 };

  try {
    let where = " WHERE p.deleted_at IS NULL";
    const params: any[] = [];
    if (facultyId) {
      const ids = directOnly ? [facultyId] : await getEffectiveFacultyIds(facultyId);
      if (ids.length === 0) return { items: [], total: 0, page: safePage, pageSize: safePageSize, totalPages: 0 };
      where += ` AND p.faculty_id IN (${ids.map(() => "?").join(",")})`;
      params.push(...ids);
    }
    const tokens = (search || "").trim().split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      const pattern = `%${token}%`;
      where += ` AND (p.first_name LIKE ? OR p.last_name LIKE ? OR p.code LIKE ? OR p.email LIKE ? OR p.title LIKE ? OR f.name LIKE ?)`;
      params.push(pattern, pattern, pattern, pattern, pattern, pattern);
    }
    if (title) {
      where += " AND p.title = ?";
      params.push(title);
    }

    const countRow: any = await d1
      .prepare(`SELECT COUNT(*) AS total FROM professors p LEFT JOIN faculties f ON p.faculty_id = f.id${where}`)
      .bind(...params)
      .first();
    const total = Number(countRow?.total || 0);
    const totalPages = total > 0 ? Math.ceil(total / safePageSize) : 0;
    const effectivePage = totalPages > 0 ? Math.min(safePage, totalPages) : safePage;
    const offset = (effectivePage - 1) * safePageSize;
    const { results } = await d1
      .prepare(
        `SELECT p.*, f.name AS faculty_name FROM professors p LEFT JOIN faculties f ON p.faculty_id = f.id${where}
         ORDER BY p.last_name ASC, p.first_name ASC LIMIT ? OFFSET ?`
      )
      .bind(...params, safePageSize, offset)
      .all();

    const items = (results || []).map((p: any) => {
      let links: any = undefined;
      if (p.links) {
        try { links = typeof p.links === "string" ? JSON.parse(p.links) : p.links; } catch { links = undefined; }
      }
      const firstName = p.first_name || "";
      const lastName = p.last_name || "";
      return {
        id: p.id,
        facultyId: p.faculty_id,
        facultyName: p.faculty_name || undefined,
        code: p.code || undefined,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        name: [firstName, lastName].filter(Boolean).join(" ") || "استاد",
        avatarUrl: p.avatar_url || "",
        title: p.title || "استاد تمام",
        email: p.email || "",
        links,
        createdAt: p.created_at,
        deletedAt: p.deleted_at || null,
      } as Professor;
    });
    return { items, total, page: effectivePage, pageSize: safePageSize, totalPages };
  } catch (err) {
    console.error("D1 getProfessorsPage error:", err);
    return { items: [], total: 0, page: safePage, pageSize: safePageSize, totalPages: 0 };
  }
}

export async function getProfessorTitles(): Promise<string[]> {
  const d1 = getD1();
  if (!d1) return [];
  try {
    const { results } = await d1
      .prepare("SELECT DISTINCT title FROM professors WHERE deleted_at IS NULL AND title IS NOT NULL AND TRIM(title) <> '' ORDER BY title")
      .all();
    return (results || []).map((row: any) => String(row.title).trim()).filter(Boolean);
  } catch (err) {
    console.error("D1 getProfessorTitles error:", err);
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
      .prepare("SELECT overall_rating, criteria_ratings FROM reviews WHERE target_type = 'professor' AND target_id = ? AND deleted_at IS NULL")
      .bind(id)
      .all();

    const scoredRows = (revRows || []).filter((r: any) => {
      let c: any = null;
      if (r.criteria_ratings) {
        try {
          c = typeof r.criteria_ratings === "string" ? JSON.parse(r.criteria_ratings) : r.criteria_ratings;
        } catch {}
      }
      const hasC = c && typeof c === "object" && Object.values(c).some((v: any) => typeof v === "number" && v > 0);
      return hasC && Number(r.overall_rating) > 0;
    });

    const revCount = revRows?.length || 0;
    const avg =
      scoredRows.length > 0
        ? scoredRows.reduce((sum: number, r: any) => sum + Number(r.overall_rating), 0) / scoredRows.length
        : 0;

    const firstName = (p as any).first_name || "";
    const lastName = (p as any).last_name || "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    return {
      id: (p as any).id,
      code: (p as any).code || undefined,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      name: fullName || "استاد",
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
  firstName?: string;
  lastName?: string;
  name?: string;
  code?: string;
  title?: string;
  email?: string;
  avatarUrl?: string;
  links?: Record<string, string>;
}): Promise<Professor> {
  const id = `prf_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  let firstName = (data.firstName || "").trim();
  let lastName = (data.lastName || "").trim();

  if ((!firstName || !lastName) && data.name) {
    const parts = data.name.trim().split(/\s+/);
    if (!firstName && parts.length > 0) firstName = parts[0];
    if (!lastName && parts.length > 1) lastName = parts.slice(1).join(" ");
    if (!lastName && firstName) lastName = firstName;
  }

  if (!firstName) firstName = "استاد";
  if (!lastName) lastName = "نامشخص";

  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  let code: string;
  if (data.code?.trim()) {
    code = data.code.trim().toUpperCase();
    if (await isCodeDuplicate("professors", code)) {
      throw new Error(`کد شناسایی استاد «${code}» تکراری است و قبلاً در سامانه ثبت شده است.`);
    }
  } else {
    code = await generateUniqueCode("professors", "PRF");
  }

  const cleanTitle = data.title?.trim() || null;
  const cleanEmail = data.email?.trim() || null;
  const cleanAvatarUrl = data.avatarUrl?.trim() || null;
  const linksStr = data.links ? JSON.stringify(data.links) : null;

  const d1 = getD1();
  if (!d1) throw new Error("پایگاه‌داده در دسترس نیست.");

  try {
    await d1
      .prepare(
        `INSERT INTO professors (id, code, faculty_id, first_name, last_name, title, email, avatar_url, links, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, code, data.facultyId, firstName, lastName, cleanTitle, cleanEmail, cleanAvatarUrl, linksStr, now)
      .run();

    return {
      id,
      code,
      facultyId: data.facultyId,
      firstName,
      lastName,
      name: fullName,
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
  data: Partial<Omit<Professor, "id" | "createdAt">>
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
    if (data.firstName !== undefined) {
      sets.push("first_name = ?");
      params.push(data.firstName.trim());
    }
    if (data.lastName !== undefined) {
      sets.push("last_name = ?");
      params.push(data.lastName.trim());
    }
    if (data.name && data.firstName === undefined && data.lastName === undefined) {
      const parts = data.name.trim().split(/\s+/);
      const fName = parts[0] || "";
      const lName = parts.slice(1).join(" ") || fName;
      sets.push("first_name = ?");
      params.push(fName);
      sets.push("last_name = ?");
      params.push(lName);
    }
    if (data.code && data.code.trim()) {
      const cleanCode = data.code.trim().toUpperCase();
      if (await isCodeDuplicate("professors", cleanCode, id)) {
        throw new Error(`کد شناسایی استاد «${cleanCode}» تکراری است و به استاد دیگری اختصاص دارد.`);
      }
      sets.push("code = ?");
      params.push(cleanCode);
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
    throw err;
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

