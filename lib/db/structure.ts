import type {
  Faculty,
  FacultyLink,
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
    try {
      await d1
        .prepare(
          `CREATE TABLE IF NOT EXISTS faculty_links (
            id TEXT PRIMARY KEY,
            target_faculty_id TEXT NOT NULL,
            source_faculty_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (target_faculty_id) REFERENCES faculties(id) ON DELETE CASCADE,
            FOREIGN KEY (source_faculty_id) REFERENCES faculties(id) ON DELETE CASCADE,
            UNIQUE(target_faculty_id, source_faculty_id)
          )`
        )
        .run();
    } catch {}

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

    return (results || []).map((r: any) => {
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
  } catch (err) {
    console.error("D1 getFaculties error:", err);
    return [];
  }
}

export async function getFacultyLinks(targetFacultyId?: string): Promise<FacultyLink[]> {
  const d1 = getD1();
  if (!d1) return [];

  try {
    try {
      await d1
        .prepare(
          `CREATE TABLE IF NOT EXISTS faculty_links (
            id TEXT PRIMARY KEY,
            target_faculty_id TEXT NOT NULL,
            source_faculty_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (target_faculty_id) REFERENCES faculties(id) ON DELETE CASCADE,
            FOREIGN KEY (source_faculty_id) REFERENCES faculties(id) ON DELETE CASCADE,
            UNIQUE(target_faculty_id, source_faculty_id)
          )`
        )
        .run();
    } catch {}

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
    try {
      await d1
        .prepare(
          `CREATE TABLE IF NOT EXISTS faculty_links (
            id TEXT PRIMARY KEY,
            target_faculty_id TEXT NOT NULL,
            source_faculty_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (target_faculty_id) REFERENCES faculties(id) ON DELETE CASCADE,
            FOREIGN KEY (source_faculty_id) REFERENCES faculties(id) ON DELETE CASCADE,
            UNIQUE(target_faculty_id, source_faculty_id)
          )`
        )
        .run();
    } catch {}

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
  } catch (err) {
    console.error("D1 setFacultyLinks error:", err);
    throw err;
  }
}

export async function getEffectiveFacultyIds(targetFacultyId: string): Promise<string[]> {
  const d1 = getD1();
  if (!d1 || !targetFacultyId) return targetFacultyId ? [targetFacultyId] : [];

  try {
    try {
      await d1
        .prepare(
          `CREATE TABLE IF NOT EXISTS faculty_links (
            id TEXT PRIMARY KEY,
            target_faculty_id TEXT NOT NULL,
            source_faculty_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (target_faculty_id) REFERENCES faculties(id) ON DELETE CASCADE,
            FOREIGN KEY (source_faculty_id) REFERENCES faculties(id) ON DELETE CASCADE,
            UNIQUE(target_faculty_id, source_faculty_id)
          )`
        )
        .run();
    } catch {}

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
    // Delete connected course assignments first to satisfy foreign key constraint
    await d1.prepare("DELETE FROM track_course_assignments WHERE visual_category_id = ?").bind(id).run();
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
    // Delete assignments for child categories and children first
    const { results: childRows } = await d1
      .prepare("SELECT id FROM rule_categories WHERE parent_id = ?")
      .bind(id)
      .all();
    for (const child of childRows || []) {
      await d1.prepare("DELETE FROM track_course_assignments WHERE rule_category_id = ?").bind((child as any).id).run();
    }
    await d1.prepare("DELETE FROM rule_categories WHERE parent_id = ?").bind(id).run();

    // Delete assignments for this rule category
    await d1.prepare("DELETE FROM track_course_assignments WHERE rule_category_id = ?").bind(id).run();
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
  const d1 = getD1();
  if (!d1) return false;
  if (!assignments || assignments.length === 0) return true;

  const upsertSql = `
    INSERT INTO track_course_assignments (id, track_id, course_id, visual_category_id, rule_category_id)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(track_id, course_id) DO UPDATE SET
      visual_category_id = excluded.visual_category_id,
      rule_category_id = excluded.rule_category_id
  `;

  const stmts: any[] = [];
  for (const item of assignments) {
    const id = `assign_${trackId}_${item.courseId}`;
    stmts.push(
      d1.prepare(upsertSql).bind(
        id,
        trackId,
        item.courseId,
        item.visualCategoryId || null,
        item.ruleCategoryId || null
      )
    );
  }

  for (let i = 0; i < stmts.length; i += 100) {
    await d1.batch(stmts.slice(i, i + 100));
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
      const assignmentsToClone = sourceAssignments.map((a) => ({
        courseId: a.courseId,
        visualCategoryId: a.visualCategoryId ? visualCatMap.get(a.visualCategoryId) || null : null,
        ruleCategoryId: a.ruleCategoryId ? ruleCatMap.get(a.ruleCategoryId) || null : null,
      }));
      await bulkAssignTrackCourses(targetTrackId, assignmentsToClone);
      stats.assignmentsCloned = assignmentsToClone.length;
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

export async function clearCategoryCourses(
  trackId: string,
  type: "visual" | "rule",
  categoryId: string
): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;

  try {
    if (type === "visual") {
      await d1
        .prepare("DELETE FROM track_course_assignments WHERE track_id = ? AND visual_category_id = ?")
        .bind(trackId, categoryId)
        .run();
    } else {
      await d1
        .prepare("DELETE FROM track_course_assignments WHERE track_id = ? AND rule_category_id = ?")
        .bind(trackId, categoryId)
        .run();
    }
    return true;
  } catch (err) {
    console.error("D1 clearCategoryCourses error:", err);
    return false;
  }
}

export async function syncVisualFromRuleCategories(trackId: string): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;

  try {
    // 1. Fetch all rule categories for this track
    const { results: ruleRows } = await d1
      .prepare("SELECT * FROM rule_categories WHERE track_id = ? ORDER BY sort_order ASC, created_at ASC")
      .bind(trackId)
      .all();
    const ruleCategories = ruleRows || [];

    // 2. Fetch all assignments for this track
    const { results: assignRows } = await d1
      .prepare("SELECT * FROM track_course_assignments WHERE track_id = ?")
      .bind(trackId)
      .all();
    const assignments = assignRows || [];

    // 3. Clear all existing visual categories for this track and unassign their visual references
    await d1.prepare("DELETE FROM visual_categories WHERE track_id = ?").bind(trackId).run();
    await d1
      .prepare("UPDATE track_course_assignments SET visual_category_id = NULL WHERE track_id = ?")
      .bind(trackId)
      .run();

    if (ruleCategories.length === 0) {
      return true;
    }

    // 4. Identify top-level (level 1) rule categories
    const topLevelRules = ruleCategories.filter(
      (r: any) => !r.parent_id || !ruleCategories.some((p: any) => p.id === r.parent_id)
    );

    const PRESET_COLORS = [
      "#3b82f6", // blue
      "#10b981", // green
      "#f59e0b", // yellow/amber
      "#ef4444", // red
      "#8b5cf6", // purple
      "#ec4899", // pink
      "#f97316", // orange
      "#6b7280", // gray
      "#06b6d4", // cyan
      "#14b8a6", // teal
      "#84cc16", // lime
      "#a855f7", // violet
    ];

    // 5. For each top-level category, find all descendant rule category IDs and flatten their assigned courses
    for (let idx = 0; idx < topLevelRules.length; idx++) {
      const topRule: any = topLevelRules[idx];
      const descendantIds = new Set<string>();

      const collectDescendants = (parentId: string) => {
        descendantIds.add(parentId);
        const children = ruleCategories.filter((r: any) => r.parent_id === parentId);
        for (const child of children) {
          collectDescendants((child as any).id);
        }
      };
      collectDescendants(topRule.id);

      // Collect all course IDs under this entire rule category tree
      const courseIds = assignments
        .filter((a: any) => a.rule_category_id && descendantIds.has(a.rule_category_id))
        .map((a: any) => a.course_id);
      const uniqueCourseIds = Array.from(new Set(courseIds));

      // Create new visual category
      const vcatId = `vcat_${crypto.randomUUID().slice(0, 8)}`;
      const vcatCode = topRule.code || `VCAT-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const color = PRESET_COLORS[idx % PRESET_COLORS.length];
      const now = new Date().toISOString();

      await d1
        .prepare(
          "INSERT INTO visual_categories (id, track_id, code, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(vcatId, trackId, vcatCode, topRule.name, color, idx + 1, now)
        .run();

      // Assign collected courses to the new visual category
      for (const courseId of uniqueCourseIds) {
        const assignId = `assign_${trackId}_${courseId}`;
        await d1
          .prepare(
            `INSERT INTO track_course_assignments (id, track_id, course_id, visual_category_id)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(track_id, course_id) DO UPDATE SET visual_category_id = excluded.visual_category_id`
          )
          .bind(assignId, trackId, courseId, vcatId)
          .run();
      }
    }

    return true;
  } catch (err) {
    console.error("D1 syncVisualFromRuleCategories error:", err);
    return false;
  }
}

