import { createClearAuthCookieHeader } from "@/lib/auth";

export async function POST() {
  return Response.json(
    { success: true, message: "با موفقیت خارج شدید." },
    {
      status: 200,
      headers: {
        "Set-Cookie": createClearAuthCookieHeader(),
      },
    }
  );
}
