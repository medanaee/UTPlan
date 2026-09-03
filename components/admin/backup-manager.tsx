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
  ArrowDownToLine,
  ArrowUpFromLine,
  Info,
  Link2,
  FolderArchive,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CodeEditor } from "@/components/ui/code-editor";
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
  faculty_links: { label: "اتصال دانشکده‌ها", icon: Link2 },
  majors: { label: "رشته‌ها", icon: GraduationCap },
  tracks: { label: "گرایش‌ها", icon: Layers },
  visual_categories: { label: "دسته‌های بصری", icon: Layers },
  rule_categories: { label: "دسته‌های قوانین", icon: Layers },
  courses: { label: "دروس مصوب", icon: BookOpen },
  prerequisites: { label: "روابط پیش‌نیاز/هم‌نیاز", icon: Layers },
  track_course_assignments: { label: "انتساب دروس به دسته‌ها", icon: Layers },
  professors: { label: "اساتید", icon: Users },
  course_offerings: { label: "ارائه‌های درسی", icon: BookOpen },
  offering_professors: { label: "هم‌تدریسی اساتید", icon: Users },
  offering_resources: { label: "منابع درسی (جزوه/ویدیو)", icon: FolderArchive },
  course_events: { label: "رویدادها و کلاس‌ها", icon: Calendar },
  course_event_slots: { label: "جلسات هفتگی کلاس‌ها", icon: Calendar },
  users: { label: "کاربران سامانه", icon: Users },
  reviews: { label: "نظرات و امتیازات", icon: Info },
  charts: { label: "چارت‌های درسی", icon: Sparkles },
  chart_terms: { label: "ترم‌های چارت", icon: Calendar },
  chart_courses: { label: "دروس در چارت", icon: BookOpen },
};

export function BackupManager() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Export state
  const [downloadingJson, setDownloadingJson] = useState(false);

  // Import / Restore states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{
    success: boolean;
    message: string;
    stats?: {
      totalInserted: number;
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

  // Handle direct download of Full JSON Backup
  const handleDownloadBackup = async () => {
    try {
      setDownloadingJson(true);

      const res = await fetch("/api/admin/backup");
      if (!res.ok) throw new Error("خطا در دریافت فایل بکاپ JSON");

      const blob = await res.blob();
      const filename = `ut_ece_full_backup_${new Date().toISOString().slice(0, 10)}.json`;

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
      setDownloadingJson(false);
    }
  };

  // Handle File Selection (.json)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setRestoreResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonText(content);
    };
    reader.readAsText(file, "UTF-8");
  };

  // Open Restore Confirmation Modal
  const handleOpenRestoreConfirm = () => {
    if (!jsonText.trim()) {
      alert("لطفاً ابتدا یک فایل بکاپ JSON انتخاب کنید یا متن JSON را وارد نمایید.");
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

      let payload: any = null;
      try {
        payload = JSON.parse(jsonText);
      } catch (parseErr) {
        alert("فرمت فایل نامعتبر است. محتوا باید یک فایل استاندارد JSON باشد.");
        setIsRestoring(false);
        return;
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
              پشتیبان‌گیری و بازیابی پایگاه داده (JSON Backup & Restore)
            </h1>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            دریافت نسخه پشتیبان کامل از تمامی ۱۷ جدول دیتابیس در یک فایل یکپارچه JSON و امکان بازیابی و بازنویسی ۱۰۰٪ داده‌ها.
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



      {/* Main Actions: 2 Columns (Backup vs Restore) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Create & Download Full JSON Backup */}
        <Card className="border-border/80 shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
              <ArrowDownToLine className="h-4.5 w-4.5 text-primary" />
              تهیه و دریافت نسخه پشتیبان JSON (Create Backup)
            </CardTitle>
            <CardDescription className="text-xs">
              دریافت کل پایگاه داده در یک فایل ساختاریافته استاندارد JSON
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 flex-1">
            <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 text-xs space-y-2 leading-relaxed">
              <span className="font-bold text-foreground block flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                محتویات فایل پشتیبان JSON:
              </span>
              <ul className="list-disc list-inside space-y-1.5 text-muted-foreground pr-1 text-[11px]">
                <li>شامل ۱۰۰٪ اطلاعات تمامی دانشکده‌ها، رشته‌ها، گرایش‌ها و کاربران</li>
                <li>دروس مصوب، پیش‌نیازها، هم‌نیازها و پیش‌نیازهای پیشنهادی</li>
                <li>اساتید هیئت علمی، ارائه‌های درسی و هم‌تدریسی‌ها (چند استادی)</li>
                <li>رویدادهای کلاسی، امتحانات و جلسات هفتگی</li>
                <li>چارت‌های درسی مصوب، درخت قوانین و نظرات دانشجویان</li>
              </ul>
            </div>

            <div className="pt-2">
              <Button
                type="button"
                onClick={handleDownloadBackup}
                disabled={downloadingJson}
                className="w-full h-11 gap-2 text-xs font-bold shadow-xs"
              >
                {downloadingJson ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>در حال تولید فایل پشتیبان JSON...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>دانلود فایل پشتیبان کامل (.json)</span>
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Restore Full Database from JSON */}
        <Card className="border-destructive/30 bg-linear-to-b from-destructive/5 via-card to-card shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-destructive/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-destructive">
              <ArrowUpFromLine className="h-4.5 w-4.5 text-destructive" />
              بازیابی پایگاه داده از JSON (Restore Database)
            </CardTitle>
            <CardDescription className="text-xs">
              بارگذاری فایل بکاپ JSON و بازنویسی ۱۰۰٪ اطلاعات دیتابیس
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 flex-1">
            {/* Warning Alert */}
            <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>هشدار مهم امنیتی:</span>
              </div>
              <p className="text-[11px] leading-relaxed pr-6">
                با اجرای بازیابی، <strong>تمامی اطلاعات فعلی دیتابیس پاکسازی شده</strong> و اطلاعات موجود در این فایل JSON جایگزین خواهند شد.
              </p>
            </div>

            {/* File Upload Zone */}
            <div className="p-4 rounded-2xl border border-dashed border-border/80 bg-muted/10 text-center space-y-2.5">
              <input
                type="file"
                ref={fileInputRef}
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center gap-1.5">
                <FileCode className="h-7 w-7 text-muted-foreground/80" />
                <span className="text-xs font-bold text-foreground">
                  {selectedFile ? selectedFile.name : "انتخاب فایل پشتیبان JSON از سیستم"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {selectedFile
                    ? `حجم فایل: ${(selectedFile.size / 1024).toFixed(1)} کیلوبایت`
                    : "فایل‌های با پسوند .json و انکودینگ UTF-8"}
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
                {selectedFile ? "تغییر فایل JSON..." : "انتخاب فایل JSON..."}
              </Button>
            </div>

            {/* Direct Code Editor Paste */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <Label className="text-xs font-semibold">یا محتوای JSON را مستقیماً وارد یا ویرایش کنید:</Label>
              </div>
              <CodeEditor
                value={jsonText}
                onChange={(val) => {
                  setJsonText(val);
                  setSelectedFile(null);
                }}
                placeholder='{ "metadata": { ... }, "data": { ... } }'
                maxHeight="18rem"
                minHeight="10rem"
                title="ویرایشگر پشتیبان دیتابیس (JSON)"
                allowFullscreen={true}
              />
            </div>

            <Button
              type="button"
              variant="destructive"
              onClick={handleOpenRestoreConfirm}
              disabled={!jsonText.trim() || isRestoring}
              className="w-full h-10 gap-2 text-xs font-bold shadow-xs mt-2"
            >
              <Upload className="h-4 w-4" />
              <span>شروع فرآیند بازیابی پایگاه داده از JSON...</span>
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
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-2xl bg-card border border-border/60">
                  <span className="text-xs text-muted-foreground block">کل رکوردهای بازیابی‌شده</span>
                  <span className="text-base font-bold text-emerald-600 font-mono">
                    {restoreResult.stats.restoredRecords.toLocaleString("fa-IR")}
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
              تأیید نهایی بازیابی پایگاه داده از JSON
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
              شما در حال بازیابی پایگاه داده هستید. کلیه اطلاعات فعلی دیتابیس پاک شده و اطلاعات این فایل JSON جایگزین خواهند شد.
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
