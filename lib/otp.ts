import { findUserByEmail, createUser, getLatestEmailOtp, incrementEmailOtpAttempts, consumeEmailOtp, saveEmailOtp } from "@/lib/db";
import { createAuthCookieHeader, createSessionToken } from "@/lib/auth";

export const UT_EMAIL_PATTERN = /^[^\s@]+@ut\.ac\.ir$/i;
export const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const resendBuckets = new Map<string, number>();
const registrationLocks = new Set<string>();

export function normalizeUtEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return UT_EMAIL_PATTERN.test(email) ? email : null;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function generateOtp() {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
}

export function canRequestOtp(key: string) {
  const now = Date.now();
  const nextAllowedAt = resendBuckets.get(key) || 0;
  if (nextAllowedAt > now) return { allowed: false, retryAfterSeconds: Math.ceil((nextAllowedAt - now) / 1000) };
  resendBuckets.set(key, now + 60_000);
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function issueEmailOtp(data: {
  email: string;
  firstName?: string;
  lastName?: string;
  mode: "login" | "register";
}) {
  const code = generateOtp();
  await saveEmailOtp({
    ...data,
    codeHash: await sha256(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  });
  return code;
}

export async function verifyEmailOtp(email: string, code: string) {
  const record: any = await getLatestEmailOtp(email);
  if (!record) return { ok: false as const, message: "کد تأیید معتبر نیست یا منقضی شده است." };
  if (new Date(record.expires_at).getTime() <= Date.now()) return { ok: false as const, message: "کد تأیید منقضی شده است." };
  if (Number(record.attempts) >= MAX_ATTEMPTS) return { ok: false as const, message: "تعداد تلاش‌های مجاز تمام شده است." };
  if ((await sha256(code)) !== record.code_hash) {
    await incrementEmailOtpAttempts(record.id);
    return { ok: false as const, message: "کد تأیید نادرست است." };
  }
  return { ok: true as const, record };
}

export async function createOtpSession(email: string, record: any) {
  const isRegistration = record.mode === "register";
  if (isRegistration) {
    if (registrationLocks.has(email)) return { exists: true as const };
    registrationLocks.add(email);
  }

  try {
    let user = await findUserByEmail(email);
    if (isRegistration && user) return { exists: true as const };
    if (!user && isRegistration && typeof record.password === "string") {
      try {
        user = await createUser({
          firstName: record.first_name || "",
          lastName: record.last_name || "",
          name: [record.first_name, record.last_name].filter(Boolean).join(" ") || email.split("@")[0],
          email,
          passwordHash: await import("@/lib/auth").then(({ hashPassword }) => hashPassword(record.password)),
          role: "user",
        });
      } catch (error) {
        if (await findUserByEmail(email)) return { exists: true as const };
        throw error;
      }
    }
    if (!user) return null;
    const sessionPayload = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = await createSessionToken(sessionPayload);
    return { exists: false as const, user: sessionPayload, cookieHeader: createAuthCookieHeader(token) };
  } finally {
    if (isRegistration) registrationLocks.delete(email);
  }
}

export async function sendResendEmail(params: { to: string; code: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  const from = process.env.RESEND_FROM_EMAIL || "UTPlan <no-reply@utplan.ir>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: "کد تأیید ورود به UTPlan",
      text: `کد تأیید شما: ${params.code}\nاین کد تا ۱۰ دقیقه معتبر است.`,
      html: `<div dir="rtl"><p>کد تأیید ورود به UTPlan:</p><strong style="font-size:28px;letter-spacing:8px">${params.code}</strong><p>این کد تا ۱۰ دقیقه معتبر است.</p></div>`,
    }),
  });
  if (!response.ok) throw new Error(`Resend request failed: ${response.status}`);
}
