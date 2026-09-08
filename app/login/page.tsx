"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/api-client";
import {
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  ShieldAlert,
  GraduationCap,
  ArrowRight,
  LogIn,
  UserPlus,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === "register") {
      if (!firstName.trim()) {
        setError("لطفاً نام خود را وارد کنید.");
        return;
      }
      if (!lastName.trim()) {
        setError("لطفاً نام خانوادگی خود را وارد کنید.");
        return;
      }
      if (password.length < 6) {
        setError("رمز عبور باید حداقل ۶ کاراکتر باشد.");
        return;
      }
      if (password !== confirmPassword) {
        setError("تکرار رمز عبور با رمز عبور اصلی مطابقت ندارد.");
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        mode === "login"
          ? { email: email.trim().toLowerCase(), password }
          : {
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              name: `${firstName.trim()} ${lastName.trim()}`,
              email: email.trim().toLowerCase(),
              password,
            };

      const data = await postJson(endpoint, payload);

      if (!data.success) {
        setError(data.message || (mode === "login" ? "اطلاعات ورود نامعتبر است." : "خطا در ثبت‌نام"));
        setLoading(false);
        return;
      }

      // Check role and redirect
      if (data.user?.role === "admin" || data.user?.role === "super_admin") {
        router.push("/admin");
      } else {
        router.push("/");
      }
      router.refresh();
    } catch {
      setError("خطایی در برقراری ارتباط رخ داد. لطفاً مجدداً تلاش کنید.");
      setLoading(false);
    }
  };

  const toggleMode = (newMode: "login" | "register") => {
    setMode(newMode);
    setError(null);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-muted/20 p-4 font-sans selection:bg-primary/20">
      <div className="absolute top-4 left-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm space-y-4">
        {/* Header Branding */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xs">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">سامانه انتخاب واحد و چارت درسی</h1>
          <p className="text-xs text-muted-foreground">دانشکده مهندسی برق و کامپیوتر</p>
        </div>

        {/* Compact Auth Card */}
        <Card className="border-border/70 shadow-xs backdrop-blur">
          <CardHeader className="pb-3 text-center">
            <CardTitle className="text-base font-bold">
              {mode === "login" ? "ورود به حساب کاربری" : "ایجاد حساب کاربری جدید"}
            </CardTitle>
            <CardDescription className="text-xs">
              {mode === "login"
                ? "جهت دسترسی به پنل و مدیریت چارت، مشخصات خود را وارد نمایید."
                : "مشخصات خود را جهت ساخت حساب دانشجویی وارد نمایید."}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-3.5">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* First Name and Last Name fields (Only in Register mode) */}
              {mode === "register" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName" className="text-xs font-medium">
                      نام
                    </Label>
                    <Input
                      id="firstName"
                      type="text"
                      placeholder="مثلاً علی"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName" className="text-xs font-medium">
                      نام خانوادگی
                    </Label>
                    <Input
                      id="lastName"
                      type="text"
                      placeholder="مثلاً محمدی"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Email field */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">
                  آدرس ایمیل
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  dir="ltr"
                  icon={<Mail />}
                />
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium">
                  رمز عبور
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="حداقل ۶ کاراکتر"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    dir="ltr"
                    className="pr-8"
                    icon={<Lock />}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2 text-muted-foreground transition-colors hover:text-foreground"
                    title={showPassword ? "مخفی کردن رمز" : "نمایش رمز"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password field (Only in Register mode) */}
              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs font-medium">
                    تکرار رمز عبور
                  </Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="تکرار رمز عبور"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    dir="ltr"
                    icon={<Lock />}
                  />
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full font-semibold shadow-xs"
              >
                {loading
                  ? "در حال پردازش..."
                  : mode === "login"
                  ? "ورود به سیستم"
                  : "ثبت‌نام و ورود به سامانه"}
              </Button>

              {/* Toggle text prompt */}
              <div className="text-center pt-1">
                {mode === "login" ? (
                  <button
                    type="button"
                    onClick={() => toggleMode("register")}
                    className="text-xs text-muted-foreground transition-colors"
                  >
                    حساب کاربری ندارید؟ <span className="font-semibold hover:text-primary">ثبت‌نام کنید</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleMode("login")}
                    className="text-xs text-muted-foreground transition-colors"
                  >
                    قبلاً ثبت‌نام کرده‌اید؟ <span className="font-semibold hover:text-primary">وارد شوید</span>
                  </button>
                )}
              </div>
            </CardContent>
          </form>
        </Card>

        {/* Back Link */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            بازگشت به صفحه اصلی
          </Link>
        </div>
      </div>
    </div>
  );
}
