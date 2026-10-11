"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Users,
  Shield,
  ShieldCheck,
  GraduationCap,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  UserCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserSession } from "@/lib/types";
import { fetchJson, patchJson } from "@/lib/api-client";

interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "admin" | "user";
  facultyId?: string;
  majorId?: string;
  trackId?: string;
  entrySemester?: string;
  avatarUrl?: string;
  createdAt: string;
}

interface UserManagerProps {
  currentUser: UserSession;
}

export function UserManager({ currentUser }: UserManagerProps) {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [roleCounts, setRoleCounts] = useState({ super_admin: 0, admin: 0, user: 0 });
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadUsers = async (requestedPage = page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(requestedPage), pageSize: "20" });
      if (search.trim()) params.set("q", search.trim());
      if (roleFilter !== "all") params.set("role", roleFilter);
      const res = await fetchJson(`/api/admin/users?${params.toString()}`);
      if (res.success && Array.isArray(res.data)) {
        setUsers(res.data);
        setPage(res.pagination?.page || requestedPage);
        setTotalUsers(res.pagination?.total || 0);
        setTotalPages(res.pagination?.totalPages || 0);
        setRoleCounts({
          super_admin: res.stats?.super_admin || 0,
          admin: res.stats?.admin || 0,
          user: res.stats?.user || 0,
        });
      }
    } catch (e) {
      console.error("Load users error:", e);
      setFeedback({ type: "error", message: "خطا در دریافت لیست کاربران." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUsers(page);
    }, search.trim() ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [page, search, roleFilter]);

  const handleRoleChange = async (targetUserId: string, newRole: "super_admin" | "admin" | "user") => {
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await patchJson("/api/admin/users", { userId: targetUserId, role: newRole });

        if (res.success) {
          setFeedback({ type: "success", message: res.message });
          // Optimistically update local list
          setUsers((prev) =>
            prev.map((u) => (u.id === targetUserId ? { ...u, role: newRole } : u))
          );
          setTimeout(() => setFeedback(null), 4000);
        } else {
          setFeedback({ type: "error", message: res.message || "خطا در تغییر نقش کاربر." });
        }
      } catch (e) {
        console.error("Change role error:", e);
        setFeedback({ type: "error", message: "خطایی در برقراری ارتباط رخ داد." });
      }
    });
  };

  const superAdminsCount = roleCounts.super_admin;
  const adminsCount = roleCounts.admin;
  const studentsCount = roleCounts.user;

  return (
    <div className="space-y-4 font-sans">
      {/* Header and Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/70 shadow-xs">
          <CardContent className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] text-muted-foreground">کل کاربران ثبت‌شده</p>
              <p className="text-xl font-bold text-foreground">{totalUsers}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] text-muted-foreground">مدیران ارشد (Super Admin)</p>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {superAdminsCount}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] text-muted-foreground">مدیران سامانه (Admin)</p>
              <p className="text-xl font-bold text-sky-600 dark:text-sky-400">
                {adminsCount}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Shield className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] text-muted-foreground">دانشجویان و کاربران عادی</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {studentsCount}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <GraduationCap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="border-b pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-bold">مدیریت کاربران و تغییر سطوح دسترسی</CardTitle>
              </div>
              <CardDescription className="text-xs">
                مشاهده لیست حساب‌های کاربری فعال، ارتقا به مدیر سامانه یا مدیر کل، و تنظیم نقش‌ها.
              </CardDescription>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadUsers(page)}
              disabled={loading}
              className="h-8 gap-1.5 text-xs shadow-2xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              تازه‌سازی
            </Button>
          </div>
        </CardHeader>

        <CardContent className="px-4 space-y-4">
          {/* Feedback Alert */}
          {feedback && (
            <div
              className={`flex items-center gap-2 rounded-xl border p-3 text-xs ${
                feedback.type === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative">
              <Input
                placeholder="جستجوی نام یا ایمیل..."
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                className="h-8 w-60 text-xs pr-8"
              />
              <Search className="pointer-events-none absolute right-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            </div>

            <Select
              value={roleFilter}
              onValueChange={(val) => {
                if (val) {
                  setPage(1);
                  setRoleFilter(val);
                }
              }}
            >
              <SelectTrigger size="sm" className="h-8 min-w-35 text-xs">
                <SelectValue placeholder="فیلتر نقش..." />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">تمام نقش‌ها</SelectItem>
                  <SelectItem value="super_admin">مدیران ارشد</SelectItem>
                  <SelectItem value="admin">مدیران سامانه</SelectItem>
                  <SelectItem value="user">دانشجویان / کاربران</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                  <th className="py-2.5 px-3 text-right">کاربر</th>
                  <th className="py-2.5 px-3 text-right">آدرس ایمیل</th>
                  <th className="py-2.5 px-3 text-right">نقش فعلی</th>
                  <th className="py-2.5 px-3 text-right">تغییر و ارتقای نقش</th>
                  <th className="py-2.5 px-3 text-right">تاریخ عضویت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {users.map((user) => {
                  const isCurrentLoggedUser = user.id === currentUser.id;
                  const canModifyThisUser =
                    !isCurrentLoggedUser && currentUser.role === "super_admin";

                  return (
                    <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                      {/* Name & Badge */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs overflow-hidden shrink-0 border border-border/40">
                            {user.avatarUrl ? (
                              <img
                                src={user.avatarUrl}
                                alt={user.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span>{user.name?.charAt(0) || "ک"}</span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground">{user.name}</span>
                              {isCurrentLoggedUser && (
                                <Badge variant="secondary" className="text-[9px] h-4 px-1">
                                  شما
                                </Badge>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {user.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-2.5 px-3 text-[11px] text-muted-foreground" dir="ltr">
                        {user.email}
                      </td>

                      {/* Current Role Badge */}
                      <td className="py-2.5 px-3">
                        {user.role === "super_admin" && (
                          <Badge
                            variant="default"
                            className="bg-purple-600 hover:bg-purple-700 text-white gap-1 text-[10px] shadow-2xs"
                          >
                            <Sparkles className="h-2.5 w-2.5" />
                            مدیر ارشد
                          </Badge>
                        )}
                        {user.role === "admin" && (
                          <Badge
                            variant="default"
                            className="bg-sky-600 hover:bg-sky-700 text-white gap-1 text-[10px] shadow-2xs"
                          >
                            <Shield className="h-2.5 w-2.5" />
                            مدیر سامانه
                          </Badge>
                        )}
                        {user.role === "user" && (
                          <Badge variant="outline" className="text-muted-foreground gap-1 text-[10px]">
                            <GraduationCap className="h-2.5 w-2.5" />
                            دانشجو / کاربر
                          </Badge>
                        )}
                      </td>

                      {/* Role Selector */}
                      <td className="py-2.5 px-3">
                        <Select
                          value={user.role}
                          onValueChange={(val) => {
                            if (val && val !== user.role) {
                              handleRoleChange(user.id, val as any);
                            }
                          }}
                          disabled={!canModifyThisUser || isPending}
                        >
                          <SelectTrigger size="sm" className="h-7 w-36 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="min-w-44">
                            <SelectGroup>
                              {currentUser.role === "super_admin" && (
                                <SelectItem value="super_admin" className="text-xs py-1.5">
                                  <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-semibold">
                                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                                    <span>مدیر ارشد</span>
                                  </div>
                                </SelectItem>
                              )}
                              <SelectItem value="admin" className="text-xs py-1.5">
                                <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-semibold">
                                  <Shield className="h-3.5 w-3.5 shrink-0" />
                                  <span>مدیر سامانه</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="user" className="text-xs py-1.5">
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                                  <span>دانشجو / کاربر</span>
                                </div>
                              </SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Created At */}
                      <td className="py-2.5 px-3 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground/70" />
                          <span>
                            {new Date(user.createdAt).toLocaleDateString("fa-IR", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {users.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                      کاربری با این مشخصات یافت نشد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-muted-foreground">
              {totalUsers > 0 ? `${(page - 1) * 20 + 1} تا ${Math.min(page * 20, totalUsers)} از ${totalUsers} کاربر` : "کاربری وجود ندارد"}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5" dir="ltr">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  aria-label="صفحه قبل"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="min-w-16 text-center text-[11px] text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  aria-label="صفحه بعد"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
