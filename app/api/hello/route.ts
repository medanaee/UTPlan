import { apiResponse } from "@/lib/api-response";

export function GET() {
  return apiResponse(
    { message: "Hello from vinext on Cloudflare Workers" },
    { message: "OK" }
  );
}
