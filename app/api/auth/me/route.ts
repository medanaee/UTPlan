import { getAuthTokenFromRequest, verifySessionToken } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const token = getAuthTokenFromRequest(request);
    if (!token) {
      return Response.json({ authenticated: false, user: null }, { status: 401 });
    }

    const user = await verifySessionToken(token);
    if (!user) {
      return Response.json({ authenticated: false, user: null }, { status: 401 });
    }

    return Response.json({
      authenticated: true,
      user,
    });
  } catch (error) {
    console.error("Auth me error:", error);
    return Response.json({ authenticated: false, user: null }, { status: 500 });
  }
}
