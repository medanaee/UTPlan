import { NextRequest, NextResponse } from "next/server";
import { getD1, getFaculties, getCourses, getProfessors, getOfferings, getEvents, getCharts, getAllPrerequisites } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TABLE_ORDER = [
  "faculties",
  "majors",
  "tracks",
  "rule_categories",
  "visual_categories",
  "courses",
  "prerequisites",
  "professors",
  "course_offerings",
  "offering_professors",
  "course_events",
  "course_event_slots",
  "charts",
  "chart_courses",
  "track_course_assignments",
  "reviews",
  "users",
];

// Helper: Escape SQL values
function escapeSqlValue(val: any): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return isNaN(val) ? "NULL" : String(val);
  if (typeof val === "boolean") return val ? "1" : "0";
  if (typeof val === "object") {
    const jsonStr = JSON.stringify(val);
    return `'${jsonStr.replace(/'/g, "''")}'`;
  }
  const str = String(val);
  return `'${str.replace(/'/g, "''")}'`;
}

// Helper: Generate SQL for a single table
function generateTableSql(tableName: string, rows: any[]): string {
  if (!rows || rows.length === 0) return `-- Table ${tableName} (0 rows)\n`;

  const lines: string[] = [];
  lines.push(`-- Table: ${tableName} (${rows.length} rows)`);

  for (const row of rows) {
    const keys = Object.keys(row);
    const cols = keys.join(", ");
    const vals = keys.map((k) => escapeSqlValue(row[k])).join(", ");
    lines.push(`INSERT INTO ${tableName} (${cols}) VALUES (${vals});`);
  }

  lines.push("");
  return lines.join("\n");
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "sql"; // 'sql' | 'json'
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

    if (statsOnly) {
      const totalRecords = Object.values(tableCounts).reduce((a, b) => a + b, 0);
      return NextResponse.json({
        success: true,
        data: {
          tableCounts,
          totalRecords,
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (format === "json") {
      const snapshot = {
        metadata: {
          system: "UT-ECE Academic Planning Platform",
          backupDate: new Date().toISOString(),
          version: "1.0",
          totalTables: TABLE_ORDER.length,
          tableCounts,
        },
        data: tablesData,
      };

      return new NextResponse(JSON.stringify(snapshot, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="ut_ece_snapshot_${new Date().toISOString().slice(0, 10)}.json"`,
        },
      });
    }

    // Default: SQL Dump
    const sqlChunks: string[] = [];
    const now = new Date().toISOString();

    sqlChunks.push(`-- ==========================================================`);
    sqlChunks.push(`-- UT-ECE Full Database SQL Backup Dump`);
    sqlChunks.push(`-- Generated at: ${now}`);
    sqlChunks.push(`-- Total Tables: ${TABLE_ORDER.length}`);
    sqlChunks.push(`-- ==========================================================\n`);
    sqlChunks.push(`PRAGMA foreign_keys = OFF;\n`);

    // Clean up reverse order
    sqlChunks.push(`-- ----------------------------------------------------------`);
    sqlChunks.push(`-- STEP 1: CLEANUP / WIPE EXISTING DATA`);
    sqlChunks.push(`-- ----------------------------------------------------------`);
    const reverseTables = [...TABLE_ORDER].reverse();
    for (const table of reverseTables) {
      sqlChunks.push(`DELETE FROM ${table};`);
    }
    sqlChunks.push("\n");

    // Insert new data
    sqlChunks.push(`-- ----------------------------------------------------------`);
    sqlChunks.push(`-- STEP 2: RESTORE TABLE DATA`);
    sqlChunks.push(`-- ----------------------------------------------------------`);
    for (const table of TABLE_ORDER) {
      sqlChunks.push(generateTableSql(table, tablesData[table] || []));
    }

    sqlChunks.push(`PRAGMA foreign_keys = ON;\n`);
    sqlChunks.push(`-- ==========================================================`);
    sqlChunks.push(`-- END OF BACKUP`);
    sqlChunks.push(`-- ==========================================================`);

    const sqlContent = sqlChunks.join("\n");

    return new NextResponse(sqlContent, {
      headers: {
        "Content-Type": "application/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="ut_ece_backup_${new Date().toISOString().slice(0, 10)}.sql"`,
      },
    });
  } catch (error: any) {
    console.error("Backup GET error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در تولید فایل پشتیبان: " + (error?.message || "نامشخص") },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const contentType = request.headers.get("content-type") || "";
    let sqlContent = "";
    let jsonData: any = null;

    if (contentType.includes("application/json")) {
      const body = await request.json();
      if (body.sql && typeof body.sql === "string") {
        sqlContent = body.sql;
      } else if (body.data && typeof body.data === "object") {
        jsonData = body.data;
      } else if (body.tables && typeof body.tables === "object") {
        jsonData = body.tables;
      }
    } else {
      sqlContent = await request.text();
    }

    const d1 = getD1();
    if (!d1) {
      return NextResponse.json(
        { success: false, message: "دیتابیس D1 در دسترس نیست." },
        { status: 500 }
      );
    }

    // Process JSON snapshot if provided
    if (jsonData) {
      const sqlParts: string[] = ["PRAGMA foreign_keys = OFF;"];
      const reverseTables = [...TABLE_ORDER].reverse();
      for (const table of reverseTables) {
        sqlParts.push(`DELETE FROM ${table};`);
      }
      for (const table of TABLE_ORDER) {
        if (Array.isArray(jsonData[table])) {
          sqlParts.push(generateTableSql(table, jsonData[table]));
        }
      }
      sqlParts.push("PRAGMA foreign_keys = ON;");
      sqlContent = sqlParts.join("\n");
    }

    if (!sqlContent.trim()) {
      return NextResponse.json(
        { success: false, message: "محتوای فایل پشتیبان خالی یا نامعتبر است." },
        { status: 400 }
      );
    }

    // Split SQL statements safely
    const cleanedSql = sqlContent
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("--") || trimmed.startsWith("//")) return "";
        return line;
      })
      .join("\n");

    const statements: string[] = [];
    let current = "";
    let inString = false;
    let stringChar = "";

    for (let i = 0; i < cleanedSql.length; i++) {
      const char = cleanedSql[i];
      const prev = i > 0 ? cleanedSql[i - 1] : "";

      if ((char === "'" || char === '"') && prev !== "\\") {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (stringChar === char) {
          if (char === "'" && i + 1 < cleanedSql.length && cleanedSql[i + 1] === "'") {
            current += "''";
            i++;
            continue;
          }
          inString = false;
        }
      }

      if (char === ";" && !inString) {
        const stmt = current.trim();
        if (stmt) statements.push(stmt);
        current = "";
      } else {
        current += char;
      }
    }
    if (current.trim()) {
      statements.push(current.trim());
    }

    if (statements.length === 0) {
      return NextResponse.json(
        { success: false, message: "هیچ دستور معتبر SQL در فایل یافت نشد." },
        { status: 400 }
      );
    }

    let executedCount = 0;
    const errors: string[] = [];

    // Ensure foreign keys are disabled first
    await d1.prepare("PRAGMA foreign_keys = OFF;").run();

    const batchSize = 40;
    for (let i = 0; i < statements.length; i += batchSize) {
      const chunk = statements.slice(i, i + batchSize);
      const batchPrepares = chunk.map((s) => d1.prepare(s));
      try {
        await d1.batch(batchPrepares);
        executedCount += chunk.length;
      } catch (batchErr: any) {
        console.error("Batch restore error, attempting fallback single execution:", batchErr);
        for (const s of chunk) {
          try {
            await d1.prepare(s).run();
            executedCount++;
          } catch (singleErr: any) {
            errors.push(`خطا در اجرای دستور: ${singleErr?.message || "نامشخص"} | دستور: ${s.slice(0, 80)}...`);
          }
        }
      }
    }

    // Re-enable foreign keys
    await d1.prepare("PRAGMA foreign_keys = ON;").run();

    // Query restored stats
    const restoredStats: Record<string, number> = {};
    for (const table of TABLE_ORDER) {
      try {
        const { results } = await d1.prepare(`SELECT count(*) as count FROM ${table}`).all();
        restoredStats[table] = Number((results?.[0] as any)?.count) || 0;
      } catch {
        restoredStats[table] = 0;
      }
    }

    const totalRestored = Object.values(restoredStats).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      success: true,
      message: `بازیابی پایگاه داده با موفقیت انجام شد: ${executedCount} دستور اجرا شد و در مجموع ${totalRestored} رکورد بازیابی گردید.`,
      stats: {
        totalStatements: statements.length,
        executedStatements: executedCount,
        restoredRecords: totalRestored,
        tableCounts: restoredStats,
        errors: errors.slice(0, 10),
      },
    });
  } catch (error: any) {
    console.error("Restore POST error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در فرآیند بازیابی پایگاه داده: " + (error?.message || "نامشخص") },
      { status: 500 }
    );
  }
}
