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
  FolderTree,
  AlertTriangle,
  CheckCircle2,
  FileCode,
  Sparkles,
  Layers,
  BookOpen,
} from "lucide-react";
import { postJson } from "@/lib/api-client";

interface CategoryImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackId?: string;
  trackName?: string;
  onSuccess?: () => void;
}

export const CATEGORY_SCHEMA_DESCRIPTOR = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "قالب و اسناد ورود دسته‌ها (Categories JSON Schema)",
  description: "اسکیمای استاندارد برای ورود دسته‌ای ساختار درختی دسته‌ها و انتساب دروس (پشتیبانی از عمق دلخواه)",
  type: "array",
  items: {
    $ref: "#/$defs/categoryNode",
  },
  $defs: {
    categoryNode: {
      type: "object",
      required: ["code", "name"],
      properties: {
        code: {
          type: "string",
          description: "کد شناسایی یکتای دسته (الزامی و معیار تطبیق)",
          example: "CAT-CORE",
        },
        name: {
          type: "string",
          description: "نام کامل دسته (الزامی)",
          example: "دروس تخصصی و اصلی",
        },
        color: {
          type: "string",
          description: "کد رنگ هگزادسیمال دسته (اختیاری، پیش‌فرض: #3b82f6)",
          example: "#3b82f6",
        },
        courses: {
          type: "array",
          items: {
            type: "string",
          },
          description: "لیست کدهای رسمی دروسی که مستقیماً به این دسته اختصاص می‌یابند (اختیاری)",
          example: ["8101234", "8101567"],
        },
        children: {
          type: "array",
          items: {
            $ref: "#/$defs/categoryNode",
          },
          description: "لیست زیردسته‌های این دسته به صورت بازگشتی (اختیاری، با عمق نامحدود)",
        },
      },
      additionalProperties: false,
    },
  },
  examples: [
    [
      {
        code: "CAT-CORE",
        name: "دروس تخصصی و اصلی",
        color: "#3b82f6",
        courses: ["8101234", "8101567"],
        children: [
          {
            code: "CAT-CORE-MATH",
            name: "ریاضیات و علوم پایه",
            color: "#10b981",
            courses: ["8101101", "8101102"],
            children: [],
          },
          {
            code: "CAT-CORE-ELEC",
            name: "مدارهای الکتریکی و الکترونیک",
            color: "#8b5cf6",
            courses: ["8101201"],
            children: [],
          },
        ],
      },
      {
        code: "CAT-GEN",
        name: "دروس عمومی",
        color: "#f59e0b",
        courses: ["8101001", "8101002"],
        children: [],
      },
    ],
  ],
};

export function CategoryImportDialog({
  open,
  onOpenChange,
  trackId,
  trackName,
  onSuccess,
}: CategoryImportDialogProps) {
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
    const jsonStr = JSON.stringify(CATEGORY_SCHEMA_DESCRIPTOR, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "categories-schema.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper to count statistics from hierarchical tree
  const treeStats = useMemo(() => {
    if (!parsedData || !Array.isArray(parsedData)) return null;

    let totalCategories = 0;
    let totalCourses = 0;
    let maxDepth = 0;

    function traverse(nodes: any[], currentDepth: number) {
      if (currentDepth > maxDepth) maxDepth = currentDepth;
      for (const node of nodes) {
        if (node && typeof node === "object") {
          totalCategories++;
          const courses = node.courses ?? node.courseCodes;
          if (Array.isArray(courses)) {
            totalCourses += courses.length;
          }
          const children = node.children ?? node.subcategories;
          if (Array.isArray(children) && children.length > 0) {
            traverse(children, currentDepth + 1);
          }
        }
      }
    }

    traverse(parsedData, 1);
    return { totalCategories, totalCourses, maxDepth };
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
        : (parsed.categories || parsed.items || (parsed.examples && parsed.examples[0]));

      if (!Array.isArray(list)) {
        setParseError("فرمت ورودی نامعتبر است: داده‌ها باید یک آرایه شامل حداقل یک دسته باشند.");
        setParsedData(null);
        return;
      }

      // Quick validate root elements
      for (const item of list) {
        if (!item || typeof item !== "object") {
          setParseError("آیتم‌های آرایه باید شیء باشند.");
          setParsedData(null);
          return;
        }
        if (!item.name || typeof item.name !== "string") {
          setParseError("فیلد name برای تمام دسته‌ها الزامی است.");
          setParsedData(null);
          return;
        }
        if (!item.code || typeof item.code !== "string") {
          setParseError("فیلد code برای تمام دسته‌ها الزامی است.");
          setParsedData(null);
          return;
        }
      }

      setParsedData(list);
    } catch (err: any) {
      setParseError(err.message || "خطا در تجزیه JSON");
      setParsedData(null);
    }
  };

  // Upload File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleTextChange(content);
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  // Submit Import
  const handleImport = async () => {
    if (!trackId || !parsedData) return;

    setIsLoading(true);
    setResult(null);

    try {
      const res = await postJson("/api/tracks/categories/import", {
        trackId,
        categories: parsedData,
      });

      setResult(res);

      if (res.success && onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message || "خطای غیرمنتظره در ارتباط با سرور",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Insert Example Template
  const handleInsertExample = () => {
    handleTextChange(JSON.stringify(CATEGORY_SCHEMA_DESCRIPTOR.examples[0], null, 2));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden" dir="rtl">
        <DialogHeader className="p-4 pb-3 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderTree className="h-5 w-5 text-primary shrink-0" />
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>ورود ساختار دسته‌ها (JSON Import)</span>
                {trackName && (
                  <Badge variant="outline" className="text-xs font-normal">
                    {trackName}
                  </Badge>
                )}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadSchema}
                className="h-8 text-xs gap-1.5 shadow-2xs font-normal"
                title="دانلود فایل JSON Schema رسمی جهت اعتبارسنجی در ویرایشگرها"
              >
                <Download className="h-3.5 w-3.5 text-muted-foreground" />
                دانلود اسکیما
              </Button>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            با وارد کردن ساختار درختی دسته‌ها، اطلاعات دسته‌بندی و انتساب دروس با ساختار فعلی ادغام می‌گردد.
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar */}
        <div className="p-3 border-b bg-background flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json,application/json"
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 text-xs gap-1.5 font-normal shadow-2xs"
            >
              <Upload className="h-3.5 w-3.5 text-primary" />
              انتخاب فایل JSON
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleInsertExample}
              className="h-8 text-xs gap-1.5 font-normal text-muted-foreground hover:text-foreground"
            >
              <FileCode className="h-3.5 w-3.5" />
              درج نمونه الگو
            </Button>
          </div>

          {treeStats && (
            <div className="flex items-center gap-2 text-xs font-medium">
              <Badge variant="secondary" className="gap-1 font-normal py-0.5">
                <FolderTree className="h-3 w-3 text-primary" />
                {treeStats.totalCategories} دسته
              </Badge>
              <Badge variant="secondary" className="gap-1 font-normal py-0.5">
                <Layers className="h-3 w-3 text-primary" />
                عمق {treeStats.maxDepth} لایه
              </Badge>
              <Badge variant="secondary" className="gap-1 font-normal py-0.5">
                <BookOpen className="h-3 w-3 text-primary" />
                {treeStats.totalCourses} درس منتسب
              </Badge>
            </div>
          )}
        </div>

        {/* Code Editor Area */}
        <div className="flex-1 p-3 min-h-60 max-h-96 flex flex-col gap-2 overflow-hidden bg-muted/10">
          <CodeEditor
            value={jsonText}
            onChange={handleTextChange}
            placeholder="محتوای فایل JSON دسته‌ها را اینجا قرار دهید..."
            className="flex-1 text-xs font-mono rounded-xl border border-border/70"
          />

          {parseError && (
            <div className="p-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {result && (
            <div
              className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                result.success
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                )}
                <span>{result.message}</span>
              </div>
              {result.stats && (
                <div className="text-[11px] space-y-1 opacity-90 pr-6">
                  <div>
                    تعداد دسته‌های ایجاد شده: <b>{result.stats.categoriesCreated}</b> | به‌روزرسانی شده:{" "}
                    <b>{result.stats.categoriesUpdated}</b> | دروس منتسب شده: <b>{result.stats.coursesAssigned}</b>
                  </div>
                  {result.stats.warnings && result.stats.warnings.length > 0 && (
                    <div className="pt-1 text-amber-700 dark:text-amber-400 space-y-0.5">
                      <div className="font-semibold">هشدارها:</div>
                      {result.stats.warnings.slice(0, 3).map((w, idx) => (
                        <div key={idx}>• {w}</div>
                      ))}
                      {result.stats.warnings.length > 3 && (
                        <div>... و {result.stats.warnings.length - 3} مورد دیگر</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-muted/40 flex items-center justify-between">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>دسته‌ها بر اساس کد شناسایی (code) تطبیق داده شده و فیلد رنگ و زیردسته‌ها به‌روز می‌گردند.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 px-3 text-xs"
            >
              بستن
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isLoading || !parsedData || Boolean(parseError)}
              onClick={handleImport}
              className="h-8 px-4 text-xs font-bold gap-1.5"
            >
              {isLoading ? "در حال ورود..." : "شروع ورود داده‌ها"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
