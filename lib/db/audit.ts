import type { AuditActionType, AuditEntityType, AuditLog } from "../types";
import { getD1 } from "./client";

export interface LogAdminActionParams {
  userId: string;
  userName: string;
  userEmail: string;
  action: AuditActionType;
  entityType: AuditEntityType;
  entityId?: string | null;
  entityName?: string | null;
  details?: Record<string, any> | string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface GetAuditLogsParams {
  page?: number;
  limit?: number;
  action?: string;
  entityType?: string;
  userId?: string;
  search?: string;
}

export interface GetAuditLogsResult {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Normalizes DB timestamp to standard ISO-8601 UTC string.
 * Handles SQLite default CURRENT_TIMESTAMP format "YYYY-MM-DD HH:MM:SS".
 */
export function normalizeCreatedAt(raw: string | null | undefined): string {
  if (!raw) return new Date().toISOString();
  const trimmed = String(raw).trim();
  if (trimmed.includes(" ") && !trimmed.includes("T")) {
    return `${trimmed.replace(" ", "T")}Z`;
  }
  if (!trimmed.endsWith("Z") && !trimmed.includes("+")) {
    return `${trimmed}Z`;
  }
  return trimmed;
}

/**
 * Builds a diff object comparing two states of an entity.
 */
export function buildDiff<T extends Record<string, any>>(
  before: T,
  after: T,
  fieldsToCompare?: (keyof T)[]
): {
  changedFields: string[];
  changes: Record<string, { before: any; after: any }>;
} {
  const keys = fieldsToCompare || (Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})])) as (keyof T)[]);
  const changes: Record<string, { before: any; after: any }> = {};

  for (const key of keys) {
    const bVal = before?.[key] !== undefined ? before[key] : null;
    const aVal = after?.[key] !== undefined ? after[key] : null;

    if (!fieldsToCompare && (key === "updatedAt" || key === "createdAt" || key === "deletedAt")) {
      continue;
    }

    if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
      changes[String(key)] = {
        before: bVal,
        after: aVal,
      };
    }
  }

  return {
    changedFields: Object.keys(changes),
    changes,
  };
}

/**
 * Safely logs an administrative action in the database.
 * Fail-safe: Any failure in logging will not break or throw in the caller's execution flow.
 */
export async function logAdminAction(params: LogAdminActionParams): Promise<void> {
  const d1 = getD1();
  if (!d1) return;

  try {
    const id = `log_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const detailsStr =
      params.details === undefined || params.details === null
        ? null
        : typeof params.details === "string"
        ? params.details
        : JSON.stringify(params.details);

    await d1
      .prepare(
        `INSERT INTO audit_logs (
          id, user_id, user_name, user_email, action, entity_type,
          entity_id, entity_name, details, ip_address, user_agent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        params.userId,
        params.userName || "مدیر سامانه",
        params.userEmail || "",
        params.action,
        params.entityType,
        params.entityId || null,
        params.entityName || null,
        detailsStr,
        params.ipAddress || null,
        params.userAgent || null,
        now
      )
      .run();
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

/**
 * Retrieves paginated audit logs with filtering and text search.
 */
export async function getAuditLogs(params: GetAuditLogsParams = {}): Promise<GetAuditLogsResult> {
  const d1 = getD1();
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 25));
  const offset = (page - 1) * limit;

  if (!d1) {
    return { logs: [], total: 0, page, limit, totalPages: 0 };
  }

  try {
    const conditions: string[] = [];
    const bindings: any[] = [];

    if (params.action && params.action !== "all") {
      conditions.push("action = ?");
      bindings.push(params.action);
    }

    if (params.entityType && params.entityType !== "all") {
      conditions.push("entity_type = ?");
      bindings.push(params.entityType);
    }

    if (params.userId) {
      conditions.push("user_id = ?");
      bindings.push(params.userId);
    }

    if (params.search && params.search.trim()) {
      const q = `%${params.search.trim().toLowerCase()}%`;
      conditions.push(
        "(LOWER(user_name) LIKE ? OR LOWER(user_email) LIKE ? OR LOWER(entity_name) LIKE ? OR LOWER(details) LIKE ?)"
      );
      bindings.push(q, q, q, q);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // 1. Get total count
    const countSql = `SELECT count(*) as count FROM audit_logs ${whereClause}`;
    const countRow = await d1.prepare(countSql).bind(...bindings).first();
    const total = Number((countRow as any)?.count) || 0;
    const totalPages = Math.ceil(total / limit);

    // 2. Get paginated logs
    const querySql = `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const queryBindings = [...bindings, limit, offset];
    const { results } = await d1.prepare(querySql).bind(...queryBindings).all();

    const logs: AuditLog[] = (results || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      action: row.action as AuditActionType,
      entityType: row.entity_type as AuditEntityType,
      entityId: row.entity_id || null,
      entityName: row.entity_name || null,
      details: row.details || null,
      ipAddress: row.ip_address || null,
      userAgent: row.user_agent || null,
      createdAt: normalizeCreatedAt(row.created_at),
    }));

    return { logs, total, page, limit, totalPages };
  } catch (err) {
    console.error("getAuditLogs error:", err);
    return { logs: [], total: 0, page, limit, totalPages: 0 };
  }
}
