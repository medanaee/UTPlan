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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Faculty } from "@/lib/types";

interface CourseImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultFacultyId?: string;
  onSuccess?: () => void;
}

const SAMPLE_TEMPLATE = [
  {
    code: "8101101",
    name: "مبانی کامپیوتر و برنامه‌سازی",
    units: 3,
    offeredIn: "both",
    description: "مفاهیم پایه برنامه‌نویسی و حل مسئله.",
    prerequisites: [],
    corequisites: []
  },
  {
    code: "8101234",
    name: "برنامه‌نویسی پیشرفته",
    units: 3,
    offeredIn: "both",
    description: "مفاهیم برنامه‌نویسی شیءگرا و الگوهای طراحی.",
    prerequisites: ["8101101"],
    corequisites: []
  },
  {
    code: "8101240",
    name: "ساختمان داده‌ها و الگوریتم‌ها",
    units: 3,
    offeredIn: "fall",
    description: "ساختارهای داده خطی و غیرخطی و تحلیل الگوریتم‌ها.",
    prerequisites: ["8101234"],
    corequisites: []
  }
];

export function CourseImportDialog({
  open,
  onOpenChange,
  defaultFacultyId,
  onSuccess,
}: CourseImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>(defaultFacultyId || "");

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
      prerequisitesAdded: number;
      errors: string[];
    };
  } | null>(null);

  // Load faculties
  useEffect(() => {
    fetch("/api/faculties")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data)) {
          setFaculties(d.data);
          if (!selectedFacultyId && d.data.length > 0) {
            setSelectedFacultyId(defaultFacultyId || d.data[0].id);
          }
        }
      })
      .catch(() => {});
  }, [defaultFacultyId]);

  useEffect(() => {
    if (defaultFacultyId) {
      setSelectedFacultyId(defaultFacultyId);
    }
  }, [defaultFacultyId]);

  const handleDownloadSample = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(SAMPLE_TEMPLATE, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "sample-courses.json");
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
      const list = Array.isArray(parsed) ? parsed : parsed.courses;
      if (!Array.isArray(list)) {
        setParseError("فایل JSON باید شامل یک آرایه از دروس باشد.");
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
    if (!selectedFacultyId) {
      alert("لطفاً دانشکده مقصد را مشخص کنید.");
      return;
    }

    try {
      setLoading(true);
      setResult(null);

      const res = await fetch(`/api/courses/import?facultyId=${selectedFacultyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facultyId: selectedFacultyId,
          courses: parsedData,
        }),
      }).then((r) => r.json());

      setResult(res);

      if (res.success && onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: "خطا در ارتباط با سرور هنگام ورود اطلاعات.",
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
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-2 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              ورود دسته‌ای دروس (Import JSON)
            </DialogTitle>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadSample}
              className="h-7 text-xs gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              دانلود قالب نمونه JSON
            </Button>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            مشخصات دروس و پیش‌نیازها را در قالب فایل JSON وارد دانشکده انتخابی کنید.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Target Faculty Selector */}
          <div className="p-3 rounded-2xl border border-border/80 bg-muted/20 space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-primary" />
              دانشکده مقصد برای ثبت دروس:
            </Label>
            <Select value={selectedFacultyId} onValueChange={setSelectedFacultyId}>
              <SelectTrigger className="w-full text-xs h-9 bg-background">
                <SelectValue placeholder="انتخاب دانشکده" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {faculties.map((f) => (
                    <SelectItem key={f.id} value={f.id} className="text-xs">
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* File Upload Area */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl border border-dashed border-primary/40 bg-primary/5">
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

          {/* Textarea Paste */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>یا متن JSON را مستقیماً اینجا وارد کنید:</span>
              {parsedData && (
                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                  {parsedData.length} درس معتبر شناسایی شد
                </Badge>
              )}
            </div>
            <Textarea
              value={jsonText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder='[ { "code": "8101234", "name": "برنامه‌نویسی پیشرفته", "units": 3, "prerequisites": ["8101101"] } ]'
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
                پیش‌نمایش دروس آماده ثبت ({parsedData.length} درس):
              </span>

              <div className="max-h-36 overflow-y-auto space-y-1.5 text-xs pr-1">
                {parsedData.slice(0, 10).map((c, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-card border border-border/70 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Badge variant="outline" className="text-[10px]">
                        {c.code || "بدون کد"}
                      </Badge>
                      <span className="font-semibold truncate text-foreground">{c.name || "بدون نام"}</span>
                      <span className="text-[11px] text-muted-foreground">({c.units || 3} واحد)</span>
                    </div>

                    {c.prerequisites && c.prerequisites.length > 0 && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {c.prerequisites.length} پیش‌نیاز
                      </span>
                    )}
                  </div>
                ))}
                {parsedData.length > 10 && (
                  <span className="text-[11px] text-muted-foreground block text-center pt-1">
                    ... و {parsedData.length - 10} درس دیگر
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-center text-xs">
                  <div className="bg-background/80 p-2 rounded-xl border">
                    <span className="text-muted-foreground block text-[10px]">کل ردیف‌ها</span>
                    <span className="font-bold text-foreground">{result.stats.total}</span>
                  </div>
                  <div className="bg-background/80 p-2 rounded-xl border">
                    <span className="text-muted-foreground block text-[10px]">دروس جدید</span>
                    <span className="font-bold text-emerald-600">{result.stats.created}</span>
                  </div>
                  <div className="bg-background/80 p-2 rounded-xl border">
                    <span className="text-muted-foreground block text-[10px]">به‌روزشده</span>
                    <span className="font-bold text-primary">{result.stats.updated}</span>
                  </div>
                  <div className="bg-background/80 p-2 rounded-xl border">
                    <span className="text-muted-foreground block text-[10px]">پیش‌نیازها</span>
                    <span className="font-bold text-foreground">{result.stats.prerequisitesAdded}</span>
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
                disabled={loading || !parsedData || parsedData.length === 0 || !selectedFacultyId}
                className="h-8 text-xs font-bold gap-1.5 px-4"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    در حال ورود اطلاعات...
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    ثبت در دانشکده انتخابی
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
