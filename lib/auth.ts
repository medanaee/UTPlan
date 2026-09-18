import { SignJWT, jwtVerify } from "jose";
import type { UserSession } from "./types";

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "cloudflare-workers-edge-auth-secret-key-1234567890"
);

const TOKEN_COOKIE_NAME = "ut_auth_token";
const TOKEN_EXPIRY = "7d";

/**
 * Hash password using Web Crypto API PBKDF2 (Native to Cloudflare Workers / Edge / Node)
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    true,
    ["sign"]
  );

  const exported = await crypto.subtle.exportKey("raw", derivedKey);
  const hashHex = Array.from(new Uint8Array(exported))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${saltHex}:${hashHex}`;
}

/**
 * Verify password against stored PBKDF2 hash
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const [saltHex, originalHash] = storedHash.split(":");
    if (!saltHex || !originalHash) return false;

    const saltMatch = saltHex.match(/.{1,2}/g);
    if (!saltMatch) return false;
    const salt = new Uint8Array(saltMatch.map((byte) => parseInt(byte, 16)));

    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );

    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "HMAC", hash: "SHA-256", length: 256 },
      true,
      ["sign"]
    );

    const exported = await crypto.subtle.exportKey("raw", derivedKey);
    const hashHex = Array.from(new Uint8Array(exported))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return hashHex === originalHash;
  } catch {
    return false;
  }
}

/**
 * Create a signed JWT token for the user session
 */
export async function createSessionToken(user: UserSession): Promise<string> {
  return await new SignJWT({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

/**
 * Verify and decode session token
 */
export async function verifySessionToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      id: payload.sub as string,
      name: payload.name as string,
      email: payload.email as string,
      role: payload.role as "admin" | "user",
    };
  } catch {
    return null;
  }
}

/**
 * Extract token from Request Cookie header
 */
export function getAuthTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${TOKEN_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Generate Set-Cookie header string for auth session
 */
export function createAuthCookieHeader(token: string, maxAge = 60 * 60 * 24 * 7): string {
  return `${TOKEN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

/**
 * Generate Set-Cookie header string to clear auth session
 */
export function createClearAuthCookieHeader(): string {
  return `${TOKEN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/**
 * Require valid authenticated user session (any role: user, admin, super_admin)
 */
export async function requireUserSession(request: Request): Promise<{
  authorized: boolean;
  user?: UserSession;
  response?: Response;
}> {
  const token = getAuthTokenFromRequest(request);
  if (!token) {
    return {
      authorized: false,
      response: Response.json(
        { success: false, message: "احراز هویت نشده‌اید. لطفاً وارد حساب کاربری شوید." },
        { status: 401 }
      ),
    };
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return {
      authorized: false,
      response: Response.json(
        { success: false, message: "نشست کاربری نامعتبر یا منقضی شده است." },
        { status: 401 }
      ),
    };
  }

  return {
    authorized: true,
    user: session,
  };
}

/**
 * Require valid Admin or Super Admin session with Live Database Check
 */
export async function requireAdminSession(request: Request): Promise<{
  authorized: boolean;
  user?: UserSession;
  response?: Response;
}> {
  const token = getAuthTokenFromRequest(request);
  if (!token) {
    return {
      authorized: false,
      response: Response.json(
        { success: false, message: "احراز هویت نشده‌اید." },
        { status: 401 }
      ),
    };
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return {
      authorized: false,
      response: Response.json(
        { success: false, message: "نشست کاربری نامعتبر است." },
        { status: 401 }
      ),
    };
  }

  // Dynamic import to avoid circular dependencies if any
  const { findUserById } = await import("./db");
  const liveUser = await findUserById(session.id);
  if (!liveUser || (liveUser.role !== "admin" && liveUser.role !== "super_admin")) {
    return {
      authorized: false,
      response: Response.json(
        { success: false, message: "دسترسی غیرمجاز. فقط مدیران مجاز هستند." },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    user: {
      id: liveUser.id,
      name: liveUser.name,
      email: liveUser.email,
      role: liveUser.role,
    },
  };
}
