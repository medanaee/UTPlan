"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/api-client";
import { Mail, ShieldAlert, GraduationCap, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function OtpAuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@ut\.ac\.ir$/.test(normalizedEmail)) return setError("فقط ایمیل دانشگاه تهران با دامنهٔ @ut.ac.ir مجاز است.");
    if (!otpSent && mode === "login" && !password) return setError("رمز عبور را وارد کنید.");
    if (!otpSent && mode === "register" && (!firstName.trim() || !lastName.trim())) return setError("نام و نام خانوادگی را وارد کنید.");
    if (otpSent && !/^\d{6}$/.test(otp.trim())) return setError("کد تأیید باید ۶ رقم باشد.");
    if (otpSent && password.length < 6) return setError("رمز عبور باید حداقل ۶ کاراکتر باشد.");
    if (otpSent && password !== confirmPassword) return setError("تکرار رمز عبور مطابقت ندارد.");

    setLoading(true);
    try {
      const endpoint = otpSent ? "/api/auth/verify-otp" : mode === "login" ? "/api/auth/login" : "/api/auth/request-otp";
      const requestEndpoint = !otpSent && mode === "register" ? `${endpoint}?t=${Date.now()}` : endpoint;
      const data = await postJson(
        requestEndpoint,
        otpSent ? { email: normalizedEmail, code: otp.trim(), password } : mode === "login"
          ? { email: normalizedEmail, password }
          : { email: normalizedEmail, mode, firstName: firstName.trim(), lastName: lastName.trim() }
      );
      if (!data.success) return setError(data.message || "عملیات انجام نشد.");
      if (!otpSent && mode === "register") return setOtpSent(true);
      router.push(data.user?.role === "admin" || data.user?.role === "super_admin" ? "/admin" : "/");
      router.refresh();
    } catch {
      setError("خطایی در برقراری ارتباط رخ داد. لطفاً دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  };

  return <div className="relative flex min-h-screen items-center justify-center bg-muted/20 p-4 font-sans">
    <div className="absolute left-4 top-4"><ThemeToggle /></div>
    <div className="w-full max-w-sm space-y-4">
      <div className="flex flex-col items-center gap-1.5 text-center"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><GraduationCap className="h-6 w-6" /></div><h1 className="text-xl font-bold tracking-tight">سامانه انتخاب واحد و چارت درسی</h1><p className="text-xs text-muted-foreground">دانشکده مهندسی برق و کامپیوتر</p></div>
      <Card className="border-border/70 shadow-xs backdrop-blur"><CardHeader className="pb-3 text-center"><CardTitle className="text-base font-bold">{mode === "login" ? "ورود به حساب کاربری" : "ایجاد حساب کاربری"}</CardTitle><CardDescription className="text-xs">{otpSent ? "کد ۶ رقمی ارسال‌شده به ایمیل دانشگاهی خود را وارد کنید." : "ورود و ثبت‌نام فقط با ایمیل دانشگاه تهران انجام می‌شود."}</CardDescription></CardHeader>
        <form onSubmit={handleSubmit}><CardContent className="space-y-3.5">
          {error && <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive"><ShieldAlert className="h-4 w-4 shrink-0" /><span>{error}</span></div>}
          {!otpSent && mode === "register" && <div className="grid grid-cols-2 gap-2"><div className="space-y-1.5"><Label htmlFor="firstName">نام</Label><Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></div><div className="space-y-1.5"><Label htmlFor="lastName">نام خانوادگی</Label><Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required /></div></div>}
          <div className="space-y-1.5"><Label htmlFor="email">ایمیل دانشگاهی</Label><Input id="email" type="email" placeholder="name@ut.ac.ir" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" icon={<Mail />} disabled={otpSent} /></div>
          {!otpSent && mode === "login" && <div className="space-y-1.5"><Label htmlFor="password">رمز عبور</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required dir="ltr" /></div>}
          {otpSent && <div className="space-y-1.5"><Label htmlFor="otp">کد تأیید</Label><Input id="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} required dir="ltr" /></div>}
          {otpSent && <div className="space-y-1.5"><Label htmlFor="registerPassword">رمز عبور جدید</Label><Input id="registerPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} dir="ltr" /></div>}
          {otpSent && <div className="space-y-1.5"><Label htmlFor="confirmPassword">تکرار رمز عبور</Label><Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} dir="ltr" /></div>}
          <Button type="submit" disabled={loading} className="w-full font-semibold">{loading ? "در حال پردازش..." : otpSent ? "تکمیل ثبت‌نام" : mode === "login" ? "ورود" : "ارسال کد ثبت‌نام"}</Button>
          {otpSent && <button type="button" onClick={() => { setOtpSent(false); setOtp(""); setPassword(""); setConfirmPassword(""); setError(null); }} className="w-full text-xs text-muted-foreground hover:text-primary">تغییر ایمیل یا ارسال دوباره</button>}
          {!otpSent && <div className="pt-1 text-center"><button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }} className="text-xs text-muted-foreground hover:text-primary">{mode === "login" ? "حساب کاربری ندارید؟ ثبت‌نام کنید" : "قبلاً ثبت‌نام کرده‌اید؟ وارد شوید"}</button></div>}
        </CardContent></form>
      </Card>
      <div className="text-center"><Link href="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><ArrowRight className="h-3.5 w-3.5" />بازگشت به صفحه اصلی</Link></div>
    </div>
  </div>;
}
