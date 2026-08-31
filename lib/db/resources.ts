import type { OfferingResource, OfferingResourceType } from "../types";
import { getD1 } from "./client";

export async function getOfferingResources(offeringId: string): Promise<OfferingResource[]> {
  const d1 = getD1();
  if (!d1) return [];

  try {
    const { results } = await d1
      .prepare(
        "SELECT * FROM offering_resources WHERE offering_id = ? AND deleted_at IS NULL ORDER BY created_at DESC"
      )
      .bind(offeringId)
      .all();

    return (results || []).map((r: any) => ({
      id: r.id,
      offeringId: r.offering_id,
      title: r.title,
      term: r.term || undefined,
      type: r.type as OfferingResourceType,
      url: r.url,
      createdAt: r.created_at,
      deletedAt: r.deleted_at || null,
    }));
  } catch (err) {
    console.error("D1 getOfferingResources error:", err);
    return [];
  }
}

export async function createOfferingResource(data: {
  offeringId: string;
  title: string;
  term?: string;
  type: OfferingResourceType;
  url: string;
}): Promise<OfferingResource> {
  const id = `res_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const cleanTitle = data.title.trim();
  const cleanTerm = data.term?.trim() || null;
  const cleanUrl = data.url.trim();

  const d1 = getD1();
  if (!d1) throw new Error("پایگاه‌داده در دسترس نیست.");

  try {
    await d1
      .prepare(
        `INSERT INTO offering_resources (id, offering_id, title, term, type, url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, data.offeringId, cleanTitle, cleanTerm, data.type, cleanUrl, now)
      .run();
  } catch (err) {
    console.error("D1 createOfferingResource error:", err);
    throw err;
  }

  return {
    id,
    offeringId: data.offeringId,
    title: cleanTitle,
    term: cleanTerm || undefined,
    type: data.type,
    url: cleanUrl,
    createdAt: now,
    deletedAt: null,
  };
}

export async function updateOfferingResource(
  id: string,
  data: Partial<Pick<OfferingResource, "title" | "term" | "type" | "url">>
): Promise<OfferingResource | null> {
  const d1 = getD1();
  if (!d1) return null;

  try {
    const existing = await d1
      .prepare("SELECT * FROM offering_resources WHERE id = ? AND deleted_at IS NULL")
      .bind(id)
      .first();
    if (!existing) return null;

    const title = data.title !== undefined ? data.title.trim() : (existing as any).title;
    const term = data.term !== undefined ? (data.term?.trim() || null) : (existing as any).term;
    const type = data.type !== undefined ? data.type : (existing as any).type;
    const url = data.url !== undefined ? data.url.trim() : (existing as any).url;

    await d1
      .prepare(
        `UPDATE offering_resources
         SET title = ?, term = ?, type = ?, url = ?
         WHERE id = ?`
      )
      .bind(title, term, type, url, id)
      .run();

    return {
      id,
      offeringId: (existing as any).offering_id,
      title,
      term: term || undefined,
      type,
      url,
      createdAt: (existing as any).created_at,
      deletedAt: (existing as any).deleted_at || null,
    };
  } catch (err) {
    console.error("D1 updateOfferingResource error:", err);
    return null;
  }
}

export async function deleteOfferingResource(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const d1 = getD1();
  if (!d1) return false;

  try {
    await d1
      .prepare("UPDATE offering_resources SET deleted_at = ? WHERE id = ?")
      .bind(now, id)
      .run();
    return true;
  } catch (err) {
    console.error("D1 deleteOfferingResource error:", err);
    return false;
  }
}
