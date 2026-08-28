"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, Eye, EyeOff, ShieldAlert, GraduationCap, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "اطلاعات ورود نامعتبر است.");
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

        {/* Compact Login Card */}
        <Card className="border-border/70 shadow-xs backdrop-blur">
          <CardHeader className="pb-3 text-center">
            <CardTitle className="text-base font-bold">ورود به حساب کاربری</CardTitle>
            <CardDescription className="text-xs">
              جهت دسترسی به پنل و مدیریت چارت، مشخصات خود را وارد نمایید.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-3.5 pb-5">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Email field */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">
                  آدرس ایمیل
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    dir="ltr"
                    className="h-9 pr-9 pl-3 text-xs"
                  />
                  <Mail className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
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
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    dir="ltr"
                    className="h-9 pr-9 pl-9 text-xs"
                  />
                  <Lock className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-2.5 top-2.5 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="h-9 w-full text-xs font-semibold shadow-xs"
              >
                {loading ? "در حال اعتبارسنجی..." : "ورود به سیستم"}
              </Button>
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
