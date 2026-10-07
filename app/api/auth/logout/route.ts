import { apiResponseJson } from "@/lib/api-response";
import { createClearAuthCookieHeader } from "@/lib/auth";

export async function POST() {
  return apiResponseJson(
    { success: true, message: "با موفقیت خارج شدید." },
    {
      status: 200,
      headers: {
        "Set-Cookie": createClearAuthCookieHeader(),
      },
    }
  );
}
