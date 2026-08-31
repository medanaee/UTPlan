import type { Review } from "../types";
import { getD1 } from "./client";

export async function getReviews(targetType: "professor" | "offering", targetId: string): Promise<Review[]> {
  const d1 = getD1();
  if (!d1) return [];

  try {
    const { results } = await d1
      .prepare(
        `SELECT r.*, u.name AS author_name 
         FROM reviews r
         LEFT JOIN users u ON r.user_id = u.id
         WHERE r.target_type = ? AND r.target_id = ? AND r.deleted_at IS NULL
         ORDER BY r.created_at DESC`
      )
      .bind(targetType, targetId)
      .all();

    return (results || []).map((r: any) => {
      let criteriaRatings: any = undefined;
      if (r.criteria_ratings) {
        try {
          criteriaRatings = typeof r.criteria_ratings === "string" ? JSON.parse(r.criteria_ratings) : r.criteria_ratings;
        } catch {}
      }
      return {
        id: r.id,
        userId: r.user_id || null,
        targetType: r.target_type as any,
        targetId: r.target_id,
        isAnonymous: Boolean(r.is_anonymous),
        comment: r.comment,
        authorName: r.is_anonymous ? "دانشجوی دانشگاه تهران" : (r.author_name || "کاربر سامانه"),
        overallRating: Number(r.overall_rating) || 10,
        criteriaRatings,
        studentGrade: r.student_grade !== null && r.student_grade !== undefined ? Number(r.student_grade) : null,
        createdAt: r.created_at,
        deletedAt: r.deleted_at || null,
      };
    });
  } catch (err) {
    console.error("D1 getReviews error:", err);
    return [];
  }
}

export async function getReviewById(id: string): Promise<Review | null> {
  const d1 = getD1();
  if (!d1) return null;

  try {
    const r = await d1
      .prepare(
        `SELECT r.*, u.name AS author_name 
         FROM reviews r
         LEFT JOIN users u ON r.user_id = u.id
         WHERE r.id = ? AND r.deleted_at IS NULL`
      )
      .bind(id)
      .first();
    if (!r) return null;

    let criteriaRatings: any = undefined;
    if ((r as any).criteria_ratings) {
      try {
        criteriaRatings =
          typeof (r as any).criteria_ratings === "string"
            ? JSON.parse((r as any).criteria_ratings)
            : (r as any).criteria_ratings;
      } catch {}
    }

    return {
      id: (r as any).id,
      userId: (r as any).user_id || null,
      targetType: (r as any).target_type as any,
      targetId: (r as any).target_id,
      isAnonymous: Boolean((r as any).is_anonymous),
      comment: (r as any).comment,
      authorName: (r as any).is_anonymous ? "دانشجوی دانشگاه تهران" : ((r as any).author_name || "کاربر سامانه"),
      overallRating: Number((r as any).overall_rating) || 10,
      criteriaRatings,
      studentGrade: (r as any).student_grade !== null && (r as any).student_grade !== undefined ? Number((r as any).student_grade) : null,
      createdAt: (r as any).created_at,
      deletedAt: (r as any).deleted_at || null,
    };
  } catch (err) {
    console.error("D1 getReviewById error:", err);
    return null;
  }
}

export async function createReview(data: {
  userId?: string | null;
  targetType: "professor" | "offering";
  targetId: string;
  isAnonymous?: boolean;
  comment: string;
  overallRating: number;
  criteriaRatings?: Record<string, number>;
  studentGrade?: number | null;
}): Promise<Review> {
  const id = `rev_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const criteriaJson = data.criteriaRatings ? JSON.stringify(data.criteriaRatings) : null;
  const isAnon = data.isAnonymous ? 1 : 0;
  const grade = data.studentGrade !== undefined && data.studentGrade !== null ? Number(data.studentGrade) : null;

  const d1 = getD1();
  if (!d1) throw new Error("پایگاه‌داده در دسترس نیست.");

  try {
    await d1
      .prepare(
        `INSERT INTO reviews (id, user_id, target_type, target_id, is_anonymous, comment, overall_rating, criteria_ratings, student_grade, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        data.userId || null,
        data.targetType,
        data.targetId,
        isAnon,
        data.comment.trim(),
        data.overallRating,
        criteriaJson,
        grade,
        now
      )
      .run();
  } catch (err) {
    console.error("D1 createReview error:", err);
    throw err;
  }

  return {
    id,
    userId: data.userId || null,
    targetType: data.targetType,
    targetId: data.targetId,
    isAnonymous: Boolean(data.isAnonymous),
    comment: data.comment.trim(),
    overallRating: data.overallRating,
    criteriaRatings: data.criteriaRatings,
    studentGrade: grade,
    createdAt: now,
    deletedAt: null,
  };
}

export async function updateReview(
  id: string,
  data: {
    comment?: string;
    isAnonymous?: boolean;
    criteriaRatings?: Record<string, number>;
    overallRating?: number;
    studentGrade?: number | null;
  }
): Promise<Review | null> {
  const d1 = getD1();
  if (!d1) return null;

  try {
    const existing = await getReviewById(id);
    if (!existing) return null;

    const comment = data.comment !== undefined ? data.comment.trim() : existing.comment;
    const isAnon = data.isAnonymous !== undefined ? (data.isAnonymous ? 1 : 0) : existing.isAnonymous ? 1 : 0;
    const criteriaJson =
      data.criteriaRatings !== undefined
        ? JSON.stringify(data.criteriaRatings)
        : existing.criteriaRatings
        ? JSON.stringify(existing.criteriaRatings)
        : null;
    const overallRating = data.overallRating !== undefined ? data.overallRating : existing.overallRating;
    const grade = data.studentGrade !== undefined ? (data.studentGrade !== null ? Number(data.studentGrade) : null) : existing.studentGrade ?? null;

    await d1
      .prepare(
        `UPDATE reviews 
         SET comment = ?, is_anonymous = ?, criteria_ratings = ?, overall_rating = ?, student_grade = ?
         WHERE id = ?`
      )
      .bind(comment, isAnon, criteriaJson, overallRating, grade, id)
      .run();

    return await getReviewById(id);
  } catch (err) {
    console.error("D1 updateReview error:", err);
    return null;
  }
}

export async function deleteReview(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const d1 = getD1();
  if (!d1) return false;

  try {
    await d1.prepare("UPDATE reviews SET deleted_at = ? WHERE id = ?").bind(now, id).run();
    return true;
  } catch (err) {
    console.error("D1 deleteReview error:", err);
    return false;
  }
}
