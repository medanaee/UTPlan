"use client";

import { useState } from "react";
import {
  Play,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Layers,
  Calendar,
  BookOpen,
  Check,
  X,
  ShieldCheck,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { validateFullChart, type ChartCourseEntry } from "@/lib/rules-engine";
import type {
  RuleGroupNode,
  RuleCategory,
  Course,
  PrerequisiteRelation,
  TrackCourseAssignment,
  ValidationResult,
} from "@/lib/types";

interface RuleSandboxTesterProps {
  trackId: string;
  trackName: string;
  rulesTree?: RuleGroupNode | null;
  ruleCategories: RuleCategory[];
  courses: Course[];
  prerequisites: PrerequisiteRelation[];
  trackAssignments: TrackCourseAssignment[];
}

export function RuleSandboxTester({
  trackId,
  trackName,
  rulesTree,
  ruleCategories,
  courses,
  prerequisites,
  trackAssignments,
}: RuleSandboxTesterProps) {
  // 8 terms array of courses
  const [termCourses, setTermCourses] = useState<Map<number, string[]>>(() => {
    const map = new Map<number, string[]>();
    for (let i = 1; i <= 8; i++) map.set(i, []);
    return map;
  });

  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // Quick preset sample chart (UT-ECE Software Engineering Sample)
  const loadSampleChart = () => {
    const sample = new Map<number, string[]>([
      [1, ["crs_math1", "crs_phys1", "crs_prog", "crs_discrete", "crs_fa"]], // 15 credits (Phys1 coreq Math1, Discrete coreq Prog)
      [2, ["crs_math2", "crs_phys2", "crs_ap", "crs_logic", "crs_en"]],     // 15 credits (Math2 prereq Math1, Phys2 prereq Phys1, AP prereq Prog)
      [3, ["crs_diff", "crs_ds", "crs_arch", "crs_islam"]],                  // 11 credits (DS prereq AP, Arch prereq Logic)
      [4, ["crs_algo", "crs_os", "crs_os_lab", "crs_pe1"]],                  // 8 credits (Algo prereq DS, OS prereq DS+Arch)
      [5, ["crs_network", "crs_db"]],                                        // 6 credits (Network prereq OS, DB prereq DS)
      [6, ["crs_se", "crs_ai"]],                                             // 6 credits (SE prereq DB, AI prereq Algo)
      [7, []],
      [8, []],
    ]);
    setTermCourses(sample);
    setValidationResult(null);
  };

  const handleAddCourseToTerm = (termIndex: number, courseId: string) => {
    if (!courseId) return;

    setTermCourses((prev) => {
      const next = new Map(prev);
      const list = next.get(termIndex) || [];
      // If course is already in another term, remove it from there
      next.forEach((cList, tIdx) => {
        next.set(
          tIdx,
          cList.filter((id) => id !== courseId)
        );
      });
      next.set(termIndex, [...list, courseId]);
      return next;
    });
    setValidationResult(null);
  };

  const handleRemoveCourseFromTerm = (termIndex: number, courseId: string) => {
    setTermCourses((prev) => {
      const next = new Map(prev);
      const list = next.get(termIndex) || [];
      next.set(
        termIndex,
        list.filter((id) => id !== courseId)
      );
      return next;
    });
    setValidationResult(null);
  };

  const handleClearAll = () => {
    const empty = new Map<number, string[]>();
    for (let i = 1; i <= 8; i++) empty.set(i, []);
    setTermCourses(empty);
    setValidationResult(null);
  };

  const handleRunValidation = () => {
    const chartEntries: ChartCourseEntry[] = [];
    termCourses.forEach((cList, termIndex) => {
      for (const courseId of cList) {
        chartEntries.push({ courseId, termIndex });
      }
    });

    const result = validateFullChart({
      chartCourses: chartEntries,
      rulesTree,
      ruleCategories,
      trackAssignments,
      allCourses: courses,
      prerequisites,
      constraints: {
        minCreditsPerTerm: 12,
        maxCreditsPerTerm: 20,
      },
    });

    setValidationResult(result);
  };

  const allSelectedIds = new Set(Array.from(termCourses.values()).flat());

  return (
    <Card className="border-border/70 shadow-xs">
      <CardHeader className="border-b pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-emerald-600" />
              <CardTitle className="text-sm font-bold">
                شبیه‌ساز و تست زنده موتور قوانین: «{trackName}»
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              دروس را در ترم‌های ۱ تا ۸ بچینید و عملکرد لحظه‌ای موتور اعتبارسنجی، پیش‌نیازها و شروط را بررسی کنید.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadSampleChart}
              className="h-8 gap-1.5 border-primary/30 text-xs text-primary hover:bg-primary/5"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              بارگذاری چارت نمونه آزمایشی
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-8 gap-1 text-xs text-muted-foreground hover:text-destructive"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              پاک‌سازی
            </Button>

            <Button
              size="sm"
              onClick={handleRunValidation}
              className="h-8 gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              اجرای اعتبارسنجی قوانین
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ========================================================================= */}
        {/* VALIDATION REPORT BANNER */}
        {/* ========================================================================= */}
        {validationResult && (
          <div className="space-y-4 rounded-2xl border p-4 shadow-sm transition-all bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2.5">
                {validationResult.isValid ? (
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold">
                    {validationResult.isValid
                      ? "چارت کاملاً معتبر است و تمام شروط فارغ‌التحصیلی احراز شده‌اند!"
                      : "چارت دارای خطاها یا هشدارهای قوانین است"}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    مجموع واحدهای چیده‌شده:{" "}
                    <span className="font-bold text-foreground">
                      {validationResult.totalCredits} واحد
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant={validationResult.isGraduationSatisfied ? "default" : "destructive"}
                  className="text-xs"
                >
                  {validationResult.isGraduationSatisfied
                    ? "شروط فارغ‌التحصیلی: تایید"
                    : "شروط فارغ‌التحصیلی: ناقص"}
                </Badge>
              </div>
            </div>

            {/* Category Stats Grid */}
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {validationResult.categoryStats.map((stat) => (
                <div
                  key={stat.categoryId}
                  className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{stat.categoryName}</span>
                    {stat.isSatisfied ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-0.5 text-[10px]">
                        <Check className="h-3 w-3" /> پاس شد
                      </span>
                    ) : (
                      <span className="text-destructive font-bold flex items-center gap-0.5 text-[10px]">
                        <X className="h-3 w-3" /> ناقص
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>واحدهای گذرانده:</span>
                    <span className="font-bold text-foreground">
                      {stat.earnedCredits} {stat.requiredCredits ? `/ ${stat.requiredCredits}` : ""} واحد
                      {stat.maxCredits !== undefined ? ` (سقف: ${stat.maxCredits})` : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Issues List */}
            {validationResult.issues.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-bold text-muted-foreground">
                  لیست موارد گزارش‌شده ({validationResult.issues.length} مورد):
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {validationResult.issues.map((issue) => (
                    <div
                      key={issue.id}
                      className={`flex items-start gap-2 rounded-lg border p-2.5 text-xs ${
                        issue.type === "error"
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                      }`}
                    >
                      {issue.type === "error" ? (
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span>{issue.message}</span>
                        {issue.termIndex && (
                          <span className="mr-1.5 text-[10px] opacity-80">
                            [ترم {issue.termIndex}]
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 8 TERMS GRID */}
        {/* ========================================================================= */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, idx) => {
            const termNum = idx + 1;
            const courseIds = termCourses.get(termNum) || [];
            const termUnits = courseIds.reduce((sum, cId) => {
              const c = courses.find((item) => item.id === cId);
              return sum + (c ? c.units : 3);
            }, 0);

            return (
              <div
                key={termNum}
                className="flex flex-col justify-between rounded-xl border border-border/80 bg-card p-3 shadow-2xs space-y-3"
              >
                {/* Term Header */}
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-bold">ترم {termNum}</span>
                  </div>
                  <Badge
                    variant={termUnits < 12 && termNum < 8 ? "outline" : "secondary"}
                    className="text-[10px]"
                  >
                    {termUnits} واحد
                  </Badge>
                </div>

                {/* Courses List in this Term */}
                <div className="space-y-1.5 min-h-25 max-h-45 overflow-y-auto">
                  {courseIds.map((cId) => {
                    const crs = courses.find((item) => item.id === cId);
                    return (
                      <div
                        key={cId}
                        className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-2 py-1.5 text-[11px]"
                      >
                        <div>
                          <span className="font-semibold text-foreground">{crs?.name || cId}</span>
                          <span className="mr-1 text-[10px] text-muted-foreground">({crs?.units || 3}و)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCourseFromTerm(termNum, cId)}
                          className="text-muted-foreground hover:text-destructive text-xs px-1"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}

                  {courseIds.length === 0 && (
                    <p className="text-center text-[10px] text-muted-foreground/60 py-6">
                      بدون درس
                    </p>
                  )}
                </div>

                {/* Add course combobox */}
                {(() => {
                  const availableCourses = courses.filter((c) => !allSelectedIds.has(c.id));

                  return (
                    <Combobox
                      items={availableCourses.map((c) => ({
                        value: c.id,
                        label: c.name,
                        badge: c.code,
                        sublabel: `${c.units} واحد`,
                        keywords: [c.name, c.code],
                      }))}
                      value=""
                      onChange={(val) => {
                        if (val) handleAddCourseToTerm(termNum, val);
                      }}
                      placeholder="+ افزودن درس به این ترم"
                      searchPlaceholder="جستجوی نام یا کد درس..."
                      className="h-7 w-full text-[11px] justify-between"
                    />
                  );
                })()}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
