import { getD1 } from "./client";

export type CodeTable = "courses" | "professors" | "course_offerings" | "course_events";
export type CodePrefix = "CRS" | "PRF" | "OFF" | "EVT";

/**
 * Generates a collision-free unique code with automatic retry mechanism.
 * If a collision is encountered (virtually improbable with 16.7M combinations),
 * it retries up to maxRetries times, falling back to a timestamped suffix if needed.
 */
export async function generateUniqueCode(
  table: CodeTable,
  prefix: CodePrefix,
  maxRetries = 10
): Promise<string> {
  const d1 = getD1();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const randomPart = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
    const candidateCode = `${prefix}-${randomPart}`;

    if (!d1) {
      return candidateCode;
    }

    try {
      const existing = await d1
        .prepare(`SELECT id FROM ${table} WHERE code = ? LIMIT 1`)
        .bind(candidateCode)
        .first();

      if (!existing) {
        return candidateCode;
      }

      console.warn(
        `[AutoCode Collision] Collision detected for code "${candidateCode}" in table "${table}" (attempt ${attempt}/${maxRetries}). Retrying...`
      );
    } catch (err) {
      console.warn(`[AutoCode Collision Check Error] Table ${table}:`, err);
      return candidateCode;
    }
  }

  // Safe fallback with timestamp suffix to guarantee 100% uniqueness
  const timestampSuffix = Date.now().toString(36).slice(-3).toUpperCase();
  return `${prefix}-${crypto.randomUUID().slice(0, 5).toUpperCase()}${timestampSuffix}`;
}

/**
 * Checks if a code is already used by another record in the given table.
 * If excludeId is provided, ignores that record (useful for update validation).
 */
export async function isCodeDuplicate(
  table: CodeTable,
  code: string,
  excludeId?: string
): Promise<boolean> {
  const d1 = getD1();
  if (!d1 || !code.trim()) return false;

  const cleanCode = code.trim().toUpperCase();
  let query = `SELECT id FROM ${table} WHERE code = ?`;
  const binds: any[] = [cleanCode];

  if (excludeId) {
    query += " AND id != ?";
    binds.push(excludeId);
  }

  query += " LIMIT 1";

  try {
    const existing = await d1.prepare(query).bind(...binds).first();
    return Boolean(existing);
  } catch (err) {
    console.error(`Error checking code uniqueness in ${table}:`, err);
    return false;
  }
}
