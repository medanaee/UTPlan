import { apiError, apiResponseJson, withApiTiming } from "@/lib/api-response";
import { findUserByEmail } from "@/lib/db";
import { verifyPassword, createSessionToken, createAuthCookieHeader } from "@/lib/auth";

async function POSTHandler(request: Request) {
  try {
    return apiError("ورود با رمز عبور غیرفعال است؛ از ورود با کد تأیید ایمیل استفاده کنید.", 410);
    /* Legacy password flow intentionally disabled after OTP migration. */
    /* istanbul ignore next */
    if (false) {
    const body: any = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return apiResponseJson(
        { success: false, message: "لطفاً ایمیل و رمز عبور را وارد کنید." },
        { status: 400 }
      );
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return apiResponseJson(
        { success: false, message: "ایمیل یا رمز عبور نامعتبر است." },
        { status: 401 }
      );
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return apiResponseJson(
        { success: false, message: "ایمیل یا رمز عبور نامعتبر است." },
        { status: 401 }
      );
    }

    const sessionPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const token = await createSessionToken(sessionPayload);
    const cookieHeader = createAuthCookieHeader(token);

    return apiResponseJson(
      {
        success: true,
        message: "ورود با موفقیت انجام شد.",
        user: sessionPayload,
      },
      {
        status: 200,
        headers: {
          "Set-Cookie": cookieHeader,
        },
      }
    );
    }
  } catch (error) {
    console.error("Login error:", error);
    return apiResponseJson(
      { success: false, message: "خطای سیستمی رخ داده است." },
      { status: 500 }
    );
  }
}

export const POST = withApiTiming(POSTHandler);
