import { findUserByEmail } from "@/lib/db";
import { verifyPassword, createSessionToken, createAuthCookieHeader } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return Response.json(
        { success: false, message: "لطفاً ایمیل و رمز عبور را وارد کنید." },
        { status: 400 }
      );
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return Response.json(
        { success: false, message: "ایمیل یا رمز عبور نامعتبر است." },
        { status: 401 }
      );
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return Response.json(
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

    return Response.json(
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
  } catch (error) {
    console.error("Login error:", error);
    return Response.json(
      { success: false, message: "خطای سیستمی رخ داده است." },
      { status: 500 }
    );
  }
}
