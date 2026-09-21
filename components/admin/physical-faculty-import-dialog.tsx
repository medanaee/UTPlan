"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  Download,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  MapPin,
  RefreshCw,
} from "lucide-react";
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
import { postJson } from "@/lib/api-client";

interface PhysicalFacultyImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const PHYSICAL_FACULTY_SCHEMA_DESCRIPTOR = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "قالب و اسناد ورود دانشکده‌های فیزیکی (Physical Faculties JSON Schema)",
  description: "اسکیمای استاندارد برای ورود دسته‌ای مشخصات پردیس‌ها و دانشکده‌های فیزیکی دانشگاه",
  type: "array",
  items: {
    type: "object",
    required: ["name"],
    properties: {
      name: {
        type: "string",
        description: "نام پردیس یا دانشکده فیزیکی (الزامی)",
        example: "دانشکده مهندسی برق و کامپیوتر (پردیس ۲)",
      },
      code: {
        type: "string",
        description: "کد شناسایی یا اختصاری یکتا (اختیاری)",
        example: "PFAC-ECE",
      },
      imageUrl: {
        type: "string",
        format: "uri",
        description: "آدرس اینترنتی تصویر نمای ساختمان یا پردیس (اختیاری)",
        example: "https://ece.ut.ac.ir/building.jpg",
      },
      latitude: {
        type: "number",
        description: "عرض جغرافیایی نقطه دقیق روی نقشه (اختیاری)",
        example: 35.7027,
      },
      longitude: {
        type: "number",
        description: "طول جغرافیایی نقطه دقیق روی نقشه (اختیاری)",
        example: 51.3912,
      },
      address: {
        type: "string",
        description: "آدرس متنی و نشانی فیزیکی (اختیاری)",
        example: "تهران، خیابان کارگر شمالی، پردیس ۲ دانشکده‌های فنی",
      },
      description: {
        type: "string",
        description: "توضیحات تکمیلی، امکانات، یا ورودی‌های پردیس (اختیاری)",
        example: "شامل ساختمان شماره ۱ و ۲، آزمایشگاه‌ها و کتابخانه مرکزی دانشکده",
      },
    },
    additionalProperties: false,
  },
  examples: [
    [
      {
        name: "دانشکده مهندسی برق و کامپیوتر (پردیس ۲)",
        code: "PFAC-ECE",
        imageUrl: "https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3",
        latitude: 35.7027,
        longitude: 51.3912,
        address: "تهران، خیابان کارگر شمالی، بالاتر از تقاطع جلال آل‌احمد، پردیس ۲ دانشکده‌های فنی",
        description: "شامل گروه‌های مهندسی برق، مهندسی کامپیوتر و آزمایشگاه‌های پیشرفته",
      },
      {
        name: "پردیس مرکزی دانشکده‌های فنی (ساختمان ۱۶ آذر)",
        code: "PFAC-CENTRAL",
        imageUrl: "https://images.unsplash.com/photo-1562774053-701939374585",
        latitude: 35.7011,
        longitude: 51.3965,
        address: "تهران، میدان انقلاب، خیابان ۱۶ آذر، پردیس مرکزی دانشگاه تهران",
        description: "دانشکده مهندسی عمران، معدن و مهندسی شیمی",
      },
    ],
  ],
};

const SAMPLE_JSON = JSON.stringify(PHYSICAL_FACULTY_SCHEMA_DESCRIPTOR.examples[0], null, 2);

export function PhysicalFacultyImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: PhysicalFacultyImportDialogProps) {
  const [activeTab, setActiveTab] = useState<"editor" | "docs">("editor");
  const [jsonText, setJsonText] = useState(SAMPLE_JSON);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [successResult, setSuccessResult] = useState<{
    message: string;
    stats?: { total: number; inserted: number; updated: number; skipped: number };
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setErrorMsg(null);
      setValidationErrors([]);
      setSuccessResult(null);
    }
  }, [open]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        setJsonText(JSON.stringify(parsed, null, 2));
        setErrorMsg(null);
        setValidationErrors([]);
      } catch (err: any) {
        setErrorMsg("فرمت فایل نامعتبر است. لطفاً یک فایل JSON استاندارد انتخاب کنید.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_JSON], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `physical_faculties_sample.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const validateJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.physicalFaculties)
        ? parsed.physicalFaculties
        : Array.isArray(parsed?.data)
        ? parsed.data
        : null;

      if (!list || !Array.isArray(list)) {
        return "جی‌سان ارسالی باید آرایه‌ای از دانشکده‌های فیزیکی باشد.";
      }

      if (list.length === 0) {
        return "آرایه ارسالی خالی است.";
      }

      const errors: string[] = [];
      list.forEach((item: any, idx: number) => {
        if (!item || typeof item !== "object") {
          errors.push(`ردیف ${idx + 1}: داده نامعتبر است.`);
        } else if (!item.name || !String(item.name).trim()) {
          errors.push(`ردیف ${idx + 1}: نام دانشکده الزامی است.`);
        }
      });

      if (errors.length > 0) {
        setValidationErrors(errors.slice(0, 5));
        return `تعداد ${errors.length} خطا در اعتبارسنجی داده‌ها مشاهده شد.`;
      }

      return null;
    } catch (err: any) {
      return `خطا در نحو (Syntax) ساختار JSON: ${err.message}`;
    }
  };

  const handleSubmit = async () => {
    setErrorMsg(null);
    setValidationErrors([]);
    setSuccessResult(null);

    const validationError = validateJson();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      const parsed = JSON.parse(jsonText);
      const payload = {
        physicalFaculties: Array.isArray(parsed) ? parsed : parsed.physicalFaculties || parsed.data,
        mode,
      };

      const res = await postJson("/api/physical-faculties/import", payload);

      if (res.success) {
        setSuccessResult({
          message: res.message || "عملیات ورود با موفقیت انجام شد.",
          stats: res.stats,
        });
        if (onSuccess) onSuccess();
      } else {
        setErrorMsg(res.message || "خطا در ورود اطلاعات");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "خطا در ارتباط با سرور");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden" dir="rtl">
        <DialogHeader className="p-5 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  ورود دسته‌ای دانشکده‌های فیزیکی (JSON Import)
                </DialogTitle>
                <DialogDescription className="text-xs pt-1">
                  بارگذاری ساختار پردیس‌ها، عکس‌ها و موقعیت جغرافیایی از طریق فایل یا متن استاندارد JSON
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/40 border">
              <button
                type="button"
                onClick={() => setActiveTab("editor")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === "editor"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                ویرایشگر JSON
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("docs")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === "docs"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                مستندات و راهنما
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Top Actions: File upload & Sample */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border bg-muted/20">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 text-xs gap-1.5 shadow-2xs font-semibold"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>بارگذاری از فایل JSON</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadSample}
                className="h-8 text-xs gap-1.5 shadow-2xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>دریافت نمونه فایل</span>
              </Button>
            </div>

            {/* Mode selection */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">حالت ورود:</span>
              <div className="inline-flex rounded-lg border p-0.5 bg-background text-xs">
                <button
                  type="button"
                  onClick={() => setMode("append")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    mode === "append"
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  افزودن و به‌روزرسانی
                </button>
                <button
                  type="button"
                  onClick={() => setMode("replace")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    mode === "replace"
                      ? "bg-destructive text-destructive-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  جایگزینی کامل
                </button>
              </div>
            </div>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs space-y-1.5 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              {validationErrors.length > 0 && (
                <ul className="list-disc list-inside space-y-0.5 pr-2 font-mono text-[11px]">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {successResult && (
            <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-600" />
                <span>{successResult.message}</span>
              </div>
              {successResult.stats && (
                <div className="flex items-center gap-4 text-[11px] font-medium pt-1 border-t border-emerald-500/20">
                  <span>کل رکوردها: {successResult.stats.total}</span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                    افزوده شد: {successResult.stats.inserted}
                  </span>
                  <span>به‌روزرسانی: {successResult.stats.updated}</span>
                  {successResult.stats.skipped > 0 && (
                    <span className="text-amber-700">صرف‌نظر: {successResult.stats.skipped}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Main Tab Content */}
          {activeTab === "editor" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>متن JSON را اینجا وارد یا ویرایش کنید:</span>
                <span className="font-mono text-[11px]">UTF-8 JSON</span>
              </div>
              <div className="border rounded-xl overflow-hidden shadow-xs">
                <CodeEditor
                  value={jsonText}
                  onChange={setJsonText}
                  className="min-h-[280px] max-h-[420px] font-mono text-xs"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border p-4 bg-muted/10 space-y-3">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-xs font-bold text-foreground">
                    راهنمای فیلدهای اسکیمای دانشکده‌های فیزیکی
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="p-2 font-bold">نام فیلد</th>
                        <th className="p-2 font-bold">نوع</th>
                        <th className="p-2 font-bold">وضعیت</th>
                        <th className="p-2 font-bold">توضیحات و مثال</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      <tr>
                        <td className="p-2 font-mono text-primary font-bold">name</td>
                        <td className="p-2 font-mono text-[11px]">string</td>
                        <td className="p-2">
                          <Badge variant="destructive" className="text-[10px] h-4.5 px-1.5">
                            الزامی
                          </Badge>
                        </td>
                        <td className="p-2 text-muted-foreground">
                          نام پردیس یا ساختمان دانشکده فیزیکی (مثلاً «دانشکده مهندسی برق و کامپیوتر»)
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 font-mono text-foreground font-semibold">code</td>
                        <td className="p-2 font-mono text-[11px]">string</td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-[10px] h-4.5 px-1.5">
                            اختیاری
                          </Badge>
                        </td>
                        <td className="p-2 text-muted-foreground">
                          کد شناسایی یا اختصاری یکتا (در صورت عدم ارسال به صورت خودکار تولید می‌شود)
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 font-mono text-foreground font-semibold">imageUrl</td>
                        <td className="p-2 font-mono text-[11px]">string (uri)</td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-[10px] h-4.5 px-1.5">
                            اختیاری
                          </Badge>
                        </td>
                        <td className="p-2 text-muted-foreground">
                          آدرس مستقیم تصویر ساختمان یا محوطه
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 font-mono text-foreground font-semibold">latitude</td>
                        <td className="p-2 font-mono text-[11px]">number (float)</td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-[10px] h-4.5 px-1.5">
                            اختیاری
                          </Badge>
                        </td>
                        <td className="p-2 text-muted-foreground">
                          عرض جغرافیایی نقطه دقیق روی نقشه (مثلاً 35.7027)
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 font-mono text-foreground font-semibold">longitude</td>
                        <td className="p-2 font-mono text-[11px]">number (float)</td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-[10px] h-4.5 px-1.5">
                            اختیاری
                          </Badge>
                        </td>
                        <td className="p-2 text-muted-foreground">
                          طول جغرافیایی نقطه دقیق روی نقشه (مثلاً 51.3912)
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 font-mono text-foreground font-semibold">address</td>
                        <td className="p-2 font-mono text-[11px]">string</td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-[10px] h-4.5 px-1.5">
                            اختیاری
                          </Badge>
                        </td>
                        <td className="p-2 text-muted-foreground">
                          نشانی متنی و دسترسی فیزیکی به پردیس
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 font-mono text-foreground font-semibold">description</td>
                        <td className="p-2 font-mono text-[11px]">string</td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-[10px] h-4.5 px-1.5">
                            اختیاری
                          </Badge>
                        </td>
                        <td className="p-2 text-muted-foreground">
                          توضیحات تکمیلی پیرامون گروه‌ها، آزمایشگاه‌ها یا ساختمان‌ها
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/10 flex items-center justify-between shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="text-xs"
          >
            بستن
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setJsonText(SAMPLE_JSON);
                setErrorMsg(null);
                setValidationErrors([]);
              }}
              disabled={isSubmitting}
              className="text-xs"
            >
              بازنشانی به نمونه
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="text-xs gap-1.5 font-bold shadow-xs"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>شروع فرآیند ورود داده‌ها</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
