"use client";

import React, { useState, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/components/ui/code-editor";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Upload,
  Palette,
  AlertTriangle,
  CheckCircle2,
  FileCode,
  Sparkles,
  Layers,
  Building2,
} from "lucide-react";

interface VisualCategoryImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackId?: string;
  trackName?: string;
  onSuccess?: () => void;
}

export const VISUAL_CATEGORY_SCHEMA_DESCRIPTOR = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "قالب و اسناد ورود دسته‌های بصری (Visual Categories JSON Schema)",
  description: "اسکیمای استاندارد برای ورود دسته‌ای دسته‌های بصری چارت (تخت و بدون سلسله‌مراتب) و انتساب دروس",
  type: "array",
  items: {
    type: "object",
    required: ["code", "name"],
    properties: {
      code: {
        type: "string",
        description: "کد شناسایی یکتای دسته بصری (الزامی و معیار تطبیق)",
        example: "VC-TERM-1",
      },
      name: {
        type: "string",
        description: "نام کامل دسته بصری (الزامی)",
        example: "ترم اول (دروس پایه)",
      },
      color: {
        type: "string",
        pattern: "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$",
        description: "کد رنگ هگزادسیمال شاخص دسته در سایدبار چارت (اختیاری، پیش‌فرض: #3b82f6)",
        default: "#3b82f6",
        example: "#3b82f6",
      },
      courses: {
        type: "array",
        items: {
          type: "string",
        },
        description: "لیست کدهای رسمی دروسی که به این دسته بصری منتسب می‌شوند (اختیاری)",
        example: ["8101101", "8101102"],
      },
    },
    additionalProperties: false,
  },
  examples: [
    [
      {
        code: "VC-TERM-1",
        name: "ترم اول (دروس پایه)",
        color: "#3b82f6",
        courses: ["8101101", "8101102"],
      },
      {
        code: "VC-TERM-2",
        name: "ترم دوم",
        color: "#10b981",
        courses: ["8101201", "8101202"],
      },
      {
        code: "VC-ELECTIVES",
        name: "دروس اختیاری",
        color: "#f59e0b",
        courses: ["8101301"],
      },
    ],
  ],
};

export function VisualCategoryImportDialog({
  open,
  onOpenChange,
  trackId,
  trackName,
  onSuccess,
}: VisualCategoryImportDialogProps) {
  const [jsonText, setJsonText] = useState("");
  const [parsedData, setParsedData] = useState<any[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    stats?: {
      categoriesCreated: number;
      categoriesUpdated: number;
      coursesAssigned: number;
      warnings: string[];
    };
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download Schema Descriptor File
  const handleDownloadSchema = () => {
    const jsonStr = JSON.stringify(VISUAL_CATEGORY_SCHEMA_DESCRIPTOR, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "visual-categories-schema.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper to count statistics from flat categories list
  const listStats = useMemo(() => {
    if (!parsedData || !Array.isArray(parsedData)) return null;

    let totalCategories = 0;
    let totalCourses = 0;

    for (const node of parsedData) {
      if (node && typeof node === "object") {
        totalCategories++;
        const courses = node.courses ?? node.courseCodes;
        if (Array.isArray(courses)) {
          totalCourses += courses.length;
        }
      }
    }

    return { totalCategories, totalCourses };
  }, [parsedData]);

  // Handle Text/Editor Change & Live Validation
  const handleTextChange = (text: string) => {
    setJsonText(text);
    setParseError(null);
    setResult(null);

    if (!text.trim()) {
      setParsedData(null);
      return;
    }

    try {
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed)
        ? parsed
        : (parsed.categories || parsed.visualCategories || (parsed.examples && parsed.examples[0]));

      if (!Array.isArray(list)) {
        setParseError("فرمت ورودی نامعتبر است: داده‌ها باید یک آرایه شامل حداقل یک دسته بصری باشند.");
        setParsedData(null);
        return;
      }

      // Quick validate elements
      for (const item of list) {
        if (!item || typeof item !== "object") {
          setParseError("هر عضو آرایه ورودی باید یک شیء دسته بصری باشد.");
          setParsedData(null);
          return;
        }
        if (!item.code || typeof item.code !== "string") {
          setParseError("فیلد «code» در تمامی دسته‌ها اجباری است.");
          setParsedData(null);
          return;
        }
        if (!item.name || typeof item.name !== "string") {
          setParseError("فیلد «name» در تمامی دسته‌ها اجباری است.");
          setParsedData(null);
          return;
        }
      }

      setParsedData(list);
      setParseError(null);
    } catch (e: any) {
      setParseError(`خطا در تجزیه JSON: ${e.message}`);
      setParsedData(null);
    }
  };

  // Handle File Upload (.json)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleTextChange(content);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  // Submit Import
  const handleImportSubmit = async () => {
    if (!trackId) {
      alert("شناسه گرایش مشخص نشده است.");
      return;
    }

    if (!parsedData || parsedData.length === 0) {
      alert("لطفاً ابتدا فایل JSON معتبر دسته‌های بصری را وارد کنید.");
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/tracks/visual-categories/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId,
          categories: parsedData,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResult({
          success: true,
          message: data.message,
          stats: data.stats,
        });
        onSuccess?.();
      } else {
        setResult({
          success: false,
          message: data.message || "خطا در ورود دسته‌های بصری",
        });
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: err?.message || "خطای اتصال به سرور",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <span>ورود دسته‌ای دسته‌های بصری (Import JSON)</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            ورود لیست دسته‌های بصری رنگی و انتساب دروس به صورت فایل JSON تخت و یکپارچه
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Target Track Fixed Card */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <span className="text-muted-foreground">گرایش هدف:</span>
              <span className="font-bold text-foreground">
                {trackName ? trackName : "انتخاب نشده"}
              </span>
            </div>
          </div>

          {/* Detailed Schema Descriptor Download Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span>فایل توصیف‌کننده ساختار JSON دسته‌های بصری:</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadSchema}
              className="h-7 text-xs font-medium gap-1.5 shadow-2xs hover:bg-background shrink-0"
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              دانلود توصیف اسکیما (Schema JSON)
            </Button>
          </div>

          {/* File Upload Area */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl border border-dashed border-primary/40 bg-muted/10">
            <div className="space-y-1 text-center sm:text-right">
              <span className="text-xs font-bold text-foreground block">انتخاب فایل از سیستم</span>
              <span className="text-[11px] text-muted-foreground block">
                فایل‌های با پسوند <code className="font-semibold text-primary">.json</code> با انکودینگ UTF-8
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                <FileCode className="h-4 w-4" />
                انتخاب فایل JSON...
              </Button>
            </div>
          </div>

          {/* Code Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>یا محتوای JSON را مستقیماً اینجا وارد یا ویرایش کنید:</span>
              {listStats && (
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                    {listStats.totalCategories} دسته بصری
                  </Badge>
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30 bg-amber-500/10">
                    {listStats.totalCourses} انتساب درس
                  </Badge>
                </div>
              )}
            </div>

            <CodeEditor
              value={jsonText}
              onChange={handleTextChange}
              placeholder='[ { "code": "VC-TERM-1", "name": "ترم اول", "color": "#3b82f6", "courses": ["8101101"] } ]'
              maxHeight="18rem"
              minHeight="10rem"
              title="ویرایشگر ساختار دسته‌های بصری"
              allowFullscreen={false}
            />
          </div>

          {/* Validation Parse Error */}
          {parseError && (
            <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Result Breakdown Card */}
          {result && (
            <div
              className={`p-3.5 rounded-2xl border text-xs space-y-2.5 ${
                result.success
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                {result.success ? (
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4.5 w-4.5 text-destructive shrink-0" />
                )}
                <span>{result.message}</span>
              </div>

              {result.stats && (
                <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
                  <div className="p-2 rounded-xl bg-background/60 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-sans">دسته‌های جدید</span>
                    <span className="text-xs font-bold text-foreground">
                      {result.stats.categoriesCreated}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-background/60 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-sans">به‌روزرسانی</span>
                    <span className="text-xs font-bold text-foreground">
                      {result.stats.categoriesUpdated}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-background/60 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-sans">دروس منتسب</span>
                    <span className="text-xs font-bold text-foreground">
                      {result.stats.coursesAssigned}
                    </span>
                  </div>
                </div>
              )}

              {result.stats?.warnings && result.stats.warnings.length > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 space-y-1 text-[11px]">
                  <span className="font-bold block">هشدارهای پردازش:</span>
                  <ul className="list-disc list-inside space-y-0.5 max-h-24 overflow-y-auto">
                    {result.stats.warnings.slice(0, 10).map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-8"
            >
              بستن
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!parsedData || parsedData.length === 0 || isLoading || !trackId}
              onClick={handleImportSubmit}
              className="text-xs h-8 gap-1.5 font-bold shadow-xs"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />
                  در حال ثبت و پردازش...
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  شروع فرآیند ورود دسته‌های بصری...
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
