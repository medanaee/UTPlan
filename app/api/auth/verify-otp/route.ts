import { apiError, apiResponseJson, withApiTiming } from "@/lib/api-response";
import { isRequestError, readJsonBody } from "@/lib/api-request";
import { createOtpSession, normalizeUtEmail, verifyEmailOtp } from "@/lib/otp";

async function POSTHandler(request: Request) {
  try {
    const body = await readJsonBody(request);
    if (isRequestError(body)) return apiError(body.message, body.status);
    const input = body as Record<string, unknown>;
    const email = normalizeUtEmail(input.email);
    const code = typeof input.code === "string" ? input.code.trim() : "";
    const password = typeof input.password === "string" ? input.password : "";
    if (!email || !/^\d{6}$/.test(code)) return apiError("ایمیل یا کد تأیید نامعتبر است.", 400);
    if (password.length < 6) return apiError("رمز عبور باید حداقل ۶ کاراکتر باشد.", 400);

    const result = await verifyEmailOtp(email, code);
    if (!result.ok) return apiError(result.message, 401);
    const session = await createOtpSession(email, { ...result.record, password });
    if (session?.exists) return apiError("این ایمیل قبلاً ثبت‌نام شده است؛ از ورود استفاده کنید.", 409);
    if (!session) return apiError("برای این ایمیل حسابی وجود ندارد. ابتدا ثبت‌نام را انتخاب کنید.", 404);

    return apiResponseJson(
      { success: true, message: "ورود با موفقیت انجام شد.", user: session.user },
      { headers: { "Set-Cookie": session.cookieHeader } }
    );
  } catch (error) {
    console.error("Verify OTP error:", error);
    return apiError("تأیید کد انجام نشد.", 500);
  }
}

export const POST = withApiTiming(POSTHandler);
