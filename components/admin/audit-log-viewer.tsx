"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Clock,
  Filter,
  Eye,
  Copy,
  Check,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  FileText,
  User,
  Activity,
  Layers,
  Calendar,
  Sparkles,
  Info,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { AuditLog, AuditActionType, AuditEntityType } from "@/lib/types";
import { fetchJson } from "@/lib/api-client";

// Mapping Action Types to Persian Labels and Styles
const ACTION_CONFIG: Record<
  AuditActionType,
  { label: string; badgeClass: string; dotClass: string }
> = {
  CREATE: {
    label: "ایجاد",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    dotClass: "bg-emerald-500",
  },
  UPDATE: {
    label: "ویرایش",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    dotClass: "bg-blue-500",
  },
  DELETE: {
    label: "حذف",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
    dotClass: "bg-rose-500",
  },
  RESTORE: {
    label: "بازیابی",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    dotClass: "bg-purple-500",
  },
  ROLE_CHANGE: {
    label: "تغییر سطح دسترسی",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    dotClass: "bg-amber-500",
  },
  IMPORT: {
    label: "ورود دسته‌ای داده",
    badgeClass: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
    dotClass: "bg-cyan-500",
  },
  BACKUP_RESTORE: {
    label: "بازیابی فایل بکاپ",
    badgeClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30",
    dotClass: "bg-violet-500",
  },
};

// Mapping Entity Types to Persian Labels
const ENTITY_CONFIG: Record<AuditEntityType, { label: string; icon: any }> = {
  course: { label: "درس", icon: Layers },
  professor: { label: "استاد", icon: User },
  offering: { label: "ارائه درسی", icon: Activity },
  event: { label: "رویداد / برنامه کلاسی", icon: Calendar },
  faculty: { label: "دانشکده", icon: Layers },
  major: { label: "رشته", icon: Layers },
  track: { label: "گرایش", icon: Layers },
  category: { label: "دسته‌بندی", icon: Layers },
  rule: { label: "قوانین آموزشی", icon: Sparkles },
  user: { label: "کاربر و دسترسی", icon: User },
  trash: { label: "سطل بازیافت", icon: Activity },
  backup: { label: "پایگاه داده / بکاپ", icon: Activity },
};

function formatRelativeTime(dateString: string): string {
  try {
    const now = new Date();
    const date = new Date(dateString);
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return "چند لحظه پیش";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} دقیقه پیش`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} ساعت پیش`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} روز پیش`;

    return date.toLocaleDateString("fa-IR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

function formatFullDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return dateString;
  }
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [selectedEntity, setSelectedEntity] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [activeLogModal, setActiveLogModal] = useState<AuditLog | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Search debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      queryParams.set("page", page.toString());
      queryParams.set("limit", limit.toString());

      if (debouncedSearch.trim()) {
        queryParams.set("search", debouncedSearch.trim());
      }
      if (selectedAction !== "all") {
        queryParams.set("action", selectedAction);
      }
      if (selectedEntity !== "all") {
        queryParams.set("entityType", selectedEntity);
      }

      const res = await fetchJson(`/api/admin/audit-logs?${queryParams.toString()}`);
      if (res.success && Array.isArray(res.data)) {
        setLogs(res.data);
        if (res.pagination) {
          setTotal(res.pagination.total);
          setTotalPages(res.pagination.totalPages || 1);
        }
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, selectedAction, selectedEntity]);

  useEffect(() => {
    startTransition(() => {
      loadLogs();
    });
  }, [loadLogs]);

  const handleCopyDetails = () => {
    if (!activeLogModal?.details) return;
    navigator.clipboard.writeText(activeLogModal.details);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Prettify details string
  const renderDetailsFormatted = (detailsStr?: string | null) => {
    if (!detailsStr) {
      return <div className="text-xs text-muted-foreground">اطلاعات تکمیلی ثبت نشده است.</div>;
    }
    try {
      const parsed = JSON.parse(detailsStr);
      return (
        <pre className="text-[11px] font-mono bg-muted/60 p-3.5 rounded-lg border border-border overflow-x-auto whitespace-pre-wrap leading-relaxed dir-ltr text-left">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch {
      return (
        <div className="text-xs font-mono bg-muted/60 p-3.5 rounded-lg border border-border whitespace-pre-wrap">
          {detailsStr}
        </div>
      );
    }
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header Card */}
      <Card className="border border-border/70 shadow-2xs bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <span>گزارش اقدامات و رویدادهای مدیران (Audit Log)</span>
                  <Badge variant="outline" className="text-[10px] h-4.5 px-2 font-normal border-purple-500/30 text-purple-600 dark:text-purple-400">
                    مختص مدیر ارشد
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  رهگیری شفاف و بلادرنگ کلیه عملیات‌های سیستمی، ایجاد، ویرایش، حذف، انتسابات و تغییرات دسترسی
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadLogs()}
                disabled={loading || isPending}
                className="gap-1.5 text-xs h-8"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>بروزرسانی</span>
              </Button>
            </div>
          </div>

          {/* Quick Stats Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-border/50">
            <div className="flex flex-col p-2.5 rounded-lg bg-muted/40 border border-border/50">
              <span className="text-[11px] text-muted-foreground">کل وقایع ثبت‌شده</span>
              <span className="text-lg font-bold text-foreground mt-0.5">{total.toLocaleString("fa-IR")}</span>
            </div>
            <div className="flex flex-col p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400">حالت ثبت</span>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mt-1 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                غیرمسدودکننده و خودکار
              </span>
            </div>
            <div className="flex flex-col p-2.5 rounded-lg bg-muted/40 border border-border/50">
              <span className="text-[11px] text-muted-foreground">صفحه جاری</span>
              <span className="text-xs font-semibold text-foreground mt-1">
                صفحه {page.toLocaleString("fa-IR")} از {totalPages.toLocaleString("fa-IR")}
              </span>
            </div>
            <div className="flex flex-col p-2.5 rounded-lg bg-muted/40 border border-border/50">
              <span className="text-[11px] text-muted-foreground">سطح امنیت</span>
              <span className="text-xs font-semibold text-foreground mt-1 flex items-center gap-1">
                <span>تایید هویت بلادرنگ DB</span>
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filters & Search Toolbar */}
      <Card className="border border-border/70 shadow-2xs bg-card">
        <CardContent className="p-3.5">
          <div className="flex flex-col md:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="جستجو بر اساس نام مدیر، ایمیل، شناسه یا نام موجودیت..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9 h-8 text-xs bg-background"
              />
            </div>

            {/* Action Type Filter */}
            <div className="w-full md:w-52">
              <Select
                value={selectedAction}
                onValueChange={(val) => {
                  setSelectedAction(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Filter className="h-3 w-3" />
                    <span>نوع عملیات:</span>
                  </div>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all" className="text-xs">همه عملیات‌ها</SelectItem>
                    <SelectItem value="CREATE" className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">ایجاد (CREATE)</SelectItem>
                    <SelectItem value="UPDATE" className="text-xs text-blue-600 dark:text-blue-400 font-medium">ویرایش (UPDATE)</SelectItem>
                    <SelectItem value="DELETE" className="text-xs text-rose-600 dark:text-rose-400 font-medium">حذف (DELETE)</SelectItem>
                    <SelectItem value="RESTORE" className="text-xs text-purple-600 dark:text-purple-400 font-medium">بازیابی (RESTORE)</SelectItem>
                    <SelectItem value="ROLE_CHANGE" className="text-xs text-amber-600 dark:text-amber-400 font-medium">تغییر دسترسی (ROLE_CHANGE)</SelectItem>
                    <SelectItem value="IMPORT" className="text-xs text-cyan-600 dark:text-cyan-400 font-medium">ورود داده (IMPORT)</SelectItem>
                    <SelectItem value="BACKUP_RESTORE" className="text-xs text-violet-600 dark:text-violet-400 font-medium">بازیابی بکاپ</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Entity Type Filter */}
            <div className="w-full md:w-48">
              <Select
                value={selectedEntity}
                onValueChange={(val) => {
                  setSelectedEntity(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Layers className="h-3 w-3" />
                    <span>بخش:</span>
                  </div>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all" className="text-xs">همه بخش‌ها</SelectItem>
                    <SelectItem value="course" className="text-xs">دروس</SelectItem>
                    <SelectItem value="professor" className="text-xs">اساتید</SelectItem>
                    <SelectItem value="offering" className="text-xs">ارائه‌های درسی</SelectItem>
                    <SelectItem value="event" className="text-xs">رویدادها و برنامه هفتگی</SelectItem>
                    <SelectItem value="track" className="text-xs">گرایش‌ها و ساختار</SelectItem>
                    <SelectItem value="category" className="text-xs">دسته‌بندی‌ها</SelectItem>
                    <SelectItem value="rule" className="text-xs">قوانین و درخت قوانین</SelectItem>
                    <SelectItem value="user" className="text-xs">کاربران و سطوح دسترسی</SelectItem>
                    <SelectItem value="trash" className="text-xs">سطل بازیافت</SelectItem>
                    <SelectItem value="backup" className="text-xs">بکاپ</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Limit Selector */}
            <div className="w-full md:w-32">
              <Select
                value={limit.toString()}
                onValueChange={(val) => {
                  setLimit(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <span className="text-muted-foreground text-[11px]">نمایش:</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="15" className="text-xs">۱۵ مورد</SelectItem>
                    <SelectItem value="25" className="text-xs">۲۵ مورد</SelectItem>
                    <SelectItem value="50" className="text-xs">۵۰ مورد</SelectItem>
                    <SelectItem value="100" className="text-xs">۱۰۰ مورد</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card className="border border-border/70 shadow-2xs overflow-hidden bg-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-muted/60 text-muted-foreground border-b border-border text-[11px] font-semibold">
                <tr>
                  <th className="py-3 px-3.5 w-40">زمان و تاریخ</th>
                  <th className="py-3 px-3.5 w-52">مجری اقدام (مدیر)</th>
                  <th className="py-3 px-3.5 w-32">نوع عملیات</th>
                  <th className="py-3 px-3.5 w-36">بخش / موجودیت</th>
                  <th className="py-3 px-3.5">عنوان / شناسه هدف</th>
                  <th className="py-3 px-3.5 w-24 text-center">جزئیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-xs text-muted-foreground">در حال بارگذاری وقایع سامانه...</span>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileText className="h-8 w-8 text-muted-foreground/40" />
                        <span className="text-sm font-medium">هیچ گزارشی با این فیلترها یافت نشد.</span>
                        <span className="text-[11px]">با تغییر عبارت جستجو یا فیلترها دوباره امتحان کنید.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const actionInfo = ACTION_CONFIG[log.action] || {
                      label: log.action,
                      badgeClass: "bg-muted text-muted-foreground",
                      dotClass: "bg-muted-foreground",
                    };
                    const entityInfo = ENTITY_CONFIG[log.entityType] || {
                      label: log.entityType,
                      icon: Layers,
                    };
                    const EntityIcon = entityInfo.icon;

                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-muted/30 transition-colors group"
                      >
                        {/* Timestamp */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-foreground text-xs">
                              {formatRelativeTime(log.createdAt)}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {new Date(log.createdAt).toLocaleTimeString("fa-IR", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                          </div>
                        </td>

                        {/* Admin User */}
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                              {log.userName?.[0] || "U"}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-foreground truncate max-w-44 text-xs">
                                {log.userName}
                              </span>
                              <span className="text-[10px] text-muted-foreground truncate max-w-44 font-mono">
                                {log.userEmail}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Action Badge */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${actionInfo.badgeClass}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${actionInfo.dotClass}`} />
                            {actionInfo.label}
                          </span>
                        </td>

                        {/* Entity Type */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-foreground/80 font-medium">
                            <EntityIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{entityInfo.label}</span>
                          </div>
                        </td>

                        {/* Entity Name & ID */}
                        <td className="py-3 px-3.5">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-foreground truncate max-w-md">
                              {log.entityName || "بدون عنوان"}
                            </span>
                            {log.entityId && (
                              <span className="text-[10px] text-muted-foreground/70 font-mono truncate max-w-xs">
                                شناسه: {log.entityId}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Details Modal Trigger */}
                        <td className="py-3 px-3.5 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setActiveLogModal(log)}
                            className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            <span>مشاهده</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {!loading && logs.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border/60 bg-muted/20 text-xs">
              <span className="text-muted-foreground text-[11px]">
                نمایش ردیف‌های {((page - 1) * limit + 1).toLocaleString("fa-IR")} تا{" "}
                {Math.min(page * limit, total).toLocaleString("fa-IR")} از مجموع{" "}
                {total.toLocaleString("fa-IR")} گزارش
              </span>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(1)}
                  disabled={page <= 1}
                  className="h-7 w-7 p-0"
                  title="صفحه اول"
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-7 w-7 p-0"
                  title="صفحه قبل"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>

                <div className="px-2 text-xs font-semibold">
                  صفحه {page.toLocaleString("fa-IR")} از {totalPages.toLocaleString("fa-IR")}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-7 w-7 p-0"
                  title="صفحه بعد"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                  className="h-7 w-7 p-0"
                  title="صفحه آخر"
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={!!activeLogModal} onOpenChange={(open) => !open && setActiveLogModal(null)}>
        <DialogContent className="sm:max-w-xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                <span>شناسنامه و جزئیات اقدام ثبتی</span>
              </span>
              {activeLogModal && (
                <Badge
                  variant="outline"
                  className={`text-[10px] ${ACTION_CONFIG[activeLogModal.action]?.badgeClass}`}
                >
                  {ACTION_CONFIG[activeLogModal.action]?.label || activeLogModal.action}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              شناسه یکتای لاگ: <span className="font-mono text-foreground/80">{activeLogModal?.id}</span>
            </DialogDescription>
          </DialogHeader>

          {activeLogModal && (
            <div className="space-y-3.5 text-xs">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 gap-2.5 p-3 rounded-lg bg-muted/40 border border-border/60">
                <div>
                  <span className="text-[10px] text-muted-foreground block">کاربر اقدام‌کننده</span>
                  <span className="font-semibold text-foreground text-xs mt-0.5 block">
                    {activeLogModal.userName}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono block">
                    {activeLogModal.userEmail}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-muted-foreground block">زمان دقیق ثبت</span>
                  <span className="font-semibold text-foreground text-xs mt-0.5 block">
                    {formatFullDateTime(activeLogModal.createdAt)}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    ({formatRelativeTime(activeLogModal.createdAt)})
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-muted-foreground block">نوع و نام هدف</span>
                  <span className="font-medium text-foreground text-xs mt-0.5 block">
                    {ENTITY_CONFIG[activeLogModal.entityType]?.label || activeLogModal.entityType}:{" "}
                    {activeLogModal.entityName || "-"}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-muted-foreground block">شناسه هدف (Entity ID)</span>
                  <span className="font-mono text-[10px] text-muted-foreground truncate block mt-0.5">
                    {activeLogModal.entityId || "ثبت نشده"}
                  </span>
                </div>

                {activeLogModal.ipAddress && (
                  <div>
                    <span className="text-[10px] text-muted-foreground block">آدرس IP</span>
                    <span className="font-mono text-[11px] text-foreground block mt-0.5">
                      {activeLogModal.ipAddress}
                    </span>
                  </div>
                )}

                {activeLogModal.userAgent && (
                  <div className="col-span-2">
                    <span className="text-[10px] text-muted-foreground block">مرورگر / User Agent</span>
                    <span className="font-mono text-[10px] text-muted-foreground truncate block mt-0.5">
                      {activeLogModal.userAgent}
                    </span>
                  </div>
                )}
              </div>

              {/* Payload / Details */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>محتوای داده‌ها / تغییرات (Payload)</span>
                  </span>
                  {activeLogModal.details && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyDetails}
                      className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-500" />
                          <span className="text-emerald-500">کپی شد</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>کپی JSON</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {renderDetailsFormatted(activeLogModal.details)}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
