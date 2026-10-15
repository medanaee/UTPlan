import { apiResponseJson, withApiTiming } from "@/lib/api-response";
import { getD1 } from "@/lib/db";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, read_at TEXT
)`;
const recentSubmissions = new Map<string, number[]>();

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function POSTHandler(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (name.length < 2 || name.length > 100) return apiResponseJson({ success: false, message: "نام باید بین ۲ تا ۱۰۰ نویسه باشد." }, { status: 400 });
    if (!validEmail(email) || email.length > 254) return apiResponseJson({ success: false, message: "ایمیل واردشده معتبر نیست." }, { status: 400 });
    if (message.length < 5 || message.length > 5000) return apiResponseJson({ success: false, message: "متن پیام باید بین ۵ تا ۵۰۰۰ نویسه باشد." }, { status: 400 });

    const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const now = Date.now();
    const attempts = (recentSubmissions.get(key) || []).filter((time) => now - time < 15 * 60 * 1000);
    if (attempts.length >= 3) return apiResponseJson({ success: false, message: "لطفاً کمی بعد دوباره تلاش کنید." }, { status: 429 });
    attempts.push(now);
    recentSubmissions.set(key, attempts);

    const d1 = getD1();
    if (!d1) return apiResponseJson({ success: false, message: "سرویس پیام در دسترس نیست." }, { status: 503 });
    await d1.prepare(CREATE_TABLE).run();
    await d1.prepare("INSERT INTO contact_messages (id, name, email, message, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(`msg_${randomUUID().replace(/-/g, "")}`, name, email, message, new Date().toISOString()).run();
    return apiResponseJson({ success: true, message: "پیام شما با موفقیت ارسال شد." });
  } catch (error) {
    console.error("Contact POST error:", error);
    return apiResponseJson({ success: false, message: "خطا در ارسال پیام." }, { status: 500 });
  }
}

export const POST = withApiTiming(POSTHandler);
