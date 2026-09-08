"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api-client";
import {
  GraduationCap,
  LogIn,
  LogOut,
  LayoutDashboard,
  Calendar,
  BookOpen,
  Users,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  Search,
  Network,
  Clock,
  Award,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Navbar } from "@/components/navbar";
import type { UserSession } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSession() {
      try {
        const data = await fetchJson("/api/auth/me");
        if (data.authenticated) {
          setUser(data.user);
        }
      } catch (err) {
        console.error("Session fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchSession();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      {/* Top Shared Navbar */}
      <Navbar user={user} />

      {/* ========================================================================= */}
      {/* HERO SECTION */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden border-b border-border/60 bg-muted/20 py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center space-y-5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary shadow-2xs">
            سامانه هوشمند برنامه‌ریزی تحصیلی و انتخاب واحد
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl text-foreground leading-tight">
            برنامه‌ریزی دقیق چارت درسی
            <br />
            <span className="text-primary">بدون تداخل زمانی و امتحانی</span>
          </h1>

          <p className="mx-auto max-w-2xl text-xs sm:text-sm text-muted-foreground leading-relaxed">
            مسیر تحصیلی خود را با مشاهده گراف پیش‌نیازها و هم‌نیازها بچینید، برنامه هفتگی دانشگاه را روی تقویم
            بصری تنظیم کنید و نظرات دانشجویان درباره اساتید و دروس را پیش از انتخاب واحد بخوانید.
          </p>

          {/* Call to Actions */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {user ? (
              user.role === "admin" || user.role === "super_admin" ? (
                <Link href="/admin">
                  <Button size="lg" className="h-10 gap-2 text-xs font-bold shadow-sm">
                    <LayoutDashboard className="h-4 w-4" />
                    ورود به پنل مدیریت دانشگاه
                  </Button>
                </Link>
              ) : (
                <Button size="lg" className="h-10 gap-2 text-xs font-bold shadow-sm" disabled>
                  <Calendar className="h-4 w-4" />
                  خوش آمدید، {user.name}
                </Button>
              )
            ) : (
              <Link href="/login">
                <Button size="lg" className="h-10 gap-2 text-xs font-bold shadow-sm">
                  <LogIn className="h-4 w-4" />
                  ورود به سیستم و شروع برنامه‌ریزی
                </Button>
              </Link>
            )}

            {user?.role === "admin" || user?.role === "super_admin" ? (
              <Link href="/admin">
                <Button variant="outline" size="lg" className="h-10 gap-2 text-xs">
                  <BookOpen className="h-4 w-4" />
                  مدیریت دروس و پیش‌نیازها
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button variant="outline" size="lg" className="h-10 gap-2 text-xs">
                  <Search className="h-4 w-4" />
                  مشاهده بانک دروس و اساتید
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* CORE FEATURES SECTION */}
      {/* ========================================================================= */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 space-y-8">
        <div className="text-center space-y-1.5">
          <h2 className="text-lg sm:text-xl font-bold">امکانات کلیدی سامانه</h2>
          <p className="text-xs text-muted-foreground">
            ابزارهای طراحی‌شده برای تسهیل فرآیند انتخاب واحد و ارتقای کیفیت تصمیم‌گیری تحصیلی
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Feature 1 */}
          <Card className="border-border/70 bg-card p-5 shadow-2xs hover:border-primary/40 transition-colors">
            <div className="flex flex-col gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600">
                <Network className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">چارت تعاملی با فلش‌های پیش‌نیاز</h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  چیدن دروس در ترم‌های ۱ تا ۸ با درگ اند دراپ، نمایش گراف هوشمند پیش‌نیازها و هم‌نیازها و بارگذاری
                  چارت مصوب دانشگاه با یک کلیک.
                </p>
              </div>
            </div>
          </Card>

          {/* Feature 2 */}
          <Card className="border-border/70 bg-card p-5 shadow-2xs hover:border-primary/40 transition-colors">
            <div className="flex flex-col gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">تقویم هفتگی و پایش تداخلات</h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  قرار دادن رویدادهای کلاسی در تقویم شنبه تا چهارشنبه، هشدار آنی تداخل کلاس‌ها و بررسی ساعت و روز
                  امتحانات پایان‌ترم.
                </p>
              </div>
            </div>
          </Card>

          {/* Feature 3 */}
          <Card className="border-border/70 bg-card p-5 shadow-2xs hover:border-primary/40 transition-colors">
            <div className="flex flex-col gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">دانشنامه و نظرات اساتید و ارائه‌ها</h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  مشاهده سوابق تدریس اساتید، امتیازدهی به معیارهای آموزشی و خواندن تجربیات واقعی دانشجویان ترم‌های
                  گذشته به صورت آزاد یا ناشناس.
                </p>
              </div>
            </div>
          </Card>

          {/* Feature 4 */}
          <Card className="border-border/70 bg-card p-5 shadow-2xs hover:border-primary/40 transition-colors">
            <div className="flex flex-col gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">موتور اعتبارسنجی قوانین و شروط</h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  بررسی خودکار شروط فارغ‌التحصیلی گرایش، حداقل و حداکثر واحد هر ترم و اطمینان از پاس شدن پیش‌نیازهای
                  هر درس قبل از اخذ.
                </p>
              </div>
            </div>
          </Card>

          {/* Feature 5 */}
          <Card className="border-border/70 bg-card p-5 shadow-2xs hover:border-primary/40 transition-colors">
            <div className="flex flex-col gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">تعریف رویدادهای محلی شخصی</h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  امکان تعریف دستی کلاس‌های خاص یا جلسات حل‌تمرین توسط دانشجو و امکان ارتقای آن به رویداد عمومی توسط
                  مدیران سیستم.
                </p>
              </div>
            </div>
          </Card>

          {/* Feature 6 */}
          <Card className="border-border/70 bg-card p-5 shadow-2xs hover:border-primary/40 transition-colors">
            <div className="flex flex-col gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">پشتیبانی چندرشته‌ای و چندگرایشی</h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  پشتیبانی کامل از سرفصل‌های دانشگاه تهران برای گرایش‌های مختلف نرم‌افزار، هوش مصنوعی، سخت‌افزار و
                  مهندسی پزشکی.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* FOOTER */}
      {/* ========================================================================= */}
      <footer className="border-t border-border/60 bg-muted/10 py-6 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-5xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} سامانه انتخاب واحد و مدیریت چارت درسی دانشکده فنی</p>
          <div className="flex items-center gap-4 text-[11px]">
            <span>طراحی‌شده برای دانشجویان و اساتید دانشگاه</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
