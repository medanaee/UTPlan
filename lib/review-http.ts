import type { Review } from "@/lib/types";

export const MAX_REVIEW_COMMENT_LENGTH = 5000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 10;

type ReviewRequest = {
  targetId: string;
  comment: string;
  isAnonymous: boolean;
  criteriaRatings?: Record<string, number>;
  studentGrade?: number | null;
};

const requestBuckets = new Map<string, { count: number; resetAt: number }>();

export function parseReviewRequest(
  body: unknown,
  targetField: "professorId" | "offeringId"
): { ok: true; value: ReviewRequest } | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "بدنه درخواست نامعتبر است." };
  }

  const input = body as Record<string, unknown>;
  const targetId = typeof input[targetField] === "string" ? input[targetField].trim() : "";
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
      comment,
      isAnonymous: input.isAnonymous === true,
      criteriaRatings,
      studentGrade,
    },
  };
}

export function checkReviewRateLimit(request: Request, userId?: string | null) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientKey = userId || request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || forwarded || "unknown";
  const now = Date.now();
  const current = requestBuckets.get(clientKey);

  if (!current || current.resetAt <= now) {
    requestBuckets.set(clientKey, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= RATE_LIMIT) {
    return { allowed: false, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function toReviewResource(review: Review, viewerId?: string | null): Omit<Review, "userId"> & { isMine: boolean } {
  const isMine = Boolean(viewerId && review.userId && viewerId === review.userId);
  const { userId: _userId, ...resource } = review;
  return { ...resource, isMine };
}

export function toReviewResources(reviews: Review[], viewerId?: string | null) {
  return reviews.map((review) => toReviewResource(review, viewerId));
}
