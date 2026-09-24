import type { PhysicalFaculty } from "../types";
import { getD1 } from "./client";
import { generateUniqueCode, isCodeDuplicate } from "./code-generator";

function mapRowToPhysicalFaculty(r: any): PhysicalFaculty {
  return {
    id: r.id,
    name: r.name,
    code: r.code || undefined,
    imageUrl: r.image_url || undefined,
    latitude: r.latitude !== null && r.latitude !== undefined ? Number(r.latitude) : null,
    longitude: r.longitude !== null && r.longitude !== undefined ? Number(r.longitude) : null,
    address: r.address || undefined,
    description: r.description || undefined,
    createdAt: r.created_at,
    deletedAt: r.deleted_at || null,
  };
}

export async function getPhysicalFaculties(
  includeDeleted = false,
  search?: string
): Promise<PhysicalFaculty[]> {
  const d1 = getD1();
  if (!d1) return [];

  try {
    let query = `SELECT * FROM physical_faculties`;
    const conditions: string[] = [];
    const params: any[] = [];

    if (!includeDeleted) {
      conditions.push(`deleted_at IS NULL`);
    }

    if (search && search.trim()) {
      conditions.push(`(name LIKE ? OR code LIKE ? OR address LIKE ?)`);
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(" AND ");
    }

    query += ` ORDER BY name ASC`;

    const stmt = params.length > 0 ? d1.prepare(query).bind(...params) : d1.prepare(query);
    const { results } = await stmt.all();

    return (results || []).map(mapRowToPhysicalFaculty);
  } catch (err) {
    console.error("D1 getPhysicalFaculties error:", err);
    return [];
  }
}

export async function getPhysicalFacultyById(id: string): Promise<PhysicalFaculty | null> {
  const d1 = getD1();
  if (!d1 || !id) return null;

  try {
    const row = await d1
      .prepare(`SELECT * FROM physical_faculties WHERE id = ? AND deleted_at IS NULL LIMIT 1`)
      .bind(id)
      .first();

    return row ? mapRowToPhysicalFaculty(row) : null;
  } catch (err) {
    console.error("D1 getPhysicalFacultyById error:", err);
    return null;
  }
}

export async function createPhysicalFaculty(data: {
  id?: string;
  name: string;
  code?: string;
  imageUrl?: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  description?: string;
}): Promise<PhysicalFaculty> {
  const d1 = getD1();
  if (!d1) throw new Error("پایگاه داده در دسترس نیست.");

  if (!data.name || !data.name.trim()) {
    throw new Error("نام دانشکده فیزیکی الزامی است.");
  }

  const id = data.id || `pfac_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  let code = data.code?.trim() || "";
  if (!code) {
    code = await generateUniqueCode("physical_faculties", "PFAC");
  } else {
    const isDup = await isCodeDuplicate("physical_faculties", code);
    if (isDup) {
      throw new Error(`کد "${code}" تکراری است و قبلاً برای دانشکده دیگری استفاده شده است.`);
    }
  }

  const createdAt = new Date().toISOString();
  const lat = data.latitude !== null && data.latitude !== undefined && !isNaN(Number(data.latitude))
    ? Number(data.latitude)
    : null;
  const lon = data.longitude !== null && data.longitude !== undefined && !isNaN(Number(data.longitude))
    ? Number(data.longitude)
    : null;

  await d1
    .prepare(
      `INSERT INTO physical_faculties (id, name, code, image_url, latitude, longitude, address, description, created_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
    )
    .bind(
      id,
      data.name.trim(),
      code,
      data.imageUrl?.trim() || null,
      lat,
      lon,
      data.address?.trim() || null,
      data.description?.trim() || null,
      createdAt
    )
    .run();

  return {
    id,
    name: data.name.trim(),
    code,
    imageUrl: data.imageUrl?.trim() || undefined,
    latitude: lat,
    longitude: lon,
    address: data.address?.trim() || undefined,
    description: data.description?.trim() || undefined,
    createdAt,
    deletedAt: null,
  };
}

export async function updatePhysicalFaculty(
  id: string,
  data: {
    name?: string;
    code?: string;
    imageUrl?: string;
    latitude?: number | null;
    longitude?: number | null;
    address?: string;
    description?: string;
  }
): Promise<PhysicalFaculty | null> {
  const d1 = getD1();
  if (!d1 || !id) return null;

  const existing = await getPhysicalFacultyById(id);
  if (!existing) {
    throw new Error("دانشکده فیزیکی مورد نظر یافت نشد.");
  }

  const name = data.name !== undefined ? data.name.trim() : existing.name;
  if (!name) {
    throw new Error("نام دانشکده نمی‌تواند خالی باشد.");
  }

  let code = existing.code;
  if (data.code !== undefined) {
    const trimmedCode = data.code.trim();
    if (trimmedCode && trimmedCode !== existing.code) {
      const isDup = await isCodeDuplicate("physical_faculties", trimmedCode, id);
      if (isDup) {
        throw new Error(`کد "${trimmedCode}" تکراری است.`);
      }
      code = trimmedCode;
    } else if (!trimmedCode) {
      code = undefined;
    }
  }

  const imageUrl = data.imageUrl !== undefined ? data.imageUrl.trim() || null : (existing.imageUrl || null);
  const lat = data.latitude !== undefined
    ? (data.latitude !== null && !isNaN(Number(data.latitude)) ? Number(data.latitude) : null)
    : (existing.latitude ?? null);
  const lon = data.longitude !== undefined
    ? (data.longitude !== null && !isNaN(Number(data.longitude)) ? Number(data.longitude) : null)
    : (existing.longitude ?? null);
  const address = data.address !== undefined ? data.address.trim() || null : (existing.address || null);
  const description = data.description !== undefined ? data.description.trim() || null : (existing.description || null);

  await d1
    .prepare(
      `UPDATE physical_faculties
       SET name = ?, code = ?, image_url = ?, latitude = ?, longitude = ?, address = ?, description = ?
       WHERE id = ?`
    )
    .bind(name, code || null, imageUrl, lat, lon, address, description, id)
    .run();

  return {
    ...existing,
    name,
    code: code || undefined,
    imageUrl: imageUrl || undefined,
    latitude: lat,
    longitude: lon,
    address: address || undefined,
    description: description || undefined,
  };
}

export async function deletePhysicalFaculty(id: string, hard = false): Promise<boolean> {
  const d1 = getD1();
  if (!d1 || !id) return false;

  try {
    if (hard) {
      await d1.prepare(`DELETE FROM physical_faculties WHERE id = ?`).bind(id).run();
    } else {
      const now = new Date().toISOString();
      await d1
        .prepare(`UPDATE physical_faculties SET deleted_at = ? WHERE id = ?`)
        .bind(now, id)
        .run();
    }
    return true;
  } catch (err) {
    console.error("D1 deletePhysicalFaculty error:", err);
    return false;
  }
}

export async function restorePhysicalFaculty(id: string): Promise<boolean> {
  const d1 = getD1();
  if (!d1 || !id) return false;

  try {
    await d1
      .prepare(`UPDATE physical_faculties SET deleted_at = NULL WHERE id = ?`)
      .bind(id)
      .run();
    return true;
  } catch (err) {
    console.error("D1 restorePhysicalFaculty error:", err);
    return false;
  }
}
