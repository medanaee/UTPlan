import fs from "node:fs";
import path from "node:path";

function normalizeValue(v: any): any {
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === undefined) return null;
  return v;
}

export function findSqlitePath(): string {
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }

  const candidatePaths = [
    "/app/data/app.sqlite",
    "/workspace/data/app.sqlite",
    path.join(process.cwd(), "data", "app.sqlite"),
    path.join(process.cwd(), "..", "data", "app.sqlite"),
    path.join(process.cwd(), "app.sqlite"),
    path.join(process.cwd(), "..", "app.sqlite"),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return path.resolve(p);
    }
  }

  // Default to relative data directory
  return path.resolve(process.cwd(), "data", "app.sqlite");
}

let cachedAdapter: any = null;

export function getSqliteD1Adapter(customPath?: string): any {
  if (cachedAdapter && !customPath) {
    return cachedAdapter;
  }

  const targetPath = customPath || findSqlitePath();
  const adapter = createSqliteD1Adapter(targetPath);
  if (!customPath) {
    cachedAdapter = adapter;
  }
  return adapter;
}

export function createSqliteD1Adapter(dbPath: string): any {
  // Dynamically require node:sqlite (native in Node.js 22+)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require("node:sqlite");

  const resolvedPath = path.resolve(dbPath);
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(resolvedPath);

  // Enable WAL mode and foreign keys for high concurrent performance
  try {
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
  } catch (e) {
    console.warn("[SQLite WAL Warning]", e);
  }

  class SqlitePreparedStatement {
    private sql: string;
    private bindings: any[];

    constructor(sql: string, bindings: any[] = []) {
      this.sql = sql;
      this.bindings = bindings;
    }

    bind(...values: any[]) {
      return new SqlitePreparedStatement(this.sql, values.map(normalizeValue));
    }

    async all<T = unknown>(): Promise<{ results: T[]; success: boolean; meta: any }> {
      try {
        const stmt = db.prepare(this.sql);
        const rows = (stmt.all(...this.bindings) || []) as T[];
        return {
          results: rows,
          success: true,
          meta: {},
        };
      } catch (err) {
        console.error("SQLite query error:", this.sql, this.bindings, err);
        throw err;
      }
    }

    async first<T = unknown>(colName?: string): Promise<T | null> {
      try {
        const stmt = db.prepare(this.sql);
        const row = stmt.get(...this.bindings) as any;
        if (!row) return null;
        if (colName) {
          return row[colName] !== undefined ? row[colName] : null;
        }
        return row as T;
      } catch (err) {
        console.error("SQLite first error:", this.sql, this.bindings, err);
        throw err;
      }
    }

    async run<T = unknown>(): Promise<{ success: boolean; meta: { changes: number; last_row_id: any } }> {
      try {
        const stmt = db.prepare(this.sql);
        const info = stmt.run(...this.bindings);
        return {
          success: true,
          meta: {
            changes: Number(info.changes),
            last_row_id: info.lastInsertRowid,
          },
        };
      } catch (err) {
        console.error("SQLite run error:", this.sql, this.bindings, err);
        throw err;
      }
    }

    async raw<T = unknown>(): Promise<T[]> {
      const { results } = await this.all<any>();
      return results.map((row: any) => Object.values(row)) as T[];
    }

    _getSql() {
      return this.sql;
    }

    _getBindings() {
      return this.bindings;
    }
  }

  return {
    prepare(sql: string) {
      return new SqlitePreparedStatement(sql);
    },

    async batch<T = unknown>(statements: any[]): Promise<any[]> {
      db.exec("BEGIN TRANSACTION;");
      try {
        const results: any[] = [];
        for (const stmt of statements) {
          if (!stmt) continue;
          const isSelect = /^\s*select/i.test(stmt._getSql?.() || "");
          const res = isSelect ? await stmt.all() : await stmt.run();
          results.push(res);
        }
        db.exec("COMMIT;");
        return results;
      } catch (err) {
        db.exec("ROLLBACK;");
        throw err;
      }
    },

    async exec(query: string) {
      db.exec(query);
      return { count: 0, duration: 0 };
    },

    getDbPath() {
      return resolvedPath;
    },
  };
}
