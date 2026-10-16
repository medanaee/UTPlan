import type { Review } from "@/lib/types";
import { consumePersistentRateLimit, getClientIp } from "@/lib/db/security";

export const MAX_REVIEW_COMMENT_LENGTH = 5000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 10;

type ReviewRequest = {
  targetId: string;
  professorId?: string | null;
  comment: string;
  isAnonymous: boolean;
  criteriaRatings?: Record<string, number>;
  studentGrade?: number | null;
};


export function parseReviewRequest(
  body: unknown,
  targetField: "professorId" | "offeringId"
): { ok: true; value: ReviewRequest } | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "بدنه درخواست نامعتبر است." };
  }

  const input = body as Record<string, unknown>;
  const targetId = typeof input[targetField] === "string" ? input[targetField].trim() : "";
  const professorId = typeof input.professorId === "string" && input.professorId.trim() ? input.professorId.trim() : null;
  const comment = typeof input.comment === "string" ? input.comment.trim() : "";

  if (!targetId || !comment) {
    return { ok: false, message: "شناسه و متن نظر الزامی است." };
  }
  if (comment.length > MAX_REVIEW_COMMENT_LENGTH) {
    return { ok: false, message: `متن نظر نمی‌تواند بیشتر از ${MAX_REVIEW_COMMENT_LENGTH} کاراکتر باشد.` };
  }

  let criteriaRatings: Record<string, number> | undefined;
  if (input.criteriaRatings && typeof input.criteriaRatings === "object" && !Array.isArray(input.criteriaRatings)) {
    criteriaRatings = {};
    for (const [key, value] of Object.entries(input.criteriaRatings as Record<string, unknown>).slice(0, 20)) {
      const score = Number(value);
      if (Number.isFinite(score) && score >= 1 && score <= 10) criteriaRatings[key.slice(0, 50)] = score;
    }
  }

  let studentGrade: number | null | undefined;
  if (input.studentGrade !== undefined && input.studentGrade !== null && input.studentGrade !== "") {
    const grade = Number(input.studentGrade);
    if (Number.isFinite(grade) && grade >= 0 && grade <= 20) studentGrade = grade;
  }

  return {
    ok: true,
    value: {
      targetId,
      professorId,
      comment,
      // Privacy-first: missing isAnonymous must never reveal the author's name.
      // A named public review requires an explicit opt-in with isAnonymous: false.
      isAnonymous: input.isAnonymous !== false,
      criteriaRatings,
      studentGrade,
    },
  };
}

export async function checkReviewRateLimit(request: Request, userId?: string | null) {
  const clientKey = userId || getClientIp(request) || "unknown";
  return consumePersistentRateLimit(`review:${clientKey}`, RATE_LIMIT, RATE_WINDOW_MS, { eventType: "review", ip: getClientIp(request), subject: userId });
}

export function toReviewResource(review: Review, viewerId?: string | null): Omit<Review, "userId"> & { isMine: boolean } {
  const isMine = Boolean(viewerId && review.userId && viewerId === review.userId);
  const { userId: _userId, ...resource } = review;
  return { ...resource, isMine };
}

export function toReviewResources(reviews: Review[], viewerId?: string | null) {
  return reviews.map((review) => toReviewResource(review, viewerId));
}
