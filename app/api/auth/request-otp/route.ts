import { apiError, apiResponseJson, withApiTiming } from "@/lib/api-response";
import { isRequestError, readJsonBody } from "@/lib/api-request";
import { canRequestOtp, issueEmailOtp, normalizeUtEmail, sendResendEmail } from "@/lib/otp";

async function POSTHandler(request: Request) {
  try {
    const body = await readJsonBody(request);
    if (isRequestError(body)) return apiError(body.message, body.status);
    const input = body as Record<string, unknown>;
    const email = normalizeUtEmail(input.email);
    const mode = input.mode === "register" ? "register" : "login";
    const firstName = typeof input.firstName === "string" ? input.firstName.trim().slice(0, 80) : "";
    const lastName = typeof input.lastName === "string" ? input.lastName.trim().slice(0, 120) : "";
    if (!email) return apiError("فقط ایمیل دانشگاه تهران با دامنهٔ @ut.ac.ir مجاز است.", 400);
    if (mode === "register" && (!firstName || !lastName)) return apiError("نام و نام خانوادگی الزامی است.", 400);

    const key = `${email}:${request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown"}`;
    const limit = canRequestOtp(key);
    if (!limit.allowed) return apiError("لطفاً قبل از ارسال کد جدید کمی صبر کنید.", 429, [], { "Retry-After": String(limit.retryAfterSeconds) });

    const code = await issueEmailOtp({ email, firstName, lastName, mode });
    await sendResendEmail({ to: email, code });
    return apiResponseJson({ success: true, message: "کد تأیید به ایمیل شما ارسال شد." });
  } catch (error) {
    console.error("Request OTP error:", error);
    return apiError("ارسال کد تأیید انجام نشد.", 500);
  }
}

export const POST = withApiTiming(POSTHandler);
