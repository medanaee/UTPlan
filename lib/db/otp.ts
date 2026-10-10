import { getD1 } from "./client";

let tableReady: Promise<void> | null = null;

async function ensureOtpTable() {
  if (!tableReady) {
    const d1 = getD1();
    if (!d1) throw new Error("Database unavailable");
    tableReady = d1
      .prepare(
        `CREATE TABLE IF NOT EXISTS email_otps (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          code_hash TEXT NOT NULL,
          first_name TEXT,
          last_name TEXT,
          mode TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          expires_at TEXT NOT NULL,
          used_at TEXT,
          created_at TEXT NOT NULL
        )`
      )
      .run()
      .then(() => undefined);
  }
  return tableReady;
}

export async function saveEmailOtp(data: {
  email: string;
  codeHash: string;
  firstName?: string;
  lastName?: string;
  mode: "login" | "register";
  expiresAt: string;
}) {
  const d1 = getD1();
  if (!d1) throw new Error("Database unavailable");
  await ensureOtpTable();
  await d1.prepare("DELETE FROM email_otps WHERE email = ? AND used_at IS NULL").bind(data.email).run();
  await d1
    .prepare(
      `INSERT INTO email_otps (id, email, code_hash, first_name, last_name, mode, attempts, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .bind(
      `otp_${crypto.randomUUID().slice(0, 12)}`,
      data.email,
      data.codeHash,
      data.firstName || null,
      data.lastName || null,
      data.mode,
      data.expiresAt,
      new Date().toISOString()
    )
    .run();
}

export async function getLatestEmailOtp(email: string) {
  const d1 = getD1();
  if (!d1) return null;
  await ensureOtpTable();
  return d1
    .prepare("SELECT * FROM email_otps WHERE email = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1")
    .bind(email)
    .first();
}

export async function incrementEmailOtpAttempts(id: string) {
  const d1 = getD1();
  if (!d1) return;
  await d1.prepare("UPDATE email_otps SET attempts = attempts + 1 WHERE id = ?").bind(id).run();
}

export async function consumeEmailOtp(id: string) {
  const d1 = getD1();
  if (!d1) return;
  await d1.prepare("UPDATE email_otps SET used_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
}
