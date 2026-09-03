"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  Download,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  Calendar,
  Building2,
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
import { formatSemesterLabel } from "@/lib/semester-utils";

interface EventImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTerm: string;
  selectedFacultyId?: string;
  facultyName?: string;
  onSuccess?: () => void;
}

export const EVENT_SCHEMA_DESCRIPTOR = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "قالب و اسناد ورود رویدادها (Events JSON Schema)",
  description: "اسکیمای استاندارد برای ورود دسته‌ای زمان‌بندی جلسات هفتگی و آزمون‌های پایان‌ترم",
  type: "array",
  items: {
    type: "object",
    required: ["code", "offeringCode", "slots"],
    properties: {
      code: {
        type: "string",
        description: "کد شناسایی یکتای رویداد (الزامی و تنها معیار تطبیق)",
        example: "EVT-101",
      },
      offeringCode: {
        type: "string",
        description: "کد شناسایی یکتای ارائه درسی مربوطه (الزامی)",
        example: "OFF-101",
      },
      location: {
        type: "string",
        description: "محل تشکیل کلاس یا شماره اتاق (اختیاری)",
        example: "دانشکده فنی - کلاس ۱۰۲",
      },
      examDate: {
        type: "string",
        pattern: "^\\d{4}/\\d{2}/\\d{2}$",
        description: "تاریخ آزمون پایانی به فرمت شمسی YYYY/MM/DD (اختیاری)",
        example: "1403/10/22",
      },
      examStartTime: {
        type: "string",
        pattern: "^\\d{2}:\\d{2}$",
        description: "ساعت شروع آزمون به فرمت HH:MM (اختیاری)",
        example: "08:30",
      },
      examEndTime: {
        type: "string",
        pattern: "^\\d{2}:\\d{2}$",
        description: "ساعت پایان آزمون به فرمت HH:MM (اختیاری)",
        example: "11:00",
      },
      slots: {
        type: "array",
        minItems: 1,
        description: "لیست جلسات هفتگی کلاس با حداقل یک جلسه (الزامی)",
        items: {
          type: "object",
          required: ["dayOfWeek", "startTime", "endTime"],
          properties: {
            dayOfWeek: {
              type: "integer",
              minimum: 0,
              maximum: 5,
              description: "روز هفته (۰: شنبه، ۱: یکشنبه، ۲: دوشنبه، ۳: سه‌شنبه، ۴: چهارشنبه، ۵: پنج‌شنبه)",
              example: 0,
            },
            startTime: {
              type: "string",
              pattern: "^\\d{2}:\\d{2}$",
              description: "ساعت شروع جلسه (الزامی)",
              example: "10:30",
            },
            endTime: {
              type: "string",
              pattern: "^\\d{2}:\\d{2}$",
              description: "ساعت پایان جلسه (الزامی)",
              example: "12:00",
            },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  },
  examples: [
    [
      {
        code: "EVT-101",
        offeringCode: "OFF-101",
        location: "دانشکده فنی - کلاس ۱۰۲",
        examDate: "1403/10/22",
        examStartTime: "08:30",
        examEndTime: "11:00",
        slots: [
          { dayOfWeek: 0, startTime: "10:30", endTime: "12:00" },
          { dayOfWeek: 2, startTime: "10:30", endTime: "12:00" },
        ],
      },
      {
        code: "EVT-102",
        offeringCode: "OFF-102",
        location: "تالار ابوریحان",
        examDate: "1403/10/25",
        examStartTime: "14:00",
        examEndTime: "16:30",
        slots: [
          { dayOfWeek: 1, startTime: "08:00", endTime: "09:30" },
        ],
      },
    ],
  ],
};

export function EventImportDialog({
  open,
  onOpenChange,
  activeTerm,
  selectedFacultyId,
  facultyName,
  onSuccess,
}: EventImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jsonText, setJsonText] = useState("");
  const [parsedData, setParsedData] = useState<any[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    stats?: {
      created: number;
      updated: number;
      totalSlots: number;
      warnings?: string[];
      errors?: string[];
    };
  } | null>(null);

  const handleDownloadSchemaDescriptor = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(EVENT_SCHEMA_DESCRIPTOR, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "events-schema.json");
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
      const list = Array.isArray(parsed)
        ? parsed
        : parsed.events || parsed.items || parsed.data || parsed.examples?.[0];

      if (!Array.isArray(list)) {
        setParseError("فایل JSON باید شامل یک آرایه از رویدادها باشد.");
        setParsedData(null);
        return;
      }

      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        if (!it.code || typeof it.code !== "string") {
          setParseError(`ردیف ${i + 1}: فیلد 'code' الزامی است.`);
          setParsedData(null);
          return;
        }
        if (!it.offeringCode || typeof it.offeringCode !== "string") {
          setParseError(`ردیف ${i + 1} (کد ${it.code}): فیلد 'offeringCode' الزامی است.`);
          setParsedData(null);
          return;
        }
        if (!Array.isArray(it.slots) || it.slots.length === 0) {
          setParseError(`ردیف ${i + 1} (کد ${it.code}): داشتن حداقل یک اسلات در 'slots' الزامی است.`);
          setParsedData(null);
          return;
        }
      }

      setParsedData(list);
      setParseError(null);
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

    try {
      setLoading(true);
      setResult(null);

      const res = await fetch("/api/events/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term: activeTerm,
          facultyId: selectedFacultyId,
          events: parsedData,
        }),
      }).then((r) => r.json());

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
            <Calendar className="h-5 w-5 text-primary" />
            ورود دسته‌ای رویدادها (Import JSON)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            مشخصات جلسات کلاسی، محل تشکیل و زمان آزمون‌ها را در قالب فایل استاندارد JSON وارد نیمسال کنید.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Target Fixed Card */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="h-4 w-4 text-primary shrink-0" />
              <span className="text-muted-foreground">نیمسال هدف:</span>
              <span className="font-bold text-foreground">
                {formatSemesterLabel(activeTerm)} ({activeTerm})
              </span>
              {facultyName && (
                <>
                  <span className="text-muted-foreground mr-2">| دانشکده:</span>
                  <span className="font-semibold text-foreground">{facultyName}</span>
                </>
              )}
            </div>
          </div>

          {/* Detailed Schema Descriptor Download Banner */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span>فایل توصیف‌کننده اسکیمای استاندارد JSON رویدادها:</span>
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
              <span className="text-xs font-bold text-foreground block">انتخاب فایل رویدادها از سیستم</span>
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
                  {parsedData.length} رویداد معتبر شناسایی شد
                </Badge>
              )}
            </div>
            <CodeEditor
              value={jsonText}
              onChange={handleTextChange}
              placeholder='[ { "code": "EVT-101", "offeringCode": "OFF-101", "location": "کلاس ۱۰۲", "slots": [ { "dayOfWeek": 0, "startTime": "10:30", "endTime": "12:00" } ] } ]'
              maxHeight="18rem"
              minHeight="10rem"
              title="ویرایشگر ساختار JSON رویدادها"
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
                پیش‌نمایش رویدادهای آماده ثبت ({parsedData.length} رویداد):
              </span>

              <div className="max-h-36 overflow-y-auto space-y-1.5 text-xs pr-1">
                {parsedData.slice(0, 10).map((evt, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-card border border-border/70 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Badge
                        variant={evt.code ? "outline" : "destructive"}
                        className="text-[10px] font-mono font-bold"
                      >
                        {evt.code || "فاقد کد"}
                      </Badge>
                      <span className="font-semibold truncate text-foreground">ارائه: {evt.offeringCode}</span>
                      {evt.location && (
                        <span className="text-[11px] text-muted-foreground">({evt.location})</span>
                      )}
                    </div>

                    <div className="text-[10px] text-muted-foreground shrink-0 font-medium">
                      {Array.isArray(evt.slots) ? `${evt.slots.length} جلسه هفتگی` : "بدون جلسه"}
                    </div>
                  </div>
                ))}
                {parsedData.length > 10 && (
                  <span className="text-[11px] text-muted-foreground block text-center pt-1">
                    ... و {parsedData.length - 10} رویداد دیگر
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
                    <span className="text-muted-foreground block text-[10px]">رویدادهای جدید</span>
                    <span className="font-bold text-emerald-600">{result.stats.created}</span>
                  </div>
                  <div className="bg-background/80 p-2 rounded-xl border">
                    <span className="text-muted-foreground block text-[10px]">به‌روزشده</span>
                    <span className="font-bold text-primary">{result.stats.updated}</span>
                  </div>
                  <div className="bg-background/80 p-2 rounded-xl border">
                    <span className="text-muted-foreground block text-[10px]">کل جلسات کلاسی</span>
                    <span className="font-bold text-foreground">{result.stats.totalSlots}</span>
                  </div>
                </div>
              )}

              {result.stats?.warnings && result.stats.warnings.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-border/40 text-[11px] text-amber-700 dark:text-amber-400">
                  <span className="font-semibold block">هشدارها و نکات پردازش:</span>
                  <ul className="list-disc list-inside space-y-0.5 max-h-24 overflow-y-auto">
                    {result.stats.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
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
                disabled={loading || !parsedData || parsedData.length === 0}
                className="h-8 text-xs font-bold gap-1.5 px-4"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    در حال اعمال تغییرات...
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    ثبت در {formatSemesterLabel(activeTerm)}
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
