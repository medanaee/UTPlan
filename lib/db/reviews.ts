import type { Review, ReviewReactionSummary } from "../types";
import { getD1 } from "./client";

export const ALLOWED_REACTION_EMOJIS = ["👍", "👎", "❤️", "💡", "😂", "👏", "🔥"] as const;

export async function getReactionsForReviews(
  reviewIds: string[],
  userId?: string | null,
  clientId?: string | null
): Promise<Record<string, ReviewReactionSummary[]>> {
  const d1 = getD1();
  const map: Record<string, ReviewReactionSummary[]> = {};
  if (!d1 || reviewIds.length === 0) return map;

  try {
    const placeholders = reviewIds.map(() => "?").join(",");

    // 1. Get counts grouped by review_id and emoji
    const { results: countResults } = await d1
      .prepare(
        `SELECT review_id, emoji, COUNT(*) as count 
         FROM review_reactions 
         WHERE review_id IN (${placeholders}) 
         GROUP BY review_id, emoji 
         ORDER BY count DESC`
      )
      .bind(...reviewIds)
      .all();

    // 2. If user or client ID provided, find which ones the user reacted to
    const userReactedSet = new Set<string>();
    if (userId || clientId) {
      let userQuery = "";
      const userBinds: any[] = [...reviewIds];
      if (userId) {
        userQuery = `SELECT review_id, emoji FROM review_reactions WHERE review_id IN (${placeholders}) AND user_id = ?`;
        userBinds.push(userId);
      } else if (clientId) {
        userQuery = `SELECT review_id, emoji FROM review_reactions WHERE review_id IN (${placeholders}) AND user_id IS NULL AND client_id = ?`;
        userBinds.push(clientId);
      }

      const { results: userResults } = await d1
        .prepare(userQuery)
        .bind(...userBinds)
        .all();

      for (const ur of userResults || []) {
        userReactedSet.add(`${(ur as any).review_id}:${(ur as any).emoji}`);
      }
    }

    for (const r of countResults || []) {
      const revId = (r as any).review_id as string;
      const emoji = (r as any).emoji as string;
      const count = Number((r as any).count) || 0;
      if (!map[revId]) {
        map[revId] = [];
      }
      map[revId].push({
        emoji,
        count,
        userReacted: userReactedSet.has(`${revId}:${emoji}`),
      });
    }
  } catch (err) {
    console.error("D1 getReactionsForReviews error:", err);
  }

  return map;
}

export async function toggleReviewReaction(params: {
  reviewId: string;
  emoji: string;
  userId?: string | null;
  clientId?: string | null;
}): Promise<{
  success: boolean;
  action?: "added" | "removed";
  reactions?: ReviewReactionSummary[];
  message?: string;
}> {
  const { reviewId, emoji, userId, clientId } = params;
  if (!ALLOWED_REACTION_EMOJIS.includes(emoji as any)) {
    return { success: false, message: "ایموجی نامعتبر است." };
  }
  if (!userId && !clientId) {
    return { success: false, message: "شناسه کاربر یا کلاینت نامشخص است." };
  }

  const d1 = getD1();
  if (!d1) {
    return { success: false, message: "دیتابیس در دسترس نیست." };
  }

  try {
    const review = await d1.prepare("SELECT id FROM reviews WHERE id = ?").bind(reviewId).first();
    if (!review) {
      return { success: false, message: "نظر مورد نظر یافت نشد." };
    }

    let existingReaction: any = null;
    if (userId) {
      existingReaction = await d1
        .prepare("SELECT id FROM review_reactions WHERE review_id = ? AND user_id = ? AND emoji = ?")
        .bind(reviewId, userId, emoji)
        .first();
    } else {
      existingReaction = await d1
        .prepare(
          "SELECT id FROM review_reactions WHERE review_id = ? AND user_id IS NULL AND client_id = ? AND emoji = ?"
        )
        .bind(reviewId, clientId, emoji)
        .first();
    }

    let action: "added" | "removed" = "added";
    if (existingReaction) {
      await d1.prepare("DELETE FROM review_reactions WHERE id = ?").bind(existingReaction.id).run();
      action = "removed";
    } else {
      const id = `react_${crypto.randomUUID().slice(0, 10)}`;
      const now = new Date().toISOString();
      await d1
        .prepare(
          "INSERT INTO review_reactions (id, review_id, user_id, client_id, emoji, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(id, reviewId, userId || null, userId ? null : clientId || null, emoji, now)
        .run();
      action = "added";
    }

    const summaryMap = await getReactionsForReviews([reviewId], userId, clientId);
    return {
      success: true,
      action,
      reactions: summaryMap[reviewId] || [],
    };
  } catch (err: any) {
    console.error("D1 toggleReviewReaction error:", err);
    return { success: false, message: err?.message || "خطا در ثبت واکنش." };
  }
}

export async function getReviews(
  targetType: "professor" | "offering",
  targetId: string,
  currentUserId?: string | null,
  currentClientId?: string | null
): Promise<Review[]> {
  const d1 = getD1();
  if (!d1) return [];

  try {
    const { results } = await d1
      .prepare(
        `SELECT r.*, u.name AS author_name 
         FROM reviews r
         LEFT JOIN users u ON r.user_id = u.id
         WHERE r.target_type = ? AND r.target_id = ?
         ORDER BY r.created_at DESC`
      )
      .bind(targetType, targetId)
      .all();

    const rawReviews = (results || []).map((r: any) => {
      let criteriaRatings: any = undefined;
      if (r.criteria_ratings) {
        try {
          criteriaRatings = typeof r.criteria_ratings === "string" ? JSON.parse(r.criteria_ratings) : r.criteria_ratings;
        } catch {}
      }
      const hasScores =
        criteriaRatings &&
        typeof criteriaRatings === "object" &&
        Object.values(criteriaRatings).some((v: any) => typeof v === "number" && v > 0);
      const rawRating = Number(r.overall_rating);
      const overallRating = hasScores && rawRating > 0 ? rawRating : null;

      return {
        id: r.id,
        userId: r.user_id || null,
        targetType: r.target_type as any,
        targetId: r.target_id,
        isAnonymous: Boolean(r.is_anonymous),
        comment: r.comment,
        authorName: r.is_anonymous ? "دانشجوی دانشگاه تهران" : (r.author_name || "کاربر سامانه"),
        overallRating,
        criteriaRatings,
        studentGrade: r.student_grade !== null && r.student_grade !== undefined ? Number(r.student_grade) : null,
        createdAt: r.created_at,
      };
    });

    if (rawReviews.length === 0) return [];

    const reviewIds = rawReviews.map((r: any) => r.id);
    const reactionsMap = await getReactionsForReviews(reviewIds, currentUserId, currentClientId);

    return rawReviews.map((r: any) => ({
      ...r,
      reactions: reactionsMap[r.id] || [],
    }));
  } catch (err) {
    console.error("D1 getReviews error:", err);
    return [];
  }
}

export async function getReviewById(
  id: string,
  currentUserId?: string | null,
  currentClientId?: string | null
): Promise<Review | null> {
  const d1 = getD1();
  if (!d1) return null;

  try {
    const r = await d1
      .prepare(
        `SELECT r.*, u.name AS author_name 
         FROM reviews r
         LEFT JOIN users u ON r.user_id = u.id
         WHERE r.id = ?`
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

    const reactionsMap = await getReactionsForReviews([id], currentUserId, currentClientId);

    const hasScores =
      criteriaRatings &&
      typeof criteriaRatings === "object" &&
      Object.values(criteriaRatings).some((v: any) => typeof v === "number" && v > 0);
    const rawRating = Number((r as any).overall_rating);
    const overallRating = hasScores && rawRating > 0 ? rawRating : null;

    return {
      id: (r as any).id,
      userId: (r as any).user_id || null,
      targetType: (r as any).target_type as any,
      targetId: (r as any).target_id,
      isAnonymous: Boolean((r as any).is_anonymous),
      comment: (r as any).comment,
      authorName: (r as any).is_anonymous ? "دانشجوی دانشگاه تهران" : ((r as any).author_name || "کاربر سامانه"),
      overallRating,
      criteriaRatings,
      studentGrade: (r as any).student_grade !== null && (r as any).student_grade !== undefined ? Number((r as any).student_grade) : null,
      createdAt: (r as any).created_at,
      reactions: reactionsMap[id] || [],
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
  overallRating: number | null;
  criteriaRatings?: Record<string, number>;
  studentGrade?: number | null;
}): Promise<Review> {
  const id = `rev_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const criteriaJson = data.criteriaRatings ? JSON.stringify(data.criteriaRatings) : null;
  const isAnon = data.isAnonymous ? 1 : 0;
  const grade = data.studentGrade !== undefined && data.studentGrade !== null ? Number(data.studentGrade) : null;
  const ratingToStore = data.overallRating !== null && data.overallRating !== undefined ? data.overallRating : 0;

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
        ratingToStore,
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
    overallRating?: number | null;
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
    const overallRating =
      data.overallRating !== undefined
        ? data.overallRating !== null
          ? data.overallRating
          : 0
        : existing.overallRating !== null
        ? existing.overallRating
        : 0;
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
  const d1 = getD1();
  if (!d1) return false;

  try {
    await d1.prepare("DELETE FROM reviews WHERE id = ?").bind(id).run();
    return true;
  } catch (err) {
    console.error("D1 deleteReview error:", err);
    return false;
  }
}
