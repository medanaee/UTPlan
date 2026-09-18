import { NextRequest, NextResponse } from "next/server";
import { getD1, getFaculties, getCourses, getProfessors, getOfferings, getEvents, getCharts, getAllPrerequisites } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TABLE_ORDER = [
  "faculties",
  "faculty_links",
  "majors",
  "tracks",
  "categories",
  "courses",
  "prerequisites",
  "track_course_assignments",
  "professors",
  "course_offerings",
  "offering_professors",
  "offering_resources",
  "course_events",
  "course_event_slots",
  "users",
  "reviews",
  "review_reactions",
  "charts",
  "chart_terms",
  "chart_courses",
];

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const { searchParams } = new URL(request.url);
    const statsOnly = searchParams.get("stats") === "1";

    const d1 = getD1();
    const tablesData: Record<string, any[]> = {};
    const tableCounts: Record<string, number> = {};

    if (d1) {
      for (const table of TABLE_ORDER) {
        try {
          const { results } = await d1.prepare(`SELECT * FROM ${table}`).all();
          tablesData[table] = results || [];
          tableCounts[table] = (results || []).length;
        } catch (err) {
          console.warn(`Could not read table ${table}:`, err);
          tablesData[table] = [];
          tableCounts[table] = 0;
        }
      }
    } else {
      // Dev memory fallback
      tableCounts["faculties"] = (await getFaculties()).length;
      tableCounts["courses"] = (await getCourses()).length;
      tableCounts["professors"] = (await getProfessors()).length;
      tableCounts["course_offerings"] = (await getOfferings()).length;
      tableCounts["course_events"] = (await getEvents()).length;
      tableCounts["charts"] = (await getCharts()).length;
    }

    const totalRecords = Object.values(tableCounts).reduce((a, b) => a + b, 0);

    if (statsOnly) {
      return NextResponse.json({
        success: true,
        data: {
          tableCounts,
          totalRecords,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Default: Full Database JSON Snapshot
    const snapshot = {
      metadata: {
        system: "UT-ECE Academic Planning Platform",
        backupDate: new Date().toISOString(),
        version: "2.0",
        format: "json-snapshot",
        totalTables: TABLE_ORDER.length,
        totalRecords,
        tableCounts,
      },
      data: tablesData,
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(snapshot, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="ut_ece_backup_${dateStr}.json"`,
      },
    });
  } catch (error: any) {
    console.error("Backup GET error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در تهیه نسخه پشتیبان JSON: " + (error?.message || "نامشخص") },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const body: any = await request.json();
    let tablesData: Record<string, any[]> | null = null;

    if (body.data && typeof body.data === "object") {
      tablesData = body.data;
    } else if (body.tables && typeof body.tables === "object") {
      tablesData = body.tables;
    } else if (typeof body === "object") {
      tablesData = body;
    }

    if (!tablesData || typeof tablesData !== "object") {
      return NextResponse.json(
        { success: false, message: "ساختار فایل JSON پشتیبان نامعتبر است." },
        { status: 400 }
      );
    }

    const d1 = getD1();
    if (!d1) {
      return NextResponse.json(
        { success: false, message: "پایگاه داده D1 در دسترس نیست." },
        { status: 500 }
      );
    }

    // Backward compatibility for legacy category structure
    if (!tablesData["categories"] || tablesData["categories"].length === 0) {
      const legacyCats = [
        ...(Array.isArray(tablesData["visual_categories"]) ? tablesData["visual_categories"] : []),
        ...(Array.isArray(tablesData["rule_categories"]) ? tablesData["rule_categories"] : []),
      ];
      if (legacyCats.length > 0) {
        const catMap = new Map<string, any>();
        for (const lc of legacyCats) {
          if (lc && lc.id && !catMap.has(lc.id)) {
            catMap.set(lc.id, {
              id: lc.id,
              track_id: lc.track_id,
              parent_id: lc.parent_id || null,
              code: lc.code || null,
              name: lc.name,
              color: lc.color || "#3b82f6",
              sort_order: lc.sort_order || 0,
              created_at: lc.created_at || new Date().toISOString(),
            });
          }
        }
        tablesData["categories"] = Array.from(catMap.values());
      }
    }

    // Disable foreign keys for safe batch restore
    await d1.prepare("PRAGMA foreign_keys = OFF;").run();

    // 1. Wipe existing data in reverse table order
    const reverseTables = [...TABLE_ORDER].reverse();
    for (const table of reverseTables) {
      try {
        await d1.prepare(`DELETE FROM ${table}`).run();
      } catch (err) {
        console.warn(`Could not wipe table ${table}:`, err);
      }
    }

    // Also wipe legacy tables if they happen to exist
    for (const legacyTable of ["rule_categories", "visual_categories"]) {
      try {
        await d1.prepare(`DELETE FROM ${legacyTable}`).run();
      } catch {}
    }

    // 2. Insert all rows per table
    let totalInserted = 0;
    const errors: string[] = [];
    const restoredStats: Record<string, number> = {};

    for (const table of TABLE_ORDER) {
      let rows = Array.isArray(tablesData[table]) ? tablesData[table] : [];
      restoredStats[table] = 0;

      if (rows.length === 0) continue;

      // Ensure parent categories are inserted before subcategories
      if (table === "categories") {
        rows = [...rows].sort((a, b) => {
          if (!a?.parent_id && b?.parent_id) return -1;
          if (a?.parent_id && !b?.parent_id) return 1;
          return 0;
        });
      }

      const stmts: any[] = [];
      for (let row of rows) {
        if (!row || typeof row !== "object") continue;

        // Clone row to avoid mutating original
        row = { ...row };

        // Normalize courses (degree level support)
        if (table === "courses") {
          if ("degreeLevel" in row && !("degree_level" in row)) {
            row.degree_level = row.degreeLevel;
            delete row.degreeLevel;
          }
          if (!row.degree_level) {
            row.degree_level = "undergrad";
          } else if (row.degree_level === "undergraduate") {
            row.degree_level = "undergrad";
          }
        }

        // Normalize track_course_assignments (categories support)
        if (table === "track_course_assignments") {
          if (!row.category_id && (row.visual_category_id || row.rule_category_id)) {
            row.category_id = row.visual_category_id || row.rule_category_id;
          }
          delete row.visual_category_id;
          delete row.rule_category_id;
        }

        const keys = Object.keys(row);
        if (keys.length === 0) continue;

        const cols = keys.join(", ");
        const placeholders = keys.map(() => "?").join(", ");
        const values = keys.map((k) => {
          const val = row[k];
          if (val === null || val === undefined) return null;
          if (typeof val === "object") return JSON.stringify(val);
          return val;
        });

        stmts.push(
          d1.prepare(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`).bind(...values)
        );
      }

      // Execute in batch chunks of 100
      for (let i = 0; i < stmts.length; i += 100) {
        const batchChunk = stmts.slice(i, i + 100);
        try {
          await d1.batch(batchChunk);
          totalInserted += batchChunk.length;
          restoredStats[table] += batchChunk.length;
        } catch (batchErr: any) {
          errors.push(`خطا در درج دسته‌ای جدول ${table}: ${batchErr?.message || "نامشخص"}`);
        }
      }
    }

    // Re-enable foreign keys
    await d1.prepare("PRAGMA foreign_keys = ON;").run();

    return NextResponse.json({
      success: true,
      message: `بازیابی کامل از فایل JSON با موفقیت انجام شد: در مجموع ${totalInserted} رکورد در ${TABLE_ORDER.length} جدول بازنویسی و بازیابی گردید.`,
      stats: {
        totalInserted,
        restoredRecords: totalInserted,
        tableCounts: restoredStats,
        errors: errors.slice(0, 10),
      },
    });
  } catch (error: any) {
    console.error("Restore POST error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در فرآیند بازیابی JSON: " + (error?.message || "نامشخص") },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const d1 = getD1();
    if (!d1) {
      return NextResponse.json(
        { success: false, message: "پایگاه داده D1 در دسترس نیست." },
        { status: 500 }
      );
    }

    // Tables to purge (excluding users, faculties, majors, tracks)
    const TABLES_TO_PURGE = [
      "chart_courses",
      "chart_terms",
      "charts",
      "reviews",
      "course_event_slots",
      "course_events",
      "offering_resources",
      "offering_professors",
      "course_offerings",
      "professors",
      "track_course_assignments",
      "prerequisites",
      "courses",
      "categories",
      "faculty_links",
    ];

    // Disable foreign keys for safe batch purge
    await d1.prepare("PRAGMA foreign_keys = OFF;").run();

    let totalPurged = 0;
    const purgedCounts: Record<string, number> = {};

    for (const table of TABLES_TO_PURGE) {
      try {
        const countRes: any = await d1.prepare(`SELECT count(*) as cnt FROM ${table}`).first();
        const cnt = Number(countRes?.cnt || 0);
        await d1.prepare(`DELETE FROM ${table}`).run();
        purgedCounts[table] = cnt;
        totalPurged += cnt;
      } catch (err) {
        console.warn(`Could not purge table ${table}:`, err);
        purgedCounts[table] = 0;
      }
    }

    // Re-enable foreign keys
    await d1.prepare("PRAGMA foreign_keys = ON;").run();

    return NextResponse.json({
      success: true,
      message: `پاکسازی کامل با موفقیت انجام شد: ${totalPurged} رکورد از ۱۶ جدول دیتابیس حذف شدند. اطلاعات کاربران و ساختار دانشگاه بدون تغییر حفظ گردیدند.`,
      purgedCounts,
      totalPurged,
    });
  } catch (error: any) {
    console.error("Purge DELETE error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در فرآیند پاکسازی دیتابیس: " + (error?.message || "نامشخص") },
      { status: 500 }
    );
  }
}

