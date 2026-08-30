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

interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "admin" | "user";
  facultyId?: string;
  majorId?: string;
  trackId?: string;
  entrySemester?: string;
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
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/users").then((r) => r.json());
      if (res.success && Array.isArray(res.data)) {
        setUsers(res.data);
      }
    } catch (e) {
      console.error("Load users error:", e);
      setFeedback({ type: "error", message: "خطا در دریافت لیست کاربران." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (targetUserId: string, newRole: "super_admin" | "admin" | "user") => {
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: targetUserId, role: newRole }),
        }).then((r) => r.json());

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

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const totalUsers = users.length;
  const superAdminsCount = users.filter((u) => u.role === "super_admin").length;
  const adminsCount = users.filter((u) => u.role === "admin").length;
  const studentsCount = users.filter((u) => u.role === "user").length;

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
              onClick={loadUsers}
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
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-60 text-xs pr-8"
              />
              <Search className="pointer-events-none absolute right-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            </div>

            <Select
              items={[
                { value: "all", label: "تمام نقش‌ها" },
                { value: "super_admin", label: "مدیران ارشد" },
                { value: "admin", label: "مدیران سامانه" },
                { value: "user", label: "دانشجویان / کاربران" },
              ]}
              value={roleFilter}
              onValueChange={(val) => val && setRoleFilter(val)}
            >
              <SelectTrigger size="sm" className="h-8 min-w-[140px] text-xs">
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
                {filteredUsers.map((user) => {
                  const isCurrentLoggedUser = user.id === currentUser.id;
                  const canModifyThisUser =
                    currentUser.role === "super_admin" ||
                    (currentUser.role === "admin" && user.role === "user");

                  return (
                    <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                      {/* Name & Badge */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground font-bold text-xs">
                            {user.name.charAt(0)}
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
                          items={[
                            { value: "super_admin", label: "مدیر ارشد" },
                            { value: "admin", label: "مدیر سامانه" },
                            { value: "user", label: "دانشجو / کاربر" },
                          ]}
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

                {filteredUsers.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                      کاربری با این مشخصات یافت نشد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
