"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  FileCode,
  ShieldAlert,
  Server,
  Layers,
  Sparkles,
  BookOpen,
  Users,
  GraduationCap,
  Calendar,
  Building2,
  Lock,
  ArrowDownToLine,
  ArrowUpFromLine,
  Info,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface DatabaseStats {
  tableCounts: Record<string, number>;
  totalRecords: number;
  timestamp: string;
}

const TABLE_LABELS: Record<string, { label: string; icon: any }> = {
  faculties: { label: "دانشکده‌ها", icon: Building2 },
  majors: { label: "رشته‌ها", icon: GraduationCap },
  tracks: { label: "گرایش‌ها", icon: Layers },
  courses: { label: "دروس مصوب", icon: BookOpen },
  prerequisites: { label: "روابط پیش‌نیاز/هم‌نیاز", icon: Layers },
  professors: { label: "اساتید", icon: Users },
  course_offerings: { label: "ارائه‌های درسی", icon: BookOpen },
  offering_professors: { label: "هم‌تدریسی اساتید", icon: Users },
  course_events: { label: "رویدادها و کلاس‌ها", icon: Calendar },
  course_event_slots: { label: "جلسات هفتگی کلاس‌ها", icon: Calendar },
  charts: { label: "چارت‌های درسی", icon: Sparkles },
  chart_courses: { label: "دروس در چارت", icon: BookOpen },
  rule_categories: { label: "دسته‌های قوانین", icon: Layers },
  visual_categories: { label: "دسته‌های بصری", icon: Layers },
  track_course_assignments: { label: "انتساب دروس به دسته‌ها", icon: Layers },
  reviews: { label: "نظرات و امتیازات", icon: Info },
  users: { label: "کاربران سامانه", icon: Users },
};

export function BackupManager() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Export states
  const [downloadingSql, setDownloadingSql] = useState(false);
  const [downloadingJson, setDownloadingJson] = useState(false);

  // Import / Restore states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sqlText, setSqlText] = useState("");
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{
    success: boolean;
    message: string;
    stats?: {
      totalStatements: number;
      executedStatements: number;
      restoredRecords: number;
      tableCounts: Record<string, number>;
      errors: string[];
    };
  } | null>(null);

  // Load database live stats
  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await fetch("/api/admin/backup?stats=1").then((r) => r.json());
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error("Failed to load backup stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Handle direct download of SQL Dump
  const handleDownloadBackup = async (format: "sql" | "json") => {
    try {
      if (format === "sql") setDownloadingSql(true);
      else setDownloadingJson(true);

      const res = await fetch(`/api/admin/backup?format=${format}`);
      if (!res.ok) throw new Error("خطا در دریافت فایل بکاپ");

      const blob = await res.blob();
      const filename =
        format === "sql"
          ? `ut_ece_full_backup_${new Date().toISOString().slice(0, 10)}.sql`
          : `ut_ece_snapshot_${new Date().toISOString().slice(0, 10)}.json`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("خطا در دانلود فایل پشتیبان: " + (err?.message || "نامشخص"));
    } finally {
      if (format === "sql") setDownloadingSql(false);
      else setDownloadingJson(false);
    }
  };

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setRestoreResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setSqlText(content);
    };
    reader.readAsText(file, "UTF-8");
  };

  // Open Restore Confirmation Modal
  const handleOpenRestoreConfirm = () => {
    if (!sqlText.trim()) {
      alert("لطفاً ابتدا یک فایل بکاپ (.sql یا .json) انتخاب کنید یا متن SQL را وارد نمایید.");
      return;
    }
    setConfirmationInput("");
    setIsRestoreModalOpen(true);
  };

  // Execute Restore API Call
  const handleExecuteRestore = async () => {
    if (confirmationInput.trim().toUpperCase() !== "RESTORE") {
      alert("لطفاً عبارت RESTORE را برای تأیید نهایی وارد کنید.");
      return;
    }

    try {
      setIsRestoring(true);
      setRestoreResult(null);

      let payload: any = { sql: sqlText };
      // Check if it's JSON
      if (selectedFile?.name.endsWith(".json") || sqlText.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(sqlText);
          payload = { data: parsed.data || parsed.tables || parsed };
        } catch {}
      }

      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());

      setRestoreResult(res);
      setIsRestoreModalOpen(false);

      if (res.success) {
        await fetchStats();
      }
    } catch (err: any) {
      setRestoreResult({
        success: false,
        message: "خطا در برقراری ارتباط با سرور: " + (err?.message || "نامشخص"),
      });
      setIsRestoreModalOpen(false);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl border border-primary/20 bg-linear-to-r from-primary/10 via-background to-background shadow-xs">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-primary/20 text-primary flex items-center justify-center">
              <Database className="h-5 w-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              پشتیبان‌گیری و بازیابی پایگاه داده (Backup & Restore)
            </h1>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            دریافت خروجی کامل و یکپارچه از کلیه جداول و داده‌های سامانه به همراه قابلیت بازنویسی و بازیابی خودکار.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchStats}
          disabled={loadingStats}
          className="h-8 text-xs font-semibold gap-1.5 shadow-2xs self-start sm:self-center"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingStats ? "animate-spin text-primary" : ""}`} />
          بروزرسانی آمار
        </Button>
      </div>

      {/* Live Database Statistics Grid */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                وضعیت و آمار رکوردهای فعال در پایگاه داده
              </CardTitle>
              <CardDescription className="text-xs">
                تعداد کل رکوردهای ذخیره‌شده در ۱۷ جدول پایگاه داده سامانه
              </CardDescription>
            </div>
            {stats && (
              <Badge variant="secondary" className="text-xs font-bold px-2.5 py-1">
                مجموع {stats.totalRecords.toLocaleString("fa-IR")} رکورد
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {stats?.tableCounts &&
              Object.entries(stats.tableCounts).map(([table, count]) => {
                const meta = TABLE_LABELS[table] || { label: table, icon: Layers };
                const IconComponent = meta.icon;
                return (
                  <div
                    key={table}
                    className="p-3 rounded-2xl border border-border/70 bg-card/60 flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <IconComponent className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground truncate">
                        {meta.label}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-foreground font-mono shrink-0">
                      {count.toLocaleString("fa-IR")}
                    </span>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Main Actions: 2 Columns (Backup vs Restore) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Create & Download Full Backup */}
        <Card className="border-border/80 shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
              <ArrowDownToLine className="h-4.5 w-4.5 text-primary" />
              تهیه و دریافت نسخه پشتیبان (Create Backup)
            </CardTitle>
            <CardDescription className="text-xs">
              دریافت کل پایگاه داده در یک فایل یکپارچه با ساختار استاندارد
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 space-y-4 flex-1">
            <div className="p-3 rounded-2xl bg-muted/20 border border-border/60 text-xs space-y-2 leading-relaxed">
              <span className="font-bold text-foreground block flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                محتویات نسخه پشتیبان:
              </span>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground pr-1 text-[11px]">
                <li>شامل ۱۰۰٪ اطلاعات تمامی دانشکده‌ها، گرایش‌ها، دروس و اساتید</li>
                <li>حفظ اتصالات هم‌تدریسی، پیش‌نیازها و روابط گراف درسی</li>
                <li>شامل زمان‌بندی رویدادها، چارت‌های ثبت‌شده و نظرات دانشجویان</li>
                <li>فرمت SQL استاندارد و آماده برای بازنویسی مستقیم روی Cloudflare D1 و SQLite</li>
              </ul>
            </div>

            <div className="space-y-2.5 pt-2">
              <Button
                type="button"
                onClick={() => handleDownloadBackup("sql")}
                disabled={downloadingSql}
                className="w-full h-10 gap-2 text-xs font-bold shadow-xs"
              >
                {downloadingSql ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>در حال تولید فایل SQL...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>دانلود بکاپ کامل پایگاه داده (.sql)</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => handleDownloadBackup("json")}
                disabled={downloadingJson}
                className="w-full h-9 gap-2 text-xs font-semibold shadow-2xs hover:bg-muted/40"
              >
                {downloadingJson ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                    <span>در حال تولید فایل JSON...</span>
                  </>
                ) : (
                  <>
                    <FileCode className="h-4 w-4 text-primary" />
                    <span>دانلود داده‌ها با فرمت ساختاریافته (.json)</span>
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Restore Full Database */}
        <Card className="border-destructive/30 bg-linear-to-b from-destructive/5 via-background to-background shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-destructive/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-destructive">
              <ArrowUpFromLine className="h-4.5 w-4.5 text-destructive" />
              بازیابی پایگاه داده (Restore Database)
            </CardTitle>
            <CardDescription className="text-xs">
              بارگذاری فایل بکاپ و بازنویسی ۱۰۰٪ دیتابیس فعلی
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 space-y-4 flex-1">
            {/* Warning Alert */}
            <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>هشدار مهم امنیتی:</span>
              </div>
              <p className="text-[11px] leading-relaxed pr-6">
                با اجرای بازیابی، <strong>تمامی اطلاعات قبلی دیتابیس به صورت کامل پاکسازی شده</strong> و اطلاعات موجود در این فایل جایگزین خواهند شد.
              </p>
            </div>

            {/* File Upload Zone */}
            <div className="p-4 rounded-2xl border border-dashed border-border/80 bg-muted/10 text-center space-y-2.5">
              <input
                type="file"
                ref={fileInputRef}
                accept=".sql,.json"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center gap-1.5">
                <FileCode className="h-7 w-7 text-muted-foreground/80" />
                <span className="text-xs font-bold text-foreground">
                  {selectedFile ? selectedFile.name : "انتخاب فایل پشتیبان از سیستم"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {selectedFile
                    ? `حجم فایل: ${(selectedFile.size / 1024).toFixed(1)} کیلوبایت`
                    : "پشتیبانی از فایل‌های .sql و .json با انکودینگ UTF-8"}
                </span>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                {selectedFile ? "تغییر فایل انتخابی..." : "انتخاب فایل بکاپ..."}
              </Button>
            </div>

            {/* Direct Textarea Toggle/Paste */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <Label className="text-xs font-semibold">یا متن فایل SQL را مستقیماً وارد کنید:</Label>
                {sqlText && (
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {sqlText.length} کاراکتر
                  </Badge>
                )}
              </div>
              <Textarea
                value={sqlText}
                onChange={(e) => {
                  setSqlText(e.target.value);
                  setSelectedFile(null);
                }}
                placeholder="-- محتوای فایل SQL را اینجا قرار دهید..."
                rows={4}
                className="text-xs bg-background resize-none font-mono leading-relaxed"
                dir="ltr"
              />
            </div>

            <Button
              type="button"
              variant="destructive"
              onClick={handleOpenRestoreConfirm}
              disabled={!sqlText.trim() || isRestoring}
              className="w-full h-10 gap-2 text-xs font-bold shadow-xs mt-2"
            >
              <Upload className="h-4 w-4" />
              <span>شروع فرآیند بازیابی پایگاه داده...</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Restore Results Breakdown */}
      {restoreResult && (
        <Card
          className={`border shadow-xs ${
            restoreResult.success
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-destructive/30 bg-destructive/5"
          }`}
        >
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex items-center gap-2">
              {restoreResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              )}
              <div>
                <CardTitle className="text-sm font-bold">
                  {restoreResult.success ? "نتیجه بازیابی: موفقیت‌آمیز" : "نتیجه بازیابی: خطا"}
                </CardTitle>
                <CardDescription className="text-xs text-foreground font-medium mt-0.5">
                  {restoreResult.message}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          {restoreResult.stats && (
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-2xl bg-card border border-border/60">
                  <span className="text-xs text-muted-foreground block">دستورات اجراشده</span>
                  <span className="text-base font-bold text-foreground font-mono">
                    {restoreResult.stats.executedStatements}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-card border border-border/60">
                  <span className="text-xs text-muted-foreground block">کل رکوردهای بازیابی‌شده</span>
                  <span className="text-base font-bold text-emerald-600 font-mono">
                    {restoreResult.stats.restoredRecords}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-card border border-border/60">
                  <span className="text-xs text-muted-foreground block">خطاها</span>
                  <span className="text-base font-bold text-foreground font-mono">
                    {restoreResult.stats.errors.length}
                  </span>
                </div>
              </div>

              {restoreResult.stats.errors.length > 0 && (
                <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs space-y-1 font-mono text-left dir-ltr">
                  {restoreResult.stats.errors.map((e, idx) => (
                    <div key={idx}>{e}</div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Confirmation Modal Before Restore */}
      <Dialog open={isRestoreModalOpen} onOpenChange={setIsRestoreModalOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              تأیید نهایی بازیابی پایگاه داده
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
              شما در حال بازیابی پایگاه داده هستید. کلیه اطلاعات فعلی دیتابیس پاک شده و اطلاعات فایل جدید جایگزین خواهند شد.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs space-y-1">
              <span className="font-bold block">برای تأیید، لطفاً کلمه زیر را دقیقاً در کادر بنویسید:</span>
              <span className="font-mono font-black text-sm block tracking-widest text-center py-1 select-all">
                RESTORE
              </span>
            </div>

            <div className="space-y-1.5">
              <Input
                placeholder="RESTORE"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                className="font-mono text-center tracking-widest text-sm uppercase"
                dir="ltr"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsRestoreModalOpen(false)}
              disabled={isRestoring}
              className="text-xs"
            >
              انصراف
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleExecuteRestore}
              disabled={confirmationInput.trim().toUpperCase() !== "RESTORE" || isRestoring}
              className="text-xs font-bold gap-1.5"
            >
              {isRestoring ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>در حال پاکسازی و بازیابی...</span>
                </>
              ) : (
                <span>تأیید و اجرای بازیابی</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
