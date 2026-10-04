import { getSqliteD1Adapter } from "./sqlite-adapter";

let cachedDb: any = null;
let isDbLogShown = false;

/**
 * Access database binding (Cloudflare D1 or Native SQLite on server)
 */
export function getD1(): any {
  if (cachedDb) {
    return cachedDb;
  }

  let db: any = null;

  // 1. Check globalThis or Cloudflare Workers environment
  try {
    if (typeof globalThis !== "undefined") {
      const g = globalThis as any;
      if (g.ut_ece_db) db = g.ut_ece_db;
      else if (g.__env__?.ut_ece_db) db = g.__env__.ut_ece_db;
    }
  } catch {}

  // 2. Check process.env.ut_ece_db (Wrangler / Miniflare)
  if (!db && typeof process !== "undefined" && (process.env as any)?.ut_ece_db) {
    db = (process.env as any).ut_ece_db;
  }

  // 3. Fallback to native Node.js SQLite adapter for Linux server / VPS
  if (!db && typeof process !== "undefined") {
    try {
      db = getSqliteD1Adapter();
      if (db && !isDbLogShown) {
        console.log(`\x1b[32m✔ [SQLite Server]\x1b[0m متصل شد: ${db.getDbPath()}`);
        isDbLogShown = true;
      }
    } catch (err) {
      console.error("\x1b[31m✖ [SQLite Server Error]\x1b[0m خطا در اتصال به SQLite:", err);
    }
  }

  if (db) {
    cachedDb = db;
    if (!isDbLogShown) {
      console.log("\x1b[32m✔ [Database]\x1b[0m بایندینگ پایگاه‌داده با موفقیت متصل شد.");
      isDbLogShown = true;
    }
  }

  return db;
}

/**
 * Helper to execute queries in chunks to respect SQLite / D1 parameter bounds
 * and eliminate full-table scans.
 */
export async function fetchInChunks<T, R>(
  items: T[],
  chunkSize: number,
  fetcher: (chunk: T[]) => Promise<R[]>
): Promise<R[]> {
  if (!items || items.length === 0) return [];
  const results: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkRes = await fetcher(chunk);
    if (chunkRes && chunkRes.length > 0) {
      results.push(...chunkRes);
    }
  }
  return results;
}
