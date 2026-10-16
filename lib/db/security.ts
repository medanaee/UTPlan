import { getD1 } from "./client";

let schemaReady: Promise<void> | null = null;

export async function ensureSecuritySchema() {
  if (!schemaReady) {
    const d1 = getD1();
    if (!d1) throw new Error("Database unavailable");
    schemaReady = (async () => {
      await d1.prepare("CREATE TABLE IF NOT EXISTS security_rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, reset_at INTEGER NOT NULL)").run();
      await d1.prepare(`CREATE TABLE IF NOT EXISTS security_abuse_events (
        event_type TEXT NOT NULL,
        ip TEXT NOT NULL,
        subject TEXT NOT NULL DEFAULT '',
        blocked_count INTEGER NOT NULL DEFAULT 0,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        PRIMARY KEY (event_type, ip, subject)
      )`).run();
      try { await d1.prepare("ALTER TABLE users ADD COLUMN last_login_ip TEXT").run(); } catch {}
      try { await d1.prepare("ALTER TABLE users ADD COLUMN last_login_at TEXT").run(); } catch {}
    })();
  }
  return schemaReady;
}

export function getClientIp(request: Request): string | null {
  const value = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return value && value.length <= 128 ? value : null;
}

export async function recordUserLoginIp(userId: string, ip: string | null) {
  if (!ip) return;
  const d1 = getD1();
  if (!d1) return;
  await ensureSecuritySchema();
  await d1.prepare("UPDATE users SET last_login_ip = ?, last_login_at = ? WHERE id = ?")
    .bind(ip, new Date().toISOString(), userId)
    .run();
}

export async function consumePersistentRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  metadata?: { eventType: string; ip?: string | null; subject?: string | null }
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const d1 = getD1();
  if (!d1) return { allowed: true, retryAfterSeconds: 0 };
  await ensureSecuritySchema();
  const now = Date.now();
  await d1.prepare("DELETE FROM security_rate_limits WHERE reset_at <= ?").bind(now).run();
  await d1.prepare("DELETE FROM security_abuse_events WHERE last_seen_at < ?").bind(new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()).run();
  const current: any = await d1.prepare("SELECT count, reset_at FROM security_rate_limits WHERE key = ?").bind(key).first();
  if (!current || Number(current.reset_at) <= now) {
    await d1.prepare("INSERT INTO security_rate_limits (key, count, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at")
      .bind(key, now + windowMs).run();
    return { allowed: true, retryAfterSeconds: 0 };
  }
  const retryAfterSeconds = Math.max(1, Math.ceil((Number(current.reset_at) - now) / 1000));
  if (Number(current.count) >= limit) {
    if (metadata?.eventType && metadata.ip) {
      const nowIso = new Date().toISOString();
      await d1.prepare(`INSERT INTO security_abuse_events (event_type, ip, subject, blocked_count, first_seen_at, last_seen_at)
        VALUES (?, ?, ?, 1, ?, ?)
        ON CONFLICT(event_type, ip, subject) DO UPDATE SET blocked_count = blocked_count + 1, last_seen_at = excluded.last_seen_at`)
        .bind(metadata.eventType, metadata.ip, metadata.subject || "", nowIso, nowIso).run();
    }
    return { allowed: false, retryAfterSeconds };
  }
  await d1.prepare("UPDATE security_rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
  return { allowed: true, retryAfterSeconds: 0 };
}
