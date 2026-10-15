import { apiResponseJson, withApiTiming } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth";
import { getD1 } from "@/lib/db";

export const dynamic = "force-dynamic";
const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, read_at TEXT
)`;

async function GETHandler(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.authorized) return auth.response!;
  const d1 = getD1();
  if (!d1) return apiResponseJson({ success: false, message: "پایگاه داده در دسترس نیست." }, { status: 503 });
  try {
    await d1.prepare(CREATE_TABLE).run();
    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number(params.get("page") || 1));
    const pageSize = Math.min(50, Math.max(1, Number(params.get("pageSize") || 20)));
    const offset = (page - 1) * pageSize;
    const count = await d1.prepare("SELECT COUNT(*) AS count FROM contact_messages").first<any>();
    const unread = await d1.prepare("SELECT COUNT(*) AS count FROM contact_messages WHERE is_read = 0").first<any>();
    const rows = await d1.prepare("SELECT id, name, email, message, is_read, created_at, read_at FROM contact_messages ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(pageSize, offset).all<any>();
    const total = Number(count?.count || 0);
    return apiResponseJson({ success: true, data: rows.results || [], pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), unread: Number(unread?.count || 0) } });
  } catch (error) {
    console.error("Admin contact GET error:", error);
    return apiResponseJson({ success: false, message: "خطا در دریافت پیام‌ها." }, { status: 500 });
  }
}

async function PATCHHandler(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.authorized) return auth.response!;
  const d1 = getD1();
  if (!d1) return apiResponseJson({ success: false, message: "پایگاه داده در دسترس نیست." }, { status: 503 });
  try {
    const { id, isRead } = await request.json();
    if (!id) return apiResponseJson({ success: false, message: "شناسه پیام الزامی است." }, { status: 400 });
    await d1.prepare("UPDATE contact_messages SET is_read = ?, read_at = ? WHERE id = ?")
      .bind(isRead === false ? 0 : 1, isRead === false ? null : new Date().toISOString(), id).run();
    return apiResponseJson({ success: true });
  } catch (error) {
    console.error("Admin contact PATCH error:", error);
    return apiResponseJson({ success: false, message: "خطا در به‌روزرسانی پیام." }, { status: 500 });
  }
}

export const GET = withApiTiming(GETHandler);
export const PATCH = withApiTiming(PATCHHandler);
