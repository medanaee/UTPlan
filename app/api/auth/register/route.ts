import { findUserByEmail, createUser } from "@/lib/db";
import { hashPassword, createSessionToken, createAuthCookieHeader } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, role } = body as {
      name?: string;
      email?: string;
      password?: string;
      role?: "admin" | "user";
    };

    if (!name || !email || !password) {
      return Response.json(
        { success: false, message: "لطفاً تمام فیلدهای الزامی را تکمیل کنید." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return Response.json(
        { success: false, message: "رمز عبور باید حداقل ۶ کاراکتر باشد." },
        { status: 400 }
      );
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return Response.json(
        { success: false, message: "این ایمیل قبلاً در سیستم ثبت شده است." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const userRole = role === "admin" ? "admin" : "user";

    const newUser = await createUser({
      name,
      email,
      passwordHash,
      role: userRole,
    });

    const sessionPayload = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    };

    const token = await createSessionToken(sessionPayload);
    const cookieHeader = createAuthCookieHeader(token);

    return Response.json(
      {
        success: true,
        message: "حساب کاربری با موفقیت ایجاد شد.",
        user: sessionPayload,
      },
      {
        status: 201,
        headers: {
          "Set-Cookie": cookieHeader,
        },
      }
    );
  } catch (error) {
    console.error("Register error:", error);
    return Response.json(
      { success: false, message: "خطایی در ثبت‌نام رخ داد." },
      { status: 500 }
    );
  }
}
