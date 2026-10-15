import { apiResponseJson, withApiTiming } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth";
import { getD1, getReviewById, updateReview, deleteReview, ensureReviewSchema } from "@/lib/db";
import { readJsonBody, isRequestError } from "@/lib/api-request";

export const dynamic = "force-dynamic";

async function GETHandler(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.authorized) return auth.response!;
  const d1 = getD1();
  if (!d1) return apiResponseJson({ success: false, message: "پایگاه داده در دسترس نیست." }, { status: 503 });

  try {
    await ensureReviewSchema();
    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number(params.get("page") || 1));
    const pageSize = Math.min(50, Math.max(1, Number(params.get("pageSize") || 20)));
    const offset = (page - 1) * pageSize;
    const count = await d1.prepare("SELECT COUNT(*) AS count FROM reviews").first<any>();
    const { results } = await d1.prepare(`
      SELECT r.id, r.target_type, r.target_id, r.comment, r.overall_rating,
             r.is_anonymous, r.created_at,
             CASE WHEN r.is_anonymous = 1 THEN 'کاربر ناشناس' ELSE COALESCE(u.name, 'کاربر سامانه') END AS author_name,
             CASE
               WHEN r.target_type = 'professor' THEN COALESCE(NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''), 'استاد حذف‌شده')
               WHEN r.target_type = 'offering' THEN COALESCE(c.name, 'درس حذف‌شده')
               ELSE 'مورد نامشخص'
             END AS target_name,
             CASE WHEN r.target_type = 'professor' THEN 'استاد' ELSE 'ارائه درس' END AS target_label
      FROM reviews r
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN professors p ON r.target_type = 'professor' AND p.id = r.target_id
      LEFT JOIN course_offerings o ON r.target_type = 'offering' AND o.id = r.target_id
      LEFT JOIN courses c ON c.id = o.course_id
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(pageSize, offset).all<any>();
    const total = Number(count?.count || 0);
    return apiResponseJson(
      {
        success: true,
        data: results || [],
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error) {
    console.error("Admin reviews GET error:", error);
    return apiResponseJson({ success: false, message: "خطا در دریافت آخرین نظرات." }, { status: 500 });
  }
}

export const GET = withApiTiming(GETHandler);

async function PUTHandler(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.authorized) return auth.response!;
  try {
    const body = await readJsonBody(request);
    if (isRequestError(body)) return apiResponseJson({ success: false, message: body.message }, { status: body.status });
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const comment = typeof body.comment === "string" ? body.comment.trim() : "";
    if (!id || !comment) return apiResponseJson({ success: false, message: "شناسه و متن نظر الزامی است." }, { status: 400 });
    if (comment.length > 5000) return apiResponseJson({ success: false, message: "متن نظر بیش از حد طولانی است." }, { status: 400 });
    if (!(await getReviewById(id))) return apiResponseJson({ success: false, message: "نظر پیدا نشد." }, { status: 404 });
    const updated = await updateReview(id, { comment, isAnonymous: Boolean(body.isAnonymous) });
    return apiResponseJson({ success: Boolean(updated), data: updated }, { status: updated ? 200 : 500 });
  } catch (error) {
    console.error("Admin review PUT error:", error);
    return apiResponseJson({ success: false, message: "خطا در ویرایش نظر." }, { status: 500 });
  }
}
export const PUT = withApiTiming(PUTHandler);

async function DELETEHandler(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.authorized) return auth.response!;
  try {
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) return apiResponseJson({ success: false, message: "شناسه نظر الزامی است." }, { status: 400 });
    const deleted = await deleteReview(id);
    return apiResponseJson({ success: deleted, message: deleted ? "نظر حذف شد." : "نظر پیدا نشد." }, { status: deleted ? 200 : 404 });
  } catch (error) {
    console.error("Admin review DELETE error:", error);
    return apiResponseJson({ success: false, message: "خطا در حذف نظر." }, { status: 500 });
  }
}
export const DELETE = withApiTiming(DELETEHandler);
