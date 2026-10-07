import { apiResponseJson, withApiTiming } from "@/lib/api-response";
import { createClearAuthCookieHeader } from "@/lib/auth";

async function POSTHandler() {
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

export const POST = withApiTiming(POSTHandler);
