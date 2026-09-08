"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { fetchJson, postJson } from "@/lib/api-client";
import {
  GraduationCap,
  LogIn,
  LogOut,
  LayoutDashboard,
  Calendar,
  BookOpen,
  Users,
  Sparkles,
  Search,
  Layers,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import type { UserSession } from "@/lib/types";

interface NavbarProps {
  user?: UserSession | null;
}

export function Navbar({ user: initialUser }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserSession | null>(initialUser || null);
  const [loading, setLoading] = useState(!initialUser);

  useEffect(() => {
    async function fetchSession() {
      try {
        const data = await fetchJson("/api/auth/me");
        if (data.authenticated) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Session fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    if (!initialUser) {
      fetchSession();
    }
  }, [initialUser]);

  const handleLogout = async () => {
    try {
      await postJson("/api/auth/logout");
      setUser(null);
      router.push("/");
      router.refresh();
    } catch {
      setUser(null);
    }
  };

  const navLinks = [
    { href: "/", label: "خانه", icon: GraduationCap },
    { href: "/charts", label: "چارت‌ها", icon: Calendar },
    { href: "/professors", label: "جستجوی اساتید", icon: Users },
    {
      href: "/courses",
      label: "جستجوی دروس",
      subtitle: "اطلاعات و پیش‌نیازها",
      icon: BookOpen,
    },
    {
      href: "/offerings",
      label: "جستجوی ارائه‌های درسی",
      subtitle: "اساتید و نظرات",
      icon: Layers,
    },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur">
      <div className="mx-auto flex items-center justify-between px-4 py-2.5 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight">سامانه انتخاب واحد</span>
              <p className="text-[10px] text-muted-foreground">دانشکده مهندسی برق و کامپیوتر</p>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 text-xs font-medium">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-2.5 py-1.5 transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? "text-primary bg-primary/10 font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Auth Actions / User Profile */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-muted" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/profile"
                className="flex items-center gap-2 px-1 h-8 rounded-md hover:bg-muted/50 transition-colors"
                title="مشاهده و ویرایش پروفایل تحصیلی"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs overflow-hidden border border-border/80 shadow-2xs">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </div>

                <div className="text-left hidden sm:block">
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="text-xs font-bold">{user.name}</span>
                    <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5">
                      {user.role === "super_admin" || user.role === "admin" ? "مدیر سیستم" : "دانشجو"}
                    </Badge>
                  </div>
                </div>
              </Link>

              {(user.role === "admin" || user.role === "super_admin") && (
                <Link href="/admin">
                  <Button size="sm" variant="default" className="h-8 gap-1 text-xs shadow-xs font-semibold">
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    پنل مدیریت
                  </Button>
                </Link>
              )}

              <Button
                variant="outline"
                onClick={handleLogout}
                className="h-8 gap-1 text-xs border-border/80 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
              >
                <LogOut className="h-3.5 w-3.5" />
                خروج
              </Button>
            </div>
          ) : (
            <Link href="/login">
              <Button className="h-8 gap-1 text-xs font-semibold shadow-xs">
                <LogIn className="h-3.5 w-3.5" />
                ورود / ثبت‌نام
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile/Tablet Secondary Nav Scrollbar */}
      <div className="flex lg:hidden border-t border-border/40 overflow-x-auto px-4 py-1.5 gap-1 text-xs scrollbar-none">
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-2 py-1 shrink-0 whitespace-nowrap text-[11px] transition-colors ${
                isActive
                  ? "text-primary bg-primary/10 font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
