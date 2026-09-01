"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  Download,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Building2,
  Sparkles,
  PlusCircle,
  RefreshCw,
  BookUser,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { Faculty } from "@/lib/types";

interface OfferingImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultFacultyId?: string;
  targetFaculty?: Faculty | null;
  onSuccess?: () => void;
}

const OFFERING_SCHEMA_DESCRIPTOR = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "قالب و اسناد ورود ارائه‌های درسی (Course Offerings JSON Schema)",
  description: "اسکیمای استاندارد برای ورود دسته‌ای ارائه‌های درسی بر اساس کدهای شناسایی",
  type: "array",
  items: {
    type: "object",
    required: ["code", "courseCode", "mainProfessor", "professors"],
    properties: {
      code: {
        type: "string",
        description: "کد یکتا و معیار تشخیص ارائه درسی (اجباری)",
        example: "OFF-101",
      },
      courseCode: {
        type: "string",
        description: "کد رسمی درس در سامانه (اجباری)",
        example: "8101234",
      },
      mainProfessor: {
        type: "string",
        description: "کد استاد اصلی ارائه که حتماً باید در آرایه professors نیز باشد (اجباری)",
        example: "PRF-101",
      },
      professors: {
        type: "array",
        items: { type: "string" },
        description: "آرایه‌ای از کدهای اساتید مدرس ارائه (شامل حداقل یک کد) (اجباری)",
        example: ["PRF-101", "PRF-102"],
      },
      description: {
        type: "string",
        description: "توضیحات و نکات اختیاری ارائه",
        example: "این ارائه شامل کارگاه عملی و پروژه نهایی است.",
      },
      finalizedSemesters: {
        type: "array",
        items: { type: "string" },
        description: "لیست اختیاری ترم‌های ارائه",
        example: ["1403-1", "1403-2"],
      },
    },
  },
  examples: [
    [
      {
        code: "OFF-101",
        courseCode: "8101234",
        mainProfessor: "PRF-101",
        professors: ["PRF-101", "PRF-102"],
        description: "ارائه با پروژه تیمی",
      },
      {
        code: "OFF-102",
        courseCode: "8101101",
        mainProfessor: "PRF-103",
        professors: ["PRF-103"],
      },
    ],
  ],
};

export function OfferingImportDialog({
  open,
  onOpenChange,
  defaultFacultyId,
  targetFaculty,
  onSuccess,
}: OfferingImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>(
    targetFaculty?.id || defaultFacultyId || ""
  );

  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [jsonText, setJsonText] = useState("");
  const [parsedData, setParsedData] = useState<any[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    stats?: {
      total: number;
      created: number;
      updated: number;
      errors: string[];
    };
  } | null>(null);

  useEffect(() => {
    if (!targetFaculty) {
      fetch("/api/faculties")
        .then((r) => r.json())
        .then((d) => {
          if (d.success && Array.isArray(d.data)) {
            setFaculties(d.data);
          }
        })
        .catch(() => {});
    }
  }, [targetFaculty]);

  useEffect(() => {
    const activeId = targetFaculty?.id || defaultFacultyId || "";
    if (activeId) {
      setSelectedFacultyId(activeId);
    }
  }, [targetFaculty, defaultFacultyId]);

  const activeFaculty =
    targetFaculty ||
    faculties.find((f) => f.id === (selectedFacultyId || defaultFacultyId));

  const handleDownloadSchemaDescriptor = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(OFFERING_SCHEMA_DESCRIPTOR, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "offerings-schema.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleTextChange = (text: string) => {
    setJsonText(text);
    setResult(null);

    if (!text.trim()) {
      setParsedData(null);
      setParseError(null);
      return;
    }

    try {
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : parsed.offerings;
      if (!Array.isArray(list)) {
        setParseError("فایل JSON باید شامل یک آرایه از ارائه‌ها باشد.");
        setParsedData(null);
      } else {
        setParsedData(list);
        setParseError(null);
      }
    } catch (err: any) {
      setParseError("فرمت JSON نامعتبر است: " + err?.message);
      setParsedData(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleTextChange(content);
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleImportSubmit = async () => {
    if (!parsedData || parsedData.length === 0) return;
    const targetId = selectedFacultyId || targetFaculty?.id || defaultFacultyId;
    if (!targetId) {
      alert("لطفاً ابتدا یک دانشکده را در هدر پنل انتخاب کنید.");
      return;
    }

    if (
      importMode === "replace" &&
      !confirm(
        `هشدار مهم: با انتخاب «جایگزینی کامل»، کلیه ارائه‌های درسی فعلی دانشکده «${
          activeFaculty?.name || "انتخاب‌شده"
        }» حذف شده و با اطلاعات این فایل جایگزین خواهند شد. آیا مطمئن هستید؟`
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      setResult(null);

      const res = await fetch(
        `/api/offerings/import?facultyId=${targetId}&mode=${importMode}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offerings: parsedData, mode: importMode }),
        }
      ).then((r) => r.json());

      setResult(res);

      if (res.success && onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: "خطا در برقراری ارتباط با سرور: " + (err?.message || "نامشخص"),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setJsonText("");
    setParsedData(null);
    setParseError(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <BookUser className="h-5 w-5 text-primary" />
            ورود دسته‌ای ارائه‌های درسی (Import JSON)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            انتساب دروس به اساتید مدرس را در قالب فایل استاندارد JSON وارد دانشکده کنید.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Target Faculty Fixed Card */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <span className="text-muted-foreground">دانشکده هدف:</span>
              <span className="font-bold text-foreground">
                {activeFaculty ? `${activeFaculty.name} (${activeFaculty.code})` : "انتخاب نشده"}
              </span>
            </div>
          </div>

          {/* Import Mode Selection Options */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold block text-foreground">
              نحوه ورود و همگام‌سازی ارائه‌ها:
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option 1: Append & Update (Merge) */}
              <div
                onClick={() => setImportMode("append")}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                  importMode === "append"
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                    : "border-border/80 bg-muted/20 hover:bg-muted/40"
                }`}
              >
                <input
                  type="radio"
                  name="importModeOff"
                  checked={importMode === "append"}
                  onChange={() => setImportMode("append")}
                  className="mt-0.5 accent-primary cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <PlusCircle className="h-3.5 w-3.5 text-primary" />
                    افزودن و به‌روزرسانی (Merge)
                  </span>
                  <span className="text-[11px] text-muted-foreground block leading-relaxed">
                    ارائه‌های جدید افزوده می‌شوند؛ ارائه‌های تکراری (درس + استاد یکسان) همگام شده و سایرین حفظ می‌شوند.
                  </span>
                </div>
              </div>

              {/* Option 2: Wipe & Replace */}
              <div
                onClick={() => setImportMode("replace")}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                  importMode === "replace"
                    ? "border-destructive bg-destructive/10 ring-1 ring-destructive/30"
                    : "border-border/80 bg-muted/20 hover:bg-muted/40"
                }`}
              >
                <input
                  type="radio"
                  name="importModeOff"
                  checked={importMode === "replace"}
                  onChange={() => setImportMode("replace")}
                  className="mt-0.5 accent-destructive cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-destructive flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5 text-destructive" />
                    جایگزینی کامل (Wipe & Replace)
                  </span>
                  <span className="text-[11px] text-muted-foreground block leading-relaxed">
                    تمام ارائه‌های فعلی دروس این دانشکده حذف و با محتوای این فایل بازنویسی می‌شوند.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Schema Descriptor Download Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span>فایل توصیف‌کننده اسکیمای استاندارد JSON ارائه‌ها:</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadSchemaDescriptor}
              className="h-7 text-xs font-medium gap-1.5 shadow-2xs hover:bg-background shrink-0"
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              دانلود توصیف اسکیما (Schema JSON)
            </Button>
          </div>

          {/* File Upload Area */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl border border-dashed border-primary/40 bg-muted/10">
            <div className="space-y-1 text-center sm:text-right">
              <span className="text-xs font-bold text-foreground block">انتخاب فایل ارائه‌ها از سیستم</span>
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

          {/* Textarea Paste */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>یا متن JSON را مستقیماً اینجا وارد کنید:</span>
              {parsedData && (
                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                  {parsedData.length} ارائه شناسایی شد
                </Badge>
              )}
            </div>
            <Textarea
              value={jsonText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder='[ { "code": "OFF-101", "courseCode": "8101234", "mainProfessor": "PRF-101", "professors": ["PRF-101", "PRF-102"] } ]'
              rows={6}
              className="text-xs bg-background resize-none font-sans leading-relaxed"
              dir="ltr"
            />
          </div>

          {/* Validation Parse Error */}
          {parseError && (
            <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Parsed Preview Mini List */}
          {parsedData && parsedData.length > 0 && !result && (
            <div className="space-y-2 rounded-2xl border border-border/80 bg-muted/20 p-3">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                پیش‌نمایش ارائه‌های آماده ثبت ({parsedData.length} مورد):
              </span>

              <div className="max-h-36 overflow-y-auto space-y-1.5 text-xs pr-1">
                {parsedData.slice(0, 10).map((o, idx) => {
                  const courseDesc = o.courseCode || "کد درس نامشخص";
                  const profDesc =
                    Array.isArray(o.professors) && o.professors.length > 0
                      ? o.professors.join("، ")
                      : o.mainProfessor || "اساتید نامشخص";
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-xl bg-card border border-border/70 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Badge variant="outline" className="text-[10px] font-semibold">
                          {o.code || "بدون کد"}
                        </Badge>
                        <span className="font-semibold truncate text-foreground">درس: {courseDesc}</span>
                        <span className="text-muted-foreground text-[10px]">استاد اصلی: {o.mainProfessor || "---"}</span>
                        <span className="text-primary truncate">اساتید: {profDesc}</span>
                      </div>
                    </div>
                  );
                })}
                {parsedData.length > 10 && (
                  <span className="text-[11px] text-muted-foreground block text-center pt-1">
                    ... و {parsedData.length - 10} ارائه دیگر
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Result Stats Banner */}
          {result && (
            <div
              className={`p-4 rounded-2xl border space-y-2 text-xs ${
                result.success
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
                <span>{result.message}</span>
              </div>

              {result.stats && (
                <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
                  <div className="bg-background/80 p-2 rounded-xl border">
                    <span className="text-muted-foreground block text-[10px]">کل ردیف‌ها</span>
                    <span className="font-bold text-foreground">{result.stats.total}</span>
                  </div>
                  <div className="bg-background/80 p-2 rounded-xl border">
                    <span className="text-muted-foreground block text-[10px]">ارائه‌های جدید</span>
                    <span className="font-bold text-emerald-600">{result.stats.created}</span>
                  </div>
                  <div className="bg-background/80 p-2 rounded-xl border">
                    <span className="text-muted-foreground block text-[10px]">به‌روزشده</span>
                    <span className="font-bold text-primary">{result.stats.updated}</span>
                  </div>
                </div>
              )}

              {result.stats?.errors && result.stats.errors.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-border/40 text-[11px] text-destructive">
                  <span className="font-semibold block">هشدارها و خطاهای رخ‌داده:</span>
                  <ul className="list-disc list-inside space-y-0.5 max-h-24 overflow-y-auto">
                    {result.stats.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={loading || (!jsonText && !result)}
              className="h-8 text-xs"
            >
              پاک‌سازی فرم
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 text-xs"
              >
                بستن
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleImportSubmit}
                disabled={
                  loading ||
                  !parsedData ||
                  parsedData.length === 0 ||
                  !(selectedFacultyId || targetFaculty?.id || defaultFacultyId)
                }
                className={`h-8 text-xs font-bold gap-1.5 px-4 ${
                  importMode === "replace"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : ""
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    در حال اعمال تغییرات...
                  </>
                ) : importMode === "replace" ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" />
                    جایگزینی کامل ارائه‌های {activeFaculty?.name || ""}
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    ثبت ارائه‌ها در {activeFaculty?.name || "دانشکده"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
