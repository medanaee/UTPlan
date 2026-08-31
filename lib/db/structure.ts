import type {
  Faculty,
  Major,
  Track,
  VisualCategory,
  RuleCategory,
  TrackCourseAssignment,
  RuleGroupNode,
} from "../types";
import { getD1 } from "./client";

// ----------------------------------------------------
// 1. FACULTIES CRUD
// ----------------------------------------------------
export async function getFaculties(): Promise<Faculty[]> {
  const d1 = getD1();
  if (!d1) return [];

  try {
    const { results } = await d1
      .prepare("SELECT * FROM faculties WHERE deleted_at IS NULL ORDER BY name ASC")
      .all();
    return (results || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      createdAt: r.created_at,
      deletedAt: r.deleted_at || null,
    }));
  } catch (err) {
    console.error("D1 getFaculties error:", err);
    return [];
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
    return (results || []).map((r: any) => ({
      id: r.id,
      facultyId: r.faculty_id,
      name: r.name,
      code: r.code,
      createdAt: r.created_at,
      deletedAt: r.deleted_at || null,
    }));
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
    return (results || []).map((r: any) => {
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
    return true;
  } catch (err) {
    console.error("D1 deleteTrack error:", err);
    return false;
  }
}

// ----------------------------------------------------
// 4. VISUAL CATEGORIES (Flat color categories per track)
// ----------------------------------------------------
export async function getVisualCategories(trackId: string): Promise<VisualCategory[]> {
  const d1 = getD1();
  if (!d1) return [];

  try {
    const { results } = await d1
      .prepare("SELECT * FROM visual_categories WHERE track_id = ? ORDER BY sort_order ASC")
      .bind(trackId)
      .all();
    return (results || []).map((r: any) => ({
      id: r.id,
      trackId: r.track_id,
      code: r.code || undefined,
      name: r.name,
      color: r.color,
      sortOrder: Number(r.sort_order) || 0,
      createdAt: r.created_at,
    }));
  } catch (err) {
    console.error("D1 getVisualCategories error:", err);
    return [];
  }
}

export async function createVisualCategory(
  trackIdOrData: string | { trackId: string; name: string; color?: string; sortOrder?: number; code?: string },
  nameArg?: string,
  colorArg?: string,
  sortOrderArg = 0,
  codeArg?: string
): Promise<VisualCategory> {
  let trackId: string;
  let name: string;
  let color: string;
  let sortOrder: number;
  let code: string | undefined;

  if (typeof trackIdOrData === "object" && trackIdOrData !== null) {
    trackId = trackIdOrData.trackId;
    name = trackIdOrData.name;
    color = trackIdOrData.color || "#3b82f6";
    sortOrder = trackIdOrData.sortOrder ?? 0;
    code = trackIdOrData.code?.trim() || undefined;
  } else {
    trackId = trackIdOrData;
    name = nameArg!;
    color = colorArg || "#3b82f6";
    sortOrder = sortOrderArg;
    code = codeArg?.trim() || undefined;
  }

  const id = `vcat_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const cleanCode = code?.trim()
    ? code.trim().toUpperCase()
    : `VCAT-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

  const d1 = getD1();
  if (!d1) throw new Error("پایگاه‌داده در دسترس نیست.");

  try {
    await d1
      .prepare(
        "INSERT INTO visual_categories (id, track_id, code, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(id, trackId, cleanCode, name.trim(), color, sortOrder, now)
      .run();
  } catch (err) {
    console.error("D1 createVisualCategory error:", err);
    throw err;
  }

  return {
    id,
    trackId,
    code: cleanCode,
    name: name.trim(),
    color,
    sortOrder,
    createdAt: now,
  };
}

export async function updateVisualCategory(
  id: string,
  data: { name?: string; color?: string; sortOrder?: number; code?: string | null }
): Promise<VisualCategory | null> {
  const d1 = getD1();
  if (!d1) return null;

  try {
    const existing = await d1.prepare("SELECT * FROM visual_categories WHERE id = ?").bind(id).first();
    if (!existing) return null;

    const name = data.name !== undefined ? data.name.trim() : (existing as any).name;
    const color = data.color !== undefined ? data.color : (existing as any).color;
    const sortOrder = data.sortOrder !== undefined ? data.sortOrder : (existing as any).sort_order;
    const code =
      data.code !== undefined
        ? (data.code?.trim() ? data.code.trim().toUpperCase() : (existing as any).code || `VCAT-${crypto.randomUUID().slice(0, 6).toUpperCase()}`)
        : ((existing as any).code || `VCAT-${crypto.randomUUID().slice(0, 6).toUpperCase()}`);

    await d1
      .prepare("UPDATE visual_categories SET code = ?, name = ?, color = ?, sort_order = ? WHERE id = ?")
      .bind(code, name, color, sortOrder, id)
      .run();

    return {
      id,
      trackId: (existing as any).track_id,
      code,
      name,
      color,
      sortOrder,
      createdAt: (existing as any).created_at,
    };
  } catch (err) {
    console.error("D1 updateVisualCategory error:", err);
    return null;
  }
}

export async function updateRuleCategory(
  id: string,
  data: { name?: string; parentId?: string | null; sortOrder?: number; code?: string | null }
): Promise<RuleCategory | null> {
  const d1 = getD1();
  if (!d1) return null;

  try {
    const existing = await d1.prepare("SELECT * FROM rule_categories WHERE id = ?").bind(id).first();
    if (!existing) return null;

    const name = data.name !== undefined ? data.name.trim() : (existing as any).name;
    const parentId = data.parentId !== undefined ? (data.parentId || null) : (existing as any).parent_id;
    const sortOrder = data.sortOrder !== undefined ? data.sortOrder : (existing as any).sort_order;
    const code =
      data.code !== undefined
        ? (data.code?.trim() ? data.code.trim().toUpperCase() : (existing as any).code || `RCAT-${crypto.randomUUID().slice(0, 6).toUpperCase()}`)
        : ((existing as any).code || `RCAT-${crypto.randomUUID().slice(0, 6).toUpperCase()}`);

    await d1
      .prepare("UPDATE rule_categories SET code = ?, name = ?, parent_id = ?, sort_order = ? WHERE id = ?")
      .bind(code, name, parentId, sortOrder, id)
      .run();

    return {
      id,
      trackId: (existing as any).track_id,
      code,
      parentId,
      name,
      createdAt: (existing as any).created_at,
    };
  } catch (err) {
    console.error("D1 updateRuleCategory error:", err);
    return null;
  }
}

export async function deleteVisualCategory(id: string): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;

  try {
    await d1.prepare("DELETE FROM visual_categories WHERE id = ?").bind(id).run();
    return true;
  } catch (err) {
    console.error("D1 deleteVisualCategory error:", err);
    return false;
  }
}

// ----------------------------------------------------
// 5. RULE CATEGORIES (Requirements category tree per track)
// ----------------------------------------------------
export async function getRuleCategories(trackId: string): Promise<RuleCategory[]> {
  const d1 = getD1();
  if (!d1) return [];

  try {
    const { results } = await d1
      .prepare("SELECT * FROM rule_categories WHERE track_id = ? ORDER BY sort_order ASC, created_at ASC")
      .bind(trackId)
      .all();
    return (results || []).map((r: any) => ({
      id: r.id,
      trackId: r.track_id,
      code: r.code || undefined,
      parentId: r.parent_id || null,
      name: r.name,
      createdAt: r.created_at,
    }));
  } catch (err) {
    console.error("D1 getRuleCategories error:", err);
    return [];
  }
}

export async function createRuleCategory(
  trackIdOrData: string | { trackId: string; name: string; parentId?: string | null; sortOrder?: number; code?: string },
  nameArg?: string,
  parentIdArg?: string | null,
  sortOrderArg = 0,
  codeArg?: string
): Promise<RuleCategory> {
  let trackId: string;
  let name: string;
  let parentId: string | null;
  let sortOrder: number;
  let code: string | undefined;

  if (typeof trackIdOrData === "object" && trackIdOrData !== null) {
    trackId = trackIdOrData.trackId;
    name = trackIdOrData.name;
    parentId = trackIdOrData.parentId || null;
    sortOrder = trackIdOrData.sortOrder ?? 0;
    code = trackIdOrData.code?.trim() || undefined;
  } else {
    trackId = trackIdOrData;
    name = nameArg!;
    parentId = parentIdArg || null;
    sortOrder = sortOrderArg;
    code = codeArg?.trim() || undefined;
  }

  const id = `rcat_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const cleanCode = code?.trim()
    ? code.trim().toUpperCase()
    : `RCAT-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

  const d1 = getD1();
  if (!d1) throw new Error("پایگاه‌داده در دسترس نیست.");

  try {
    await d1
      .prepare(
        "INSERT INTO rule_categories (id, track_id, parent_id, code, name, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(id, trackId, parentId, cleanCode, name.trim(), sortOrder, now)
      .run();
  } catch (err) {
    console.error("D1 createRuleCategory error:", err);
    throw err;
  }

  return {
    id,
    trackId,
    code: cleanCode,
    parentId,
    name: name.trim(),
    createdAt: now,
  };
}

export async function deleteRuleCategory(id: string): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;

  try {
    await d1.prepare("DELETE FROM rule_categories WHERE id = ?").bind(id).run();
    return true;
  } catch (err) {
    console.error("D1 deleteRuleCategory error:", err);
    return false;
  }
}

// ----------------------------------------------------
// 6. TRACK COURSE ASSIGNMENTS
// ----------------------------------------------------
export async function getTrackAssignments(trackId: string): Promise<TrackCourseAssignment[]> {
  const d1 = getD1();
  if (!d1) return [];

  try {
    const query = `
      SELECT a.id, a.track_id, a.course_id, a.visual_category_id, a.rule_category_id,
             c.name AS course_name, c.code AS course_code, c.units AS course_units
      FROM track_course_assignments a
      LEFT JOIN courses c ON a.course_id = c.id
      WHERE a.track_id = ?
    `;
    const { results } = await d1.prepare(query).bind(trackId).all();
    return (results || []).map((r: any) => ({
      id: r.id,
      trackId: r.track_id,
      courseId: r.course_id,
      visualCategoryId: r.visual_category_id || null,
      ruleCategoryId: r.rule_category_id || null,
      courseName: r.course_name || "نامشخص",
      courseCode: r.course_code || "---",
      units: Number(r.course_units) || 3,
    }));
  } catch (err) {
    console.error("D1 getTrackAssignments error:", err);
    return [];
  }
}

export async function assignCourseToCategories(
  trackId: string,
  courseId: string,
  visualCategoryId?: string | null,
  ruleCategoryId?: string | null
): Promise<TrackCourseAssignment> {
  const id = `assign_${trackId}_${courseId}`;
  const d1 = getD1();
  if (d1) {
    try {
      const upsertSql = `
        INSERT INTO track_course_assignments (id, track_id, course_id, visual_category_id, rule_category_id)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(track_id, course_id) DO UPDATE SET
          visual_category_id = excluded.visual_category_id,
          rule_category_id = excluded.rule_category_id
      `;
      await d1
        .prepare(upsertSql)
        .bind(id, trackId, courseId, visualCategoryId || null, ruleCategoryId || null)
        .run();
    } catch (err) {
      console.error("D1 assignCourseToCategories error:", err);
    }
  }

  return {
    id,
    trackId,
    courseId,
    visualCategoryId: visualCategoryId || null,
    ruleCategoryId: ruleCategoryId || null,
  };
}

export async function bulkAssignTrackCourses(
  trackId: string,
  assignments: { courseId: string; visualCategoryId?: string | null; ruleCategoryId?: string | null }[]
): Promise<boolean> {
  for (const item of assignments) {
    await assignCourseToCategories(trackId, item.courseId, item.visualCategoryId, item.ruleCategoryId);
  }
  return true;
}

// ----------------------------------------------------
// 7. TRACK STRUCTURE CLONING
// ----------------------------------------------------
export async function cloneTrackStructure(
  sourceTrackId: string,
  targetTrackId: string,
  options: {
    cloneVisualCategories?: boolean;
    cloneRuleCategories?: boolean;
    cloneRulesTree?: boolean;
    cloneAssignments?: boolean;
  } = {
    cloneVisualCategories: true,
    cloneRuleCategories: true,
    cloneRulesTree: true,
    cloneAssignments: true,
  }
): Promise<{
  success: boolean;
  message: string;
  stats: {
    visualCategoriesCloned: number;
    ruleCategoriesCloned: number;
    assignmentsCloned: number;
    rulesTreeCloned: boolean;
  };
}> {
  try {
    const stats = {
      visualCategoriesCloned: 0,
      ruleCategoriesCloned: 0,
      assignmentsCloned: 0,
      rulesTreeCloned: false,
    };

    const visualCatMap = new Map<string, string>(); // oldVcatId -> newVcatId
    const ruleCatMap = new Map<string, string>(); // oldRcatId -> newRcatId

    // 1. Clone Visual Categories
    if (options.cloneVisualCategories) {
      const sourceVCats = await getVisualCategories(sourceTrackId);
      for (const vcat of sourceVCats) {
        const newVCat = await createVisualCategory(
          targetTrackId,
          vcat.name,
          vcat.color,
          vcat.sortOrder,
          vcat.code
        );
        visualCatMap.set(vcat.id, newVCat.id);
        stats.visualCategoriesCloned++;
      }
    }

    // 2. Clone Rule Categories (preserves hierarchy)
    if (options.cloneRuleCategories) {
      const sourceRCats = await getRuleCategories(sourceTrackId);
      
      const remaining = [...sourceRCats];
      let iterations = 0;
      while (remaining.length > 0 && iterations < 20) {
        iterations++;
        const toRemove: number[] = [];

        for (let i = 0; i < remaining.length; i++) {
          const rcat = remaining[i];
          if (!rcat.parentId) {
            // Root category
            const newRCat = await createRuleCategory(
              targetTrackId,
              rcat.name,
              null,
              0,
              rcat.code
            );
            ruleCatMap.set(rcat.id, newRCat.id);
            toRemove.push(i);
            stats.ruleCategoriesCloned++;
          } else if (ruleCatMap.has(rcat.parentId)) {
            // Child category whose parent is already created
            const newParentId = ruleCatMap.get(rcat.parentId)!;
            const newRCat = await createRuleCategory(
              targetTrackId,
              rcat.name,
              newParentId,
              0,
              rcat.code
            );
            ruleCatMap.set(rcat.id, newRCat.id);
            toRemove.push(i);
            stats.ruleCategoriesCloned++;
          }
        }

        for (let j = toRemove.length - 1; j >= 0; j--) {
          remaining.splice(toRemove[j], 1);
        }
      }

      // Any remaining orphaned categories
      for (const rcat of remaining) {
        const newRCat = await createRuleCategory(
          targetTrackId,
          rcat.name,
          null,
          0,
          rcat.code
        );
        ruleCatMap.set(rcat.id, newRCat.id);
        stats.ruleCategoriesCloned++;
      }
    }

    // 3. Clone Rules Tree AST with Deep ID Re-mapping
    if (options.cloneRulesTree) {
      const sourceTrack = await getTrackById(sourceTrackId);
      if (sourceTrack?.rulesTree) {
        const remapNode = (node: any): any => {
          if (!node || typeof node !== "object") return node;

          if (Array.isArray(node)) {
            return node.map(remapNode);
          }

          const cloned = { ...node };

          // Replace Rule Category ID if present
          if (cloned.categoryId && ruleCatMap.has(cloned.categoryId)) {
            cloned.categoryId = ruleCatMap.get(cloned.categoryId);
          }
          if (cloned.ruleCategoryId && ruleCatMap.has(cloned.ruleCategoryId)) {
            cloned.ruleCategoryId = ruleCatMap.get(cloned.ruleCategoryId);
          }

          // Replace Visual Category ID if present
          if (cloned.visualCategoryId && visualCatMap.has(cloned.visualCategoryId)) {
            cloned.visualCategoryId = visualCatMap.get(cloned.visualCategoryId);
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

    // 4. Clone Course Assignments
    if (options.cloneAssignments) {
      const sourceAssignments = await getTrackAssignments(sourceTrackId);
      for (const a of sourceAssignments) {
        const newVisualId = a.visualCategoryId ? visualCatMap.get(a.visualCategoryId) || null : null;
        const newRuleId = a.ruleCategoryId ? ruleCatMap.get(a.ruleCategoryId) || null : null;

        await assignCourseToCategories(targetTrackId, a.courseId, newVisualId, newRuleId);
        stats.assignmentsCloned++;
      }
    }

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
        visualCategoriesCloned: 0,
        ruleCategoriesCloned: 0,
        assignmentsCloned: 0,
        rulesTreeCloned: false,
      },
    };
  }
}

export async function reorderVisualCategories(items: { id: string; sortOrder: number }[]): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;

  try {
    const stmts = items.map((item) =>
      d1.prepare("UPDATE visual_categories SET sort_order = ? WHERE id = ?").bind(item.sortOrder, item.id)
    );
    await d1.batch(stmts);
    return true;
  } catch (err) {
    console.error("D1 reorderVisualCategories error:", err);
    return false;
  }
}

export async function reorderRuleCategories(
  items: { id: string; sortOrder: number; parentId?: string | null }[]
): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;

  try {
    const stmts = items.map((item) => {
      if (item.parentId !== undefined) {
        return d1
          .prepare("UPDATE rule_categories SET sort_order = ?, parent_id = ? WHERE id = ?")
          .bind(item.sortOrder, item.parentId || null, item.id);
      }
      return d1.prepare("UPDATE rule_categories SET sort_order = ? WHERE id = ?").bind(item.sortOrder, item.id);
    });
    await d1.batch(stmts);
    return true;
  } catch (err) {
    console.error("D1 reorderRuleCategories error:", err);
    return false;
  }
}

export async function assignCategoryCourses(
  trackId: string,
  type: "visual" | "rule",
  categoryId: string,
  courseIds: string[]
): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;

  try {
    if (type === "visual") {
      // Clear previous assignments for this visual category
      await d1
        .prepare(
          "UPDATE track_course_assignments SET visual_category_id = NULL WHERE track_id = ? AND visual_category_id = ?"
        )
        .bind(trackId, categoryId)
        .run();

      // Assign selected courses
      for (const courseId of courseIds) {
        const id = `assign_${trackId}_${courseId}`;
        await d1
          .prepare(
            `INSERT INTO track_course_assignments (id, track_id, course_id, visual_category_id)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(track_id, course_id) DO UPDATE SET visual_category_id = excluded.visual_category_id`
          )
          .bind(id, trackId, courseId, categoryId)
          .run();
      }
    } else {
      // Clear previous assignments for this rule category
      await d1
        .prepare(
          "UPDATE track_course_assignments SET rule_category_id = NULL WHERE track_id = ? AND rule_category_id = ?"
        )
        .bind(trackId, categoryId)
        .run();

      // Assign selected courses
      for (const courseId of courseIds) {
        const id = `assign_${trackId}_${courseId}`;
        await d1
          .prepare(
            `INSERT INTO track_course_assignments (id, track_id, course_id, rule_category_id)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(track_id, course_id) DO UPDATE SET rule_category_id = excluded.rule_category_id`
          )
          .bind(id, trackId, courseId, categoryId)
          .run();
      }
    }
    return true;
  } catch (err) {
    console.error("D1 assignCategoryCourses error:", err);
    return false;
  }
}

