import type {
  Faculty,
  FacultyLink,
  Major,
  Track,
  Category,
  VisualCategory,
  RuleCategory,
  TrackCourseAssignment,
  RuleGroupNode,
} from "../types";
import { getD1 } from "./client";
import { getCached, setCached, invalidateCache } from "../server-cache";

// ----------------------------------------------------
// 1. FACULTIES CRUD
// ----------------------------------------------------
export async function getFaculties(): Promise<Faculty[]> {
  const cacheKey = "faculties";
  const cached = getCached<Faculty[]>(cacheKey);
  if (cached) return cached;

  const d1 = getD1();
  if (!d1) return [];

  try {
    const { results } = await d1
      .prepare("SELECT * FROM faculties WHERE deleted_at IS NULL ORDER BY name ASC")
      .all();

    let allLinks: any[] = [];
    try {
      const { results: linkRows } = await d1
        .prepare("SELECT target_faculty_id, source_faculty_id FROM faculty_links")
        .all();
      allLinks = linkRows || [];
    } catch {}

    const list = (results || []).map((r: any) => {
      const linkedFacultyIds = allLinks
        .filter((l: any) => l.target_faculty_id === r.id)
        .map((l: any) => l.source_faculty_id);

      return {
        id: r.id,
        name: r.name,
        code: r.code,
        createdAt: r.created_at,
        deletedAt: r.deleted_at || null,
        linkedFacultyIds,
      };
    });

    setCached(cacheKey, list);
    return list;
  } catch (err) {
    console.error("D1 getFaculties error:", err);
    return [];
  }
}

export async function getFacultyLinks(targetFacultyId?: string): Promise<FacultyLink[]> {
  const d1 = getD1();
  if (!d1) return [];

  try {
    let query = `
      SELECT fl.id, fl.target_faculty_id, fl.source_faculty_id, fl.created_at,
             sf.name AS source_faculty_name, sf.code AS source_faculty_code
      FROM faculty_links fl
      JOIN faculties sf ON fl.source_faculty_id = sf.id
      WHERE sf.deleted_at IS NULL
    `;
    const params: any[] = [];
    if (targetFacultyId) {
      query += " AND fl.target_faculty_id = ?";
      params.push(targetFacultyId);
    }
    query += " ORDER BY sf.name ASC";

    const { results } = await d1.prepare(query).bind(...params).all();
    return (results || []).map((r: any) => ({
      id: r.id,
      targetFacultyId: r.target_faculty_id,
      sourceFacultyId: r.source_faculty_id,
      sourceFacultyName: r.source_faculty_name,
      sourceFacultyCode: r.source_faculty_code,
      createdAt: r.created_at,
    }));
  } catch (err) {
    console.error("D1 getFacultyLinks error:", err);
    return [];
  }
}

export async function setFacultyLinks(
  targetFacultyId: string,
  sourceFacultyIds: string[]
): Promise<void> {
  const d1 = getD1();
  if (!d1) return;

  try {
    // Delete existing links for this target faculty
    await d1
      .prepare("DELETE FROM faculty_links WHERE target_faculty_id = ?")
      .bind(targetFacultyId)
      .run();

    // Insert new links (filtering out self-links and duplicates)
    const validSources = Array.from(
      new Set(sourceFacultyIds.filter((id) => id && id !== targetFacultyId))
    );
    const now = new Date().toISOString();

    for (const sourceId of validSources) {
      const linkId = `flink_${crypto.randomUUID().slice(0, 8)}`;
      await d1
        .prepare(
          "INSERT INTO faculty_links (id, target_faculty_id, source_faculty_id, created_at) VALUES (?, ?, ?, ?)"
        )
        .bind(linkId, targetFacultyId, sourceId, now)
        .run();
    }
    invalidateCache("faculties");
    invalidateCache("courses");
    invalidateCache("professors");
  } catch (err) {
    console.error("D1 setFacultyLinks error:", err);
    throw err;
  }
}

export async function getEffectiveFacultyIds(targetFacultyId: string): Promise<string[]> {
  const d1 = getD1();
  if (!d1 || !targetFacultyId) return targetFacultyId ? [targetFacultyId] : [];

  try {
    const { results } = await d1
      .prepare(
        `SELECT source_faculty_id
         FROM faculty_links fl
         JOIN faculties sf ON fl.source_faculty_id = sf.id
         WHERE fl.target_faculty_id = ? AND sf.deleted_at IS NULL`
      )
      .bind(targetFacultyId)
      .all();

    const linkedIds = (results || []).map((r: any) => r.source_faculty_id as string);
    return Array.from(new Set([targetFacultyId, ...linkedIds]));
  } catch (err) {
    console.error("D1 getEffectiveFacultyIds error:", err);
    return [targetFacultyId];
  }
}

export async function createFaculty(name: string, code: string): Promise<Faculty> {
  const id = `fac_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const cleanCode = code.trim().toUpperCase();

  const d1 = getD1();
  if (!d1) throw new Error("پایگاه‌داده در دسترس نیست.");

  try {
    await d1
      .prepare("INSERT INTO faculties (id, name, code, created_at) VALUES (?, ?, ?, ?)")
      .bind(id, name.trim(), cleanCode, now)
      .run();

    invalidateCache("faculties");
    invalidateCache("courses");
    invalidateCache("professors");
  } catch (err) {
    console.error("D1 createFaculty error:", err);
    throw err;
  }

  return {
    id,
    name: name.trim(),
    code: cleanCode,
    createdAt: now,
    deletedAt: null,
  };
}

export async function updateFaculty(id: string, name: string, code: string): Promise<Faculty | null> {
  const cleanCode = code.trim().toUpperCase();
  const d1 = getD1();
  if (!d1) return null;

  try {
    await d1
      .prepare("UPDATE faculties SET name = ?, code = ? WHERE id = ?")
      .bind(name.trim(), cleanCode, id)
      .run();

    invalidateCache("faculties");
    invalidateCache("courses");
    invalidateCache("professors");

    const updated = await d1.prepare("SELECT * FROM faculties WHERE id = ?").bind(id).first();
    if (updated) {
      return {
        id: (updated as any).id,
        name: (updated as any).name,
        code: (updated as any).code,
        createdAt: (updated as any).created_at,
        deletedAt: (updated as any).deleted_at || null,
      };
    }
  } catch (err) {
    console.error("D1 updateFaculty error:", err);
  }
  return null;
}

export async function deleteFaculty(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const d1 = getD1();
  if (!d1) return false;

  try {
    await d1.prepare("UPDATE faculties SET deleted_at = ? WHERE id = ?").bind(now, id).run();
    invalidateCache("faculties");
    invalidateCache("courses");
    invalidateCache("professors");
    return true;
  } catch (err) {
    console.error("D1 deleteFaculty error:", err);
    return false;
  }
}

// ----------------------------------------------------
// 2. MAJORS CRUD
// ----------------------------------------------------
export async function getMajors(facultyId?: string): Promise<Major[]> {
  const cacheKey = `majors_${facultyId || "all"}`;
  const cached = getCached<Major[]>(cacheKey);
  if (cached) return cached;

  const d1 = getD1();
  if (!d1) return [];

  try {
    let query = "SELECT * FROM majors WHERE deleted_at IS NULL";
    const params: any[] = [];
    if (facultyId) {
      query += " AND faculty_id = ?";
      params.push(facultyId);
    }
    query += " ORDER BY name ASC";
    const { results } = await d1.prepare(query).bind(...params).all();
    const list = (results || []).map((r: any) => ({
      id: r.id,
      facultyId: r.faculty_id,
      name: r.name,
      code: r.code,
      createdAt: r.created_at,
      deletedAt: r.deleted_at || null,
    }));

    setCached(cacheKey, list);
    return list;
  } catch (err) {
    console.error("D1 getMajors error:", err);
    return [];
  }
}

export async function createMajor(facultyId: string, name: string, code: string): Promise<Major> {
  const id = `maj_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const cleanCode = code.trim().toUpperCase();

  const d1 = getD1();
  if (!d1) throw new Error("پایگاه‌داده در دسترس نیست.");

  try {
    await d1
      .prepare("INSERT INTO majors (id, faculty_id, name, code, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(id, facultyId, name.trim(), cleanCode, now)
      .run();

    invalidateCache("majors");
  } catch (err) {
    console.error("D1 createMajor error:", err);
    throw err;
  }

  return {
    id,
    facultyId,
    name: name.trim(),
    code: cleanCode,
    createdAt: now,
    deletedAt: null,
  };
}

export async function updateMajor(id: string, name: string, code: string): Promise<Major | null> {
  const cleanCode = code.trim().toUpperCase();
  const d1 = getD1();
  if (!d1) return null;

  try {
    await d1
      .prepare("UPDATE majors SET name = ?, code = ? WHERE id = ?")
      .bind(name.trim(), cleanCode, id)
      .run();

    invalidateCache("majors");

    const row = await d1.prepare("SELECT * FROM majors WHERE id = ?").bind(id).first();
    if (row) {
      return {
        id: (row as any).id,
        facultyId: (row as any).faculty_id,
        name: (row as any).name,
        code: (row as any).code,
        createdAt: (row as any).created_at,
        deletedAt: (row as any).deleted_at || null,
      };
    }
  } catch (err) {
    console.error("D1 updateMajor error:", err);
  }
  return null;
}

export async function deleteMajor(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const d1 = getD1();
  if (!d1) return false;

  try {
    await d1.prepare("UPDATE majors SET deleted_at = ? WHERE id = ?").bind(now, id).run();
    invalidateCache("majors");
    return true;
  } catch (err) {
    console.error("D1 deleteMajor error:", err);
    return false;
  }
}

// ----------------------------------------------------
// 3. TRACKS CRUD
// ----------------------------------------------------
export async function getTracks(majorId?: string): Promise<Track[]> {
  const cacheKey = `tracks_${majorId || "all"}`;
  const cached = getCached<Track[]>(cacheKey);
  if (cached) return cached;

  const d1 = getD1();
  if (!d1) return [];

  try {
    let query = "SELECT * FROM tracks WHERE deleted_at IS NULL";
    const params: any[] = [];
    if (majorId) {
      query += " AND major_id = ?";
      params.push(majorId);
    }
    query += " ORDER BY name ASC";
    const { results } = await d1.prepare(query).bind(...params).all();
    const list = (results || []).map((r: any) => {
      let parsedRules: RuleGroupNode | undefined = undefined;
      if (r.rules_tree) {
        try {
          parsedRules = typeof r.rules_tree === "string" ? JSON.parse(r.rules_tree) : r.rules_tree;
        } catch {
          parsedRules = undefined;
        }
      }
      return {
        id: r.id,
        majorId: r.major_id,
        name: r.name,
        code: r.code,
        rulesTree: parsedRules,
        createdAt: r.created_at,
        deletedAt: r.deleted_at || null,
      };
    });

    setCached(cacheKey, list);
    return list;
  } catch (err) {
    console.error("D1 getTracks error:", err);
    return [];
  }
}

export async function getTrackById(id: string): Promise<Track | null> {
  const d1 = getD1();
  if (!d1) return null;

  try {
    const r = await d1.prepare("SELECT * FROM tracks WHERE id = ? AND deleted_at IS NULL").bind(id).first();
    if (r) {
      let parsedRules: any = undefined;
      if ((r as any).rules_tree) {
        try {
          parsedRules = typeof (r as any).rules_tree === "string" ? JSON.parse((r as any).rules_tree) : (r as any).rules_tree;
        } catch {
          parsedRules = undefined;
        }
      }
      return {
        id: (r as any).id,
        majorId: (r as any).major_id,
        name: (r as any).name,
        code: (r as any).code,
        rulesTree: parsedRules,
        createdAt: (r as any).created_at,
        deletedAt: (r as any).deleted_at || null,
      };
    }
  } catch (err) {
    console.error("D1 getTrackById error:", err);
  }
  return null;
}

export async function createTrack(
  majorId: string,
  name: string,
  code: string,
  rulesTree?: any
): Promise<Track> {
  const id = `trk_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const cleanCode = code.trim().toUpperCase();
  const rulesJson = rulesTree ? JSON.stringify(rulesTree) : JSON.stringify({ id: "grp_root", type: "GROUP", operator: "AND", children: [] });

  const d1 = getD1();
  if (!d1) throw new Error("پایگاه‌داده در دسترس نیست.");

  try {
    await d1
      .prepare("INSERT INTO tracks (id, major_id, name, code, rules_tree, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, majorId, name.trim(), cleanCode, rulesJson, now)
      .run();

    invalidateCache("tracks");
  } catch (err) {
    console.error("D1 createTrack error:", err);
    throw err;
  }

  return {
    id,
    majorId,
    name: name.trim(),
    code: cleanCode,
    rulesTree: rulesTree || { id: "grp_root", type: "GROUP", operator: "AND", children: [] },
    createdAt: now,
    deletedAt: null,
  };
}

export async function updateTrack(
  id: string,
  name: string,
  code: string,
  rulesTree?: any
): Promise<Track | null> {
  const cleanCode = code.trim().toUpperCase();
  const d1 = getD1();
  if (!d1) return null;

  try {
    if (rulesTree !== undefined) {
      const rulesJson = JSON.stringify(rulesTree);
      await d1
        .prepare("UPDATE tracks SET name = ?, code = ?, rules_tree = ? WHERE id = ?")
        .bind(name.trim(), cleanCode, rulesJson, id)
        .run();
    } else {
      await d1
        .prepare("UPDATE tracks SET name = ?, code = ? WHERE id = ?")
        .bind(name.trim(), cleanCode, id)
        .run();
    }

    invalidateCache("tracks");

    const row = await d1.prepare("SELECT * FROM tracks WHERE id = ?").bind(id).first();
    if (row) {
      let parsedRules: any = undefined;
      if ((row as any).rules_tree) {
        try {
          parsedRules = typeof (row as any).rules_tree === "string" ? JSON.parse((row as any).rules_tree) : (row as any).rules_tree;
        } catch {}
      }
      return {
        id: (row as any).id,
        majorId: (row as any).major_id,
        name: (row as any).name,
        code: (row as any).code,
        rulesTree: parsedRules,
        createdAt: (row as any).created_at,
        deletedAt: (row as any).deleted_at || null,
      };
    }
  } catch (err) {
    console.error("D1 updateTrack error:", err);
  }
  return null;
}

export async function updateTrackRules(trackId: string, rulesTree: any): Promise<boolean> {
  const rulesJson = JSON.stringify(rulesTree);
  const d1 = getD1();
  if (!d1) return false;

  try {
    await d1.prepare("UPDATE tracks SET rules_tree = ? WHERE id = ?").bind(rulesJson, trackId).run();
    invalidateCache("tracks");
    return true;
  } catch (err) {
    console.error("D1 updateTrackRules error:", err);
    return false;
  }
}

export async function deleteTrack(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const d1 = getD1();
  if (!d1) return false;

  try {
    await d1.prepare("UPDATE tracks SET deleted_at = ? WHERE id = ?").bind(now, id).run();
    invalidateCache("tracks");
    return true;
  } catch (err) {
    console.error("D1 deleteTrack error:", err);
    return false;
  }
}

// ----------------------------------------------------
// 4. CATEGORIES (Unified hierarchical categories with color per track)
// ----------------------------------------------------
export async function getCategories(trackId: string): Promise<Category[]> {
  const cacheKey = `categories_${trackId}`;
  const cached = getCached<Category[]>(cacheKey);
  if (cached) return cached;

  const d1 = getD1();
  if (!d1) return [];

  try {
    const { results } = await d1
      .prepare("SELECT * FROM categories WHERE track_id = ? ORDER BY sort_order ASC, created_at ASC")
      .bind(trackId)
      .all();
    const list = (results || []).map((r: any) => ({
      id: r.id,
      trackId: r.track_id,
      code: r.code || undefined,
      parentId: r.parent_id || null,
      name: r.name,
      color: r.color || "#3b82f6",
      sortOrder: Number(r.sort_order) || 0,
      createdAt: r.created_at,
    }));

    setCached(cacheKey, list);
    return list;
  } catch (err) {
    console.error("D1 getCategories error:", err);
    return [];
  }
}

export async function createCategory(
  trackIdOrData: string | { trackId: string; name: string; color?: string; parentId?: string | null; sortOrder?: number; code?: string },
  nameArg?: string,
  colorArg?: string,
  sortOrderArg = 0,
  codeArg?: string,
  parentIdArg?: string | null
): Promise<Category> {
  let trackId: string;
  let name: string;
  let color: string;
  let parentId: string | null;
  let sortOrder: number;
  let code: string | undefined;

  if (typeof trackIdOrData === "object" && trackIdOrData !== null) {
    trackId = trackIdOrData.trackId;
    name = trackIdOrData.name;
    color = trackIdOrData.color || "#3b82f6";
    parentId = trackIdOrData.parentId || null;
    sortOrder = trackIdOrData.sortOrder ?? 0;
    code = trackIdOrData.code?.trim() || undefined;
  } else {
    trackId = trackIdOrData;
    name = nameArg!;
    color = colorArg || "#3b82f6";
    parentId = parentIdArg || null;
    sortOrder = sortOrderArg;
    code = codeArg?.trim() || undefined;
  }

  const id = `cat_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const cleanCode = code?.trim()
    ? code.trim().toUpperCase()
    : `CAT-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

  const d1 = getD1();
  if (!d1) throw new Error("پایگاه‌داده در دسترس نیست.");

  try {
    await d1
      .prepare(
        "INSERT INTO categories (id, track_id, parent_id, code, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(id, trackId, parentId, cleanCode, name.trim(), color, sortOrder, now)
      .run();

    invalidateCache("categories");
  } catch (err) {
    console.error("D1 createCategory error:", err);
    throw err;
  }

  return {
    id,
    trackId,
    code: cleanCode,
    parentId,
    name: name.trim(),
    color,
    sortOrder,
    createdAt: now,
  };
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const d1 = getD1();
  if (!d1) return null;

  try {
    const r: any = await d1.prepare("SELECT * FROM categories WHERE id = ?").bind(id).first();
    if (!r) return null;
    return {
      id: r.id,
      trackId: r.track_id,
      code: r.code || undefined,
      parentId: r.parent_id || null,
      name: r.name,
      color: r.color || "#3b82f6",
      sortOrder: Number(r.sort_order) || 0,
      createdAt: r.created_at,
    };
  } catch (err) {
    console.error("D1 getCategoryById error:", err);
    return null;
  }
}

export async function updateCategory(
  id: string,
  data: { name?: string; color?: string; parentId?: string | null; sortOrder?: number; code?: string | null }
): Promise<Category | null> {
  const d1 = getD1();
  if (!d1) return null;

  try {
    const existing = await d1.prepare("SELECT * FROM categories WHERE id = ?").bind(id).first();
    if (!existing) return null;

    const name = data.name !== undefined ? data.name.trim() : (existing as any).name;
    const color = data.color !== undefined ? data.color : ((existing as any).color || "#3b82f6");
    const parentId = data.parentId !== undefined ? (data.parentId || null) : (existing as any).parent_id;
    const sortOrder = data.sortOrder !== undefined ? data.sortOrder : (existing as any).sort_order;
    const code =
      data.code !== undefined
        ? (data.code?.trim() ? data.code.trim().toUpperCase() : (existing as any).code || `CAT-${crypto.randomUUID().slice(0, 6).toUpperCase()}`)
        : ((existing as any).code || `CAT-${crypto.randomUUID().slice(0, 6).toUpperCase()}`);

    await d1
      .prepare("UPDATE categories SET code = ?, name = ?, color = ?, parent_id = ?, sort_order = ? WHERE id = ?")
      .bind(code, name, color, parentId, sortOrder, id)
      .run();

    invalidateCache("categories");

    return {
      id,
      trackId: (existing as any).track_id,
      code,
      parentId,
      name,
      color,
      sortOrder,
      createdAt: (existing as any).created_at,
    };
  } catch (err) {
    console.error("D1 updateCategory error:", err);
    return null;
  }
}

export async function deleteCategory(id: string): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;

  try {
    // Recursively delete children first
    const { results: childRows } = await d1
      .prepare("SELECT id FROM categories WHERE parent_id = ?")
      .bind(id)
      .all();
    for (const child of childRows || []) {
      await deleteCategory((child as any).id);
    }

    // Unassign courses assigned to this category
    await d1.prepare("UPDATE track_course_assignments SET category_id = NULL WHERE category_id = ?").bind(id).run();
    // Clean up orphan assignments
    await d1.prepare("DELETE FROM track_course_assignments WHERE category_id IS NULL").run();
    await d1.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();

    invalidateCache("categories");
    invalidateCache("track_assignments");
    return true;
  } catch (err) {
    console.error("D1 deleteCategory error:", err);
    return false;
  }
}

export async function reorderCategories(
  items: { id: string; sortOrder: number; parentId?: string | null }[]
): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;

  try {
    const stmts = items.map((item) => {
      if (item.parentId !== undefined) {
        return d1
          .prepare("UPDATE categories SET sort_order = ?, parent_id = ? WHERE id = ?")
          .bind(item.sortOrder, item.parentId || null, item.id);
      }
      return d1.prepare("UPDATE categories SET sort_order = ? WHERE id = ?").bind(item.sortOrder, item.id);
    });
    await d1.batch(stmts);
    invalidateCache("categories");
    return true;
  } catch (err) {
    console.error("D1 reorderCategories error:", err);
    return false;
  }
}

// Backwards compatibility aliases
export const getVisualCategories = getCategories;
export const getRuleCategories = getCategories;
export const createVisualCategory = createCategory;
export const createRuleCategory = (
  trackIdOrData: any,
  nameArg?: any,
  parentIdArg?: any,
  sortOrderArg = 0,
  codeArg?: any
) => {
  if (typeof trackIdOrData === "object" && trackIdOrData !== null) {
    return createCategory(trackIdOrData);
  }
  return createCategory(trackIdOrData, nameArg, "#3b82f6", sortOrderArg, codeArg, parentIdArg);
};
export const updateVisualCategory = updateCategory;
export const updateRuleCategory = updateCategory;
export const deleteVisualCategory = deleteCategory;
export const deleteRuleCategory = deleteCategory;
export const reorderVisualCategories = reorderCategories;
export const reorderRuleCategories = reorderCategories;

// ----------------------------------------------------
// 5. TRACK COURSE ASSIGNMENTS
// ----------------------------------------------------
export async function getTrackAssignments(trackId: string): Promise<TrackCourseAssignment[]> {
  const cacheKey = `track_assignments_${trackId}`;
  const cached = getCached<TrackCourseAssignment[]>(cacheKey);
  if (cached) return cached;

  const d1 = getD1();
  if (!d1) return [];

  try {
    const query = `
      SELECT a.id, a.track_id, a.course_id, a.category_id,
             c.name AS course_name, c.code AS course_code, c.units AS course_units
      FROM track_course_assignments a
      LEFT JOIN courses c ON a.course_id = c.id
      WHERE a.track_id = ?
    `;
    const { results } = await d1.prepare(query).bind(trackId).all();
    const list = (results || []).map((r: any) => ({
      id: r.id,
      trackId: r.track_id,
      courseId: r.course_id,
      categoryId: r.category_id || null,
      visualCategoryId: r.category_id || null,
      ruleCategoryId: r.category_id || null,
      courseName: r.course_name || "نامشخص",
      courseCode: r.course_code || "---",
      units: Number(r.course_units) || 3,
    }));

    setCached(cacheKey, list);
    return list;
  } catch (err) {
    console.error("D1 getTrackAssignments error:", err);
    return [];
  }
}

export async function assignCourseToCategory(
  trackId: string,
  courseId: string,
  categoryId?: string | null
): Promise<TrackCourseAssignment> {
  const id = `assign_${trackId}_${courseId}`;
  const d1 = getD1();
  if (d1) {
    try {
      if (!categoryId) {
        await d1
          .prepare("DELETE FROM track_course_assignments WHERE track_id = ? AND course_id = ?")
          .bind(trackId, courseId)
          .run();
      } else {
        const upsertSql = `
          INSERT INTO track_course_assignments (id, track_id, course_id, category_id)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(track_id, course_id) DO UPDATE SET
            category_id = excluded.category_id
        `;
        await d1
          .prepare(upsertSql)
          .bind(id, trackId, courseId, categoryId)
          .run();
      }
      invalidateCache("track_assignments");
      invalidateCache("courses");
    } catch (err) {
      console.error("D1 assignCourseToCategory error:", err);
    }
  }

  return {
    id,
    trackId,
    courseId,
    categoryId: categoryId || null,
    visualCategoryId: categoryId || null,
    ruleCategoryId: categoryId || null,
  };
}

export async function assignCourseToCategories(
  trackId: string,
  courseId: string,
  visualCategoryId?: string | null,
  ruleCategoryId?: string | null
): Promise<TrackCourseAssignment> {
  const catId = ruleCategoryId || visualCategoryId || null;
  return assignCourseToCategory(trackId, courseId, catId);
}

export async function bulkAssignTrackCourses(
  trackId: string,
  assignments: { courseId: string; categoryId?: string | null; visualCategoryId?: string | null; ruleCategoryId?: string | null }[]
): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;
  if (!assignments || assignments.length === 0) return true;

  const upsertSql = `
    INSERT INTO track_course_assignments (id, track_id, course_id, category_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(track_id, course_id) DO UPDATE SET
      category_id = excluded.category_id
  `;

  const stmts: any[] = [];
  for (const item of assignments) {
    const id = `assign_${trackId}_${item.courseId}`;
    const catId = item.categoryId ?? item.ruleCategoryId ?? item.visualCategoryId ?? null;
    stmts.push(
      d1.prepare(upsertSql).bind(
        id,
        trackId,
        item.courseId,
        catId
      )
    );
  }

  for (let i = 0; i < stmts.length; i += 100) {
    await d1.batch(stmts.slice(i, i + 100));
  }
  invalidateCache("track_assignments");
  invalidateCache("courses");
  return true;
}

export async function assignCategoryCourses(
  trackId: string,
  arg2: any,
  arg3: any,
  arg4?: any
): Promise<boolean> {
  let categoryId: string;
  let courseIds: string[];

  if (typeof arg2 === "string" && Array.isArray(arg3)) {
    categoryId = arg2;
    courseIds = arg3;
  } else {
    // Legacy signature: (trackId, type, categoryId, courseIds)
    categoryId = arg3;
    courseIds = arg4 || [];
  }

  const d1 = getD1();
  if (!d1) return false;

  try {
    // Clear previous assignments for this category
    const clearStmt = d1
      .prepare(
        "UPDATE track_course_assignments SET category_id = NULL WHERE track_id = ? AND category_id = ?"
      )
      .bind(trackId, categoryId);

    const upsertSql = `
      INSERT INTO track_course_assignments (id, track_id, course_id, category_id)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(track_id, course_id) DO UPDATE SET category_id = excluded.category_id
    `;

    const insertStmts: any[] = [];
    for (const courseId of courseIds) {
      const id = `assign_${trackId}_${courseId}`;
      insertStmts.push(d1.prepare(upsertSql).bind(id, trackId, courseId, categoryId));
    }

    // Batch clear and upsert statements in chunks of 100
    const allStmts = [clearStmt, ...insertStmts];
    for (let i = 0; i < allStmts.length; i += 100) {
      await d1.batch(allStmts.slice(i, i + 100));
    }

    // Clean up orphan rows where category_id is NULL
    await d1
      .prepare("DELETE FROM track_course_assignments WHERE track_id = ? AND category_id IS NULL")
      .bind(trackId)
      .run();

    invalidateCache("track_assignments");
    invalidateCache("courses");
    return true;
  } catch (err) {
    console.error("D1 assignCategoryCourses error:", err);
    return false;
  }
}

export async function clearCategoryCourses(
  trackId: string,
  arg2: any,
  arg3?: any
): Promise<boolean> {
  const categoryId: string = typeof arg2 === "string" && arg3 ? arg3 : arg2;
  const d1 = getD1();
  if (!d1) return false;

  try {
    await d1
      .prepare("UPDATE track_course_assignments SET category_id = NULL WHERE track_id = ? AND category_id = ?")
      .bind(trackId, categoryId)
      .run();
    // Clean up orphan rows
    await d1
      .prepare("DELETE FROM track_course_assignments WHERE track_id = ? AND category_id IS NULL")
      .bind(trackId)
      .run();
    invalidateCache("track_assignments");
    invalidateCache("courses");
    return true;
  } catch (err) {
    console.error("D1 clearCategoryCourses error:", err);
    return false;
  }
}

// ----------------------------------------------------
// 6. TRACK STRUCTURE CLONING
// ----------------------------------------------------
export async function cloneTrackStructure(
  sourceTrackId: string,
  targetTrackId: string,
  options: {
    cloneCategories?: boolean;
    cloneVisualCategories?: boolean;
    cloneRuleCategories?: boolean;
    cloneRulesTree?: boolean;
    cloneAssignments?: boolean;
  } = {
    cloneCategories: true,
    cloneRulesTree: true,
    cloneAssignments: true,
  }
): Promise<{
  success: boolean;
  message: string;
  stats: {
    categoriesCloned: number;
    visualCategoriesCloned: number;
    ruleCategoriesCloned: number;
    assignmentsCloned: number;
    rulesTreeCloned: boolean;
  };
}> {
  try {
    const stats = {
      categoriesCloned: 0,
      visualCategoriesCloned: 0,
      ruleCategoriesCloned: 0,
      assignmentsCloned: 0,
      rulesTreeCloned: false,
    };

    const catMap = new Map<string, string>(); // oldCatId -> newCatId

    // 1. Clone Categories (preserves arbitrary hierarchy depth)
    const shouldCloneCats = options.cloneCategories ?? (options.cloneRuleCategories ?? options.cloneVisualCategories ?? true);
    if (shouldCloneCats) {
      const sourceCats = await getCategories(sourceTrackId);

      const remaining = [...sourceCats];
      let iterations = 0;
      while (remaining.length > 0 && iterations < 50) {
        iterations++;
        const toRemove: number[] = [];

        for (let i = 0; i < remaining.length; i++) {
          const cat = remaining[i];
          if (!cat.parentId) {
            // Root category
            const newCat = await createCategory(
              targetTrackId,
              cat.name,
              cat.color || "#3b82f6",
              cat.sortOrder ?? 0,
              cat.code,
              null
            );
            catMap.set(cat.id, newCat.id);
            toRemove.push(i);
            stats.categoriesCloned++;
          } else if (catMap.has(cat.parentId)) {
            // Child category whose parent is already created
            const newParentId = catMap.get(cat.parentId)!;
            const newCat = await createCategory(
              targetTrackId,
              cat.name,
              cat.color || "#3b82f6",
              cat.sortOrder ?? 0,
              cat.code,
              newParentId
            );
            catMap.set(cat.id, newCat.id);
            toRemove.push(i);
            stats.categoriesCloned++;
          }
        }

        for (let j = toRemove.length - 1; j >= 0; j--) {
          remaining.splice(toRemove[j], 1);
        }
      }

      // Any remaining orphaned categories
      for (const cat of remaining) {
        const newCat = await createCategory(
          targetTrackId,
          cat.name,
          cat.color || "#3b82f6",
          cat.sortOrder ?? 0,
          cat.code,
          null
        );
        catMap.set(cat.id, newCat.id);
        stats.categoriesCloned++;
      }

      stats.visualCategoriesCloned = stats.categoriesCloned;
      stats.ruleCategoriesCloned = stats.categoriesCloned;
    }

    // 2. Clone Rules Tree AST with Deep ID Re-mapping
    if (options.cloneRulesTree) {
      const sourceTrack = await getTrackById(sourceTrackId);
      if (sourceTrack?.rulesTree) {
        const remapNode = (node: any): any => {
          if (!node || typeof node !== "object") return node;

          if (Array.isArray(node)) {
            return node.map(remapNode);
          }

          const cloned = { ...node };

          // Replace Category ID if present (including virtual __REMAINING__:<parentId>)
          const remapCatId = (id: string): string => {
            if (id.startsWith("__REMAINING__:")) {
              const oldPid = id.slice("__REMAINING__:".length);
              if (catMap.has(oldPid)) {
                return `__REMAINING__:${catMap.get(oldPid)}`;
              }
              return id;
            }
            if (catMap.has(id)) {
              return catMap.get(id)!;
            }
            return id;
          };

          if (cloned.categoryId) {
            cloned.categoryId = remapCatId(cloned.categoryId);
          }
          if (cloned.ruleCategoryId) {
            cloned.ruleCategoryId = remapCatId(cloned.ruleCategoryId);
            cloned.categoryId = cloned.ruleCategoryId;
          }
          if (cloned.visualCategoryId) {
            cloned.visualCategoryId = remapCatId(cloned.visualCategoryId);
          }

          // Recursive children / sub-rules
          if (Array.isArray(cloned.children)) {
            cloned.children = cloned.children.map(remapNode);
          }
          if (Array.isArray(cloned.rules)) {
            cloned.rules = cloned.rules.map(remapNode);
          }
          if (Array.isArray(cloned.items)) {
            cloned.items = cloned.items.map(remapNode);
          }

          return cloned;
        };

        const remappedTree = remapNode(sourceTrack.rulesTree);
        await updateTrackRules(targetTrackId, remappedTree);
        stats.rulesTreeCloned = true;
      }
    }

    // 3. Clone Course Assignments
    if (options.cloneAssignments) {
      const sourceAssignments = await getTrackAssignments(sourceTrackId);
      const assignmentsToClone = sourceAssignments.map((a) => {
        const catId = a.categoryId || a.ruleCategoryId || a.visualCategoryId;
        return {
          courseId: a.courseId,
          categoryId: catId ? catMap.get(catId) || null : null,
        };
      });
      await bulkAssignTrackCourses(targetTrackId, assignmentsToClone);
      stats.assignmentsCloned = assignmentsToClone.length;
    }

    invalidateCache("categories");
    invalidateCache("track_assignments");
    invalidateCache("tracks");
    invalidateCache("courses");

    return {
      success: true,
      message: `ساختار با موفقیت کپی و با شناسه‌های جدید همگام شد.`,
      stats,
    };
  } catch (error: any) {
    console.error("cloneTrackStructure error:", error);
    return {
      success: false,
      message: error?.message || "خطا در کپی ساختار گرایش",
      stats: {
        categoriesCloned: 0,
        visualCategoriesCloned: 0,
        ruleCategoriesCloned: 0,
        assignmentsCloned: 0,
        rulesTreeCloned: false,
      },
    };
  }
}


