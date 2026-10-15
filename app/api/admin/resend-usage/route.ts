import { apiResponseJson, withApiTiming } from "@/lib/api-response";
import { requireSuperAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function quota(value: any) {
  if (!value || typeof value !== "object") return null;
  const used = Number(value.used || 0);
  const limit = value.limit === null || value.limit === undefined ? null : Number(value.limit);
  return { used, limit, remaining: limit === null ? null : Math.max(0, limit - used), resetsAt: value.resets_at || null };
}

async function GETHandler(request: Request) {
  const auth = await requireSuperAdminSession(request);
  if (!auth.authorized) return auth.response!;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return apiResponseJson({ success: false, message: "کلید RESEND_API_KEY روی سرور تنظیم نشده است." }, { status: 503 });
  }

  try {
    const response = await fetch("https://api.resend.com/usage", {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return apiResponseJson({ success: false, message: "دریافت مصرف Resend ناموفق بود.", errors: payload }, { status: response.status >= 500 ? 502 : response.status });
    }
    const usage = payload || {};
    const rateLimit = usage.rate_limit ? {
      limit: usage.rate_limit.limit ?? null,
      duration: usage.rate_limit.duration ?? null,
      remaining: response.headers.get("ratelimit-remaining"),
      reset: response.headers.get("ratelimit-reset"),
    } : null;
    return apiResponseJson({
      success: true,
      data: {
        fetchedAt: new Date().toISOString(),
        emails: { daily: quota(usage.emails?.daily), monthly: quota(usage.emails?.monthly) },
        contacts: quota(usage.contacts),
        segments: quota(usage.segments),
        broadcasts: quota(usage.broadcasts),
        domains: quota(usage.domains),
        aiCredits: quota(usage.ai_credits),
        automationRuns: quota(usage.automation_runs),
        rateLimit,
      },
    });
  } catch (error) {
    console.error("Resend usage error:", error);
    return apiResponseJson({ success: false, message: "ارتباط با Resend برقرار نشد." }, { status: 502 });
  }
}

export const GET = withApiTiming(GETHandler);
