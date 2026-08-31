import { env } from "cloudflare:workers";

let isD1LogShown = false;

/**
 * Access Cloudflare D1 database binding
 */
export function getD1(): any {
  let db: any = null;

  try {
    if (typeof env !== "undefined" && (env as any)?.ut_ece_db) {
      db = (env as any).ut_ece_db;
    }
  } catch {}

  if (!db && typeof globalThis !== "undefined" && (globalThis as any).ut_ece_db) {
    db = (globalThis as any).ut_ece_db;
  }
  if (!db && typeof process !== "undefined" && (process.env as any)?.ut_ece_db) {
    db = (process.env as any).ut_ece_db;
  }

  if (db && !isD1LogShown) {
    console.log("\x1b[32m✔ [Cloudflare D1]\x1b[0m بایندینگ پایگاه‌داده ut_ece_db با موفقیت متصل شد.");
    isD1LogShown = true;
  }

  return db;
}
