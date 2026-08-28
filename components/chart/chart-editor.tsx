"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Layers,
  Sparkles,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowRight,
  Search,
  BookOpen,
  Filter,
  Check,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  Info,
  HelpCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { validateFullChart } from "@/lib/rules-engine";
import type {
  StudentChart,
  ChartSemester,
  Course,
  VisualCategory,
  RuleCategory,
  Track,
  RuleGroupNode,
  ValidationResult,
  ValidationIssue,
} from "@/lib/types";

interface ChartEditorProps {
  initialChart: StudentChart;
  allTracks: Track[];
  allCourses: Course[];
  visualCategories: VisualCategory[];
  ruleCategories: RuleCategory[];
}

interface SvgConnection {
  id: string;
  sourceCourseId: string;
  targetCourseId: string;
  type: "prerequisite" | "corequisite";
  sourceSemester: number;
  targetSemester: number;
  isViolation: boolean;
}

export function ChartEditor({
  initialChart,
  allTracks,
  allCourses,
  visualCategories,
  ruleCategories,
}: ChartEditorProps) {
  const router = useRouter();
  const [chart, setChart] = useState<StudentChart>(initialChart);
  const [title, setTitle] = useState(initialChart.title);
  const [selectedTrackId, setSelectedTrackId] = useState(initialChart.trackId);
  const [activeTrack, setActiveTrack] = useState<Track | null>(
    allTracks.find((t) => t.id === initialChart.trackId) || null
  );

  // Search & Category Filter for drawer
  const [drawerSearch, setDrawerSearch] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [showArrows, setShowArrows] = useState(true);

  // Drag & Drop State
  const [draggedCourseId, setDraggedCourseId] = useState<string | null>(null);
  const [dragOverSemester, setDragOverSemester] = useState<number | null>(null);

  // Hovered Course for SVG Arrow Highlighting
  const [hoveredCourseId, setHoveredCourseId] = useState<string | null>(null);

  // Saving & Status
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // References for SVG curve coordinates
  const canvasRef = useRef<HTMLDivElement>(null);
  const cardElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const [svgCurves, setSvgCurves] = useState<
    {
      id: string;
      d: string;
      type: "prerequisite" | "corequisite";
      sourceId: string;
      targetId: string;
      isViolation: boolean;
      isHighlighted: boolean;
      isDimmed: boolean;
    }[]
  >([]);

  // Update track when changed
  useEffect(() => {
    const t = allTracks.find((track) => track.id === selectedTrackId) || null;
    setActiveTrack(t);
  }, [selectedTrackId, allTracks]);

  // Set of courses currently present in the chart
  const placedCourseIdMap = useMemo(() => {
    const map = new Map<string, number>(); // courseId -> semesterNumber
    chart.semesters.forEach((sem) => {
      sem.courseIds.forEach((cId) => {
        map.set(cId, sem.semesterNumber);
      });
    });
    return map;
  }, [chart.semesters]);

  // Total credits in chart
  const totalChartCredits = useMemo(() => {
    let sum = 0;
    chart.semesters.forEach((sem) => {
      sem.courseIds.forEach((cId) => {
        const course = allCourses.find((c) => c.id === cId);
        if (course) sum += course.units;
      });
    });
    return sum;
  }, [chart.semesters, allCourses]);

  // Validate prerequisites, corequisites, term credits, and graduation rules
  const validation = useMemo(() => {
    const chartCourses: { courseId: string; termIndex: number }[] = [];
    chart.semesters.forEach((sem) => {
      sem.courseIds.forEach((cId) => {
        chartCourses.push({ courseId: cId, termIndex: sem.semesterNumber });
      });
    });

    const allTrackAssignments: any[] = [];
    allCourses.forEach((c) => {
      if (c.trackAssignments) allTrackAssignments.push(...c.trackAssignments);
    });

    const allPrereqs: any[] = [];
    allCourses.forEach((c) => {
      if (c.prerequisites) allPrereqs.push(...c.prerequisites);
    });

    const fullResult = validateFullChart({
      chartCourses,
      rulesTree: activeTrack?.rulesTree,
      ruleCategories,
      trackAssignments: allTrackAssignments,
      allCourses,
      prerequisites: allPrereqs,
    });

    const courseViolations = new Set<string>();
    fullResult.issues.forEach((issue) => {
      if (issue.courseId && issue.type === "error") {
        courseViolations.add(issue.courseId);
      }
    });

    // Find last non-empty semester
    let lastNonEmptySem = 1;
    chart.semesters.forEach((sem) => {
      if (sem.courseIds.length > 0) lastNonEmptySem = sem.semesterNumber;
    });

    const semesterCredits = chart.semesters.map((sem) => {
      let semUnits = 0;
      sem.courseIds.forEach((cId) => {
        const c = allCourses.find((course) => course.id === cId);
        if (c) semUnits += c.units;
      });

      return {
        semesterNumber: sem.semesterNumber,
        units: semUnits,
        isOverMax: semUnits > 20,
        isUnderMin: sem.semesterNumber < lastNonEmptySem && semUnits > 0 && semUnits < 12,
      };
    });

    const hasErrors = fullResult.issues.filter((i) => i.type === "error").length > 0;

    return {
      issues: fullResult.issues,
      courseViolations,
      semesterCredits,
      ruleEval: fullResult,
      isGraduationReady: fullResult.isGraduationSatisfied && !hasErrors,
      hasErrors,
    };
  }, [chart.semesters, allCourses, placedCourseIdMap, activeTrack, ruleCategories, totalChartCredits]);

  // Recalculate SVG connection curves
  const updateSvgCurves = useCallback(() => {
    if (!canvasRef.current || !showArrows) {
      setSvgCurves([]);
      return;
    }

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const curves: typeof svgCurves = [];

    chart.semesters.forEach((sem) => {
      sem.courseIds.forEach((targetCourseId) => {
        const targetCourse = allCourses.find((c) => c.id === targetCourseId);
        if (!targetCourse || !targetCourse.prerequisites) return;

        targetCourse.prerequisites.forEach((pr) => {
          const sourceCourseId = pr.requiredCourseId;
          const sourceSem = placedCourseIdMap.get(sourceCourseId);
          if (!sourceSem) return;

          const sourceEl = cardElementsRef.current.get(sourceCourseId);
          const targetEl = cardElementsRef.current.get(targetCourseId);

          if (sourceEl && targetEl) {
            const srcRect = sourceEl.getBoundingClientRect();
            const tgtRect = targetEl.getBoundingClientRect();

            // Source right edge center, Target left edge center (accounting for RTL canvas)
            const x1 = srcRect.left - canvasRect.left + 8;
            const y1 = srcRect.top - canvasRect.top + srcRect.height / 2;

            const x2 = tgtRect.right - canvasRect.left - 8;
            const y2 = tgtRect.top - canvasRect.top + tgtRect.height / 2;

            const dx = Math.abs(x2 - x1) * 0.5;
            const pathData = `M ${x1} ${y1} C ${x1 - dx} ${y1}, ${x2 + dx} ${y2}, ${x2} ${y2}`;

            const isViolation =
              pr.type === "prerequisite" ? sourceSem >= sem.semesterNumber : sourceSem > sem.semesterNumber;

            const isHighlighted =
              hoveredCourseId === targetCourseId || hoveredCourseId === sourceCourseId;
            const isDimmed = hoveredCourseId !== null && !isHighlighted;

            curves.push({
              id: `${sourceCourseId}_to_${targetCourseId}`,
              d: pathData,
              type: pr.type,
              sourceId: sourceCourseId,
              targetId: targetCourseId,
              isViolation,
              isHighlighted,
              isDimmed,
            });
          }
        });
      });
    });

    setSvgCurves(curves);
  }, [chart.semesters, allCourses, placedCourseIdMap, showArrows, hoveredCourseId]);

  // Recalculate curves on state updates or resize
  useEffect(() => {
    const timer = setTimeout(() => {
      updateSvgCurves();
    }, 60);

    window.addEventListener("resize", updateSvgCurves);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateSvgCurves);
    };
  }, [updateSvgCurves, chart.semesters]);

  // Move a course to a specific semester
  const moveCourseToSemester = (courseId: string, targetSemesterNumber: number) => {
    setChart((prev) => {
      // 1. Remove course from any existing semester
      const cleanedSemesters = prev.semesters.map((sem) => ({
        ...sem,
        courseIds: sem.courseIds.filter((id) => id !== courseId),
      }));

      // 2. Add to target semester (if not already there)
      const targetSemIndex = cleanedSemesters.findIndex((s) => s.semesterNumber === targetSemesterNumber);
      if (targetSemIndex !== -1) {
        if (!cleanedSemesters[targetSemIndex].courseIds.includes(courseId)) {
          cleanedSemesters[targetSemIndex].courseIds.push(courseId);
        }
      }

      return {
        ...prev,
        semesters: cleanedSemesters,
      };
    });
  };

  // Remove a course from the entire chart
  const removeCourseFromChart = (courseId: string) => {
    setChart((prev) => ({
      ...prev,
      semesters: prev.semesters.map((sem) => ({
        ...sem,
        courseIds: sem.courseIds.filter((id) => id !== courseId),
      })),
    }));
  };

  // Add new semester (up to 12)
  const addSemester = () => {
    if (chart.semesters.length >= 12) return;
    setChart((prev) => ({
      ...prev,
      semesters: [
        ...prev.semesters,
        { semesterNumber: prev.semesters.length + 1, courseIds: [] },
      ],
    }));
  };

  // Remove last semester (if empty)
  const removeLastSemester = () => {
    if (chart.semesters.length <= 8) return;
    const lastSem = chart.semesters[chart.semesters.length - 1];
    if (lastSem.courseIds.length > 0) {
      if (!confirm(`ترم ${lastSem.semesterNumber} دارای درس است. آیا از حذف آن مطمئن هستید؟`)) {
        return;
      }
    }
    setChart((prev) => ({
      ...prev,
      semesters: prev.semesters.slice(0, -1),
    }));
  };

  // Load official approved default curriculum
  const handleLoadApprovedCurriculum = async () => {
    if (!confirm("آیا از بارگذاری چارت مصوب مطمئن هستید؟ دروس فعلی چارت با چارت استاندارد جایگزین خواهند شد.")) {
      return;
    }

    try {
      const res = await fetch(`/api/charts?trackId=${selectedTrackId}&approved=true`).then((r) => r.json());
      if (res.success && res.data) {
        setChart((prev) => ({
          ...prev,
          semesters: res.data.semesters,
        }));
      } else {
        alert("چارت مصوب رسمی برای این گرایش هنوز تعریف نشده است.");
      }
    } catch {
      alert("خطا در دریافت چارت مصوب");
    }
  };

  // Save chart changes to backend
  const handleSaveChart = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/charts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: chart.id,
          title,
          trackId: selectedTrackId,
          semesters: chart.semesters,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setErrorMsg(res.message || "خطا در ذخیره‌سازی چارت");
      }
    } catch (err: any) {
      setErrorMsg("خطا در برقراری ارتباط با سرور");
    } finally {
      setIsSaving(false);
    }
  };

  // Filter drawer courses
  const filteredDrawerCourses = useMemo(() => {
    return allCourses.filter((course) => {
      // 1. Search query
      if (drawerSearch.trim()) {
        const term = drawerSearch.trim().toLowerCase();
        const matchName = course.name.toLowerCase().includes(term);
        const matchCode = course.code.toLowerCase().includes(term);
        if (!matchName && !matchCode) return false;
      }

      // 2. Category filter
      if (selectedCategoryFilter !== "all") {
        const assignment = course.trackAssignments?.find((a) => a.trackId === selectedTrackId);
        if (assignment?.visualCategoryId !== selectedCategoryFilter) return false;
      }

      return true;
    });
  }, [allCourses, drawerSearch, selectedCategoryFilter, selectedTrackId]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-61px)] bg-background text-foreground select-none">
      {/* ========================================================================= */}
      {/* 1. TOP INTERACTIVE TOOLBAR */}
      {/* ========================================================================= */}
      <div className="sticky top-0 z-30 border-b border-border/70 bg-card/95 backdrop-blur px-4 py-2.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 max-w-[1700px] mx-auto">
          {/* Title & Track Info */}
          <div className="flex items-center gap-3">
            <Link href="/charts">
              <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs px-2 text-muted-foreground hover:text-foreground">
                <ArrowRight className="h-3.5 w-3.5" />
                چارت‌ها
              </Button>
            </Link>

            <div className="flex items-center gap-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-8 text-xs font-bold w-52 sm:w-64 border-transparent hover:border-border focus:border-primary px-2 transition-colors"
                placeholder="عنوان چارت تحصیلی..."
              />
              <Badge variant="outline" className="text-[11px] h-6 px-2 text-primary border-primary/30">
                {activeTrack?.name || "گرایش انتخاب‌نشده"}
              </Badge>
            </div>
          </div>

          {/* Real-time Validation Status & Stats */}
          <div className="flex items-center gap-2">
            {validation.hasErrors ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive text-xs font-medium border border-destructive/20 shadow-2xs">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{validation.issues.filter((i) => i.type === "error").length} خطای پیش‌نیاز</span>
              </div>
            ) : validation.isGraduationReady ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-500/20 shadow-2xs">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>چارت آماده فارغ‌التحصیلی ({totalChartCredits} واحد)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium border border-amber-500/20 shadow-2xs">
                <Info className="h-3.5 w-3.5" />
                <span>{totalChartCredits} واحد چیده شده (پیش‌نیازها رعایت شده)</span>
              </div>
            )}

            {/* Toggle Arrow Layer */}
            <Button
              size="sm"
              variant={showArrows ? "secondary" : "ghost"}
              onClick={() => setShowArrows(!showArrows)}
              className="h-8 gap-1 text-xs px-2.5 text-muted-foreground"
              title="نمایش / پنهان کردن فلش‌های پیش‌نیاز"
            >
              {showArrows ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">فلش‌های پیش‌نیاز</span>
            </Button>

            {/* Load Approved Curriculum Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleLoadApprovedCurriculum}
              className="h-8 gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/5"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span className="hidden sm:inline">بارگذاری چارت مصوب</span>
            </Button>

            {/* Add / Remove Semester */}
            <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/50">
              <Button
                size="sm"
                variant="ghost"
                onClick={addSemester}
                disabled={chart.semesters.length >= 12}
                className="h-7 text-xs px-2 gap-1 text-foreground"
                title="افزودن یک ترم جدید به انتها"
              >
                <Plus className="h-3 w-3" />
                ترم {chart.semesters.length + 1}
              </Button>
              {chart.semesters.length > 8 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={removeLastSemester}
                  className="h-7 text-xs px-1.5 text-destructive hover:bg-destructive/10"
                  title="حذف آخرین ترم"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Save Button */}
            <Button
              size="sm"
              onClick={handleSaveChart}
              disabled={isSaving}
              className="h-8 gap-1.5 text-xs font-semibold shadow-xs"
            >
              {isSaving ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : saveSuccess ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {saveSuccess ? "ذخیره شد!" : "ذخیره چارت"}
            </Button>
          </div>
        </div>
      </div>

      {/* Error banner if any */}
      {errorMsg && (
        <div className="bg-destructive/15 border-b border-destructive/30 px-4 py-2 text-xs text-destructive flex items-center justify-between">
          <span>{errorMsg}</span>
          <Button size="sm" variant="ghost" onClick={() => setErrorMsg(null)} className="h-6 w-6 p-0 text-destructive">
            <XCircle className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MAIN WORKSPACE: CANVAS + RIGHT DRAWER */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden">
        {/* RIGHT DRAWER: Categorized Course Palette */}
        <aside className="w-80 shrink-0 border-l border-border/70 bg-card/50 flex flex-col justify-between overflow-hidden">
          {/* Drawer Header & Search */}
          <div className="p-3 border-b border-border/70 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                بانک دروس گرایش ({allCourses.length} درس)
              </span>
              <span className="text-[10px] text-muted-foreground">
                {placedCourseIdMap.size} در چارت
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="h-3 w-3 absolute right-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={drawerSearch}
                onChange={(e) => setDrawerSearch(e.target.value)}
                placeholder="جستجوی نام یا کد درس..."
                className="h-8 text-xs pr-8"
              />
            </div>

            {/* Visual Category Chips */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px]">
              <button
                type="button"
                onClick={() => setSelectedCategoryFilter("all")}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                  selectedCategoryFilter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                همه
              </button>
              {visualCategories.map((vcat) => (
                <button
                  key={vcat.id}
                  type="button"
                  onClick={() => setSelectedCategoryFilter(vcat.id)}
                  style={{
                    borderColor: selectedCategoryFilter === vcat.id ? vcat.color : "transparent",
                    backgroundColor: selectedCategoryFilter === vcat.id ? `${vcat.color}20` : undefined,
                    color: selectedCategoryFilter === vcat.id ? vcat.color : undefined,
                  }}
                  className={`px-2 py-0.5 rounded-md border text-[11px] whitespace-nowrap transition-colors ${
                    selectedCategoryFilter !== vcat.id
                      ? "bg-muted text-muted-foreground hover:text-foreground"
                      : "font-bold"
                  }`}
                >
                  {vcat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Drawer Course List (Draggable Cards) */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredDrawerCourses.map((course) => {
              const assignment = course.trackAssignments?.find((a) => a.trackId === selectedTrackId);
              const vcat = visualCategories.find((vc) => vc.id === assignment?.visualCategoryId);
              const placedSem = placedCourseIdMap.get(course.id);
              const isPlaced = placedSem !== undefined;
              const prereqs = course.prerequisites || [];

              return (
                <div
                  key={course.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", course.id);
                    setDraggedCourseId(course.id);
                  }}
                  onDragEnd={() => setDraggedCourseId(null)}
                  onMouseEnter={() => setHoveredCourseId(course.id)}
                  onMouseLeave={() => setHoveredCourseId(null)}
                  style={{
                    borderRightColor: vcat?.color || "#94a3b8",
                    borderRightWidth: "4px",
                  }}
                  className={`p-2.5 rounded-xl border border-border/80 bg-card transition-all cursor-grab active:cursor-grabbing shadow-2xs ${
                    isPlaced
                      ? "opacity-60 bg-muted/40 hover:opacity-100"
                      : "hover:border-primary/50 hover:shadow-xs"
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div>
                      <p className="text-xs font-bold">{course.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{course.code}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                        {course.units} واحد
                      </span>
                      {isPlaced && (
                        <Badge variant="secondary" className="text-[9px] h-4.5 px-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          ترم {placedSem}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Prerequisites tags preview */}
                  {prereqs.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-border/40 flex flex-wrap gap-1">
                      {prereqs.map((pr) => (
                        <span
                          key={pr.id}
                          className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono ${
                            pr.type === "prerequisite"
                              ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
                              : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                          }`}
                        >
                          {pr.type === "prerequisite" ? "پیشنیاز: " : "همنیاز: "}
                          {pr.requiredCourseName || pr.requiredCourseId}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredDrawerCourses.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-10">
                درسی مطابق فیلتر یافت نشد.
              </div>
            )}
          </div>

          {/* Drawer Footer Info */}
          <div className="p-3 border-t border-border/70 bg-muted/20 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>دروس را بکشید و در ترم‌ها رها کنید</span>
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
          </div>
        </aside>

        {/* ========================================================================= */}
        {/* CENTER CANVAS: 8 TO 12 SEMESTER COLUMNS + SVG CONNECTOR ARROWS */}
        {/* ========================================================================= */}
        <main
          ref={canvasRef}
          className="flex-1 relative overflow-x-auto overflow-y-auto p-4 sm:p-6 bg-muted/20"
        >
          {/* Dynamic SVG Connections Overlay */}
          {showArrows && (
            <svg
              className="absolute inset-0 pointer-events-none z-10 w-full h-full"
              style={{ minWidth: `${chart.semesters.length * 280 + 100}px`, minHeight: "800px" }}
            >
              <defs>
                <marker
                  id="arrow-prereq"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#0ea5e9" />
                </marker>
                <marker
                  id="arrow-prereq-violation"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
                </marker>
                <marker
                  id="arrow-coreq"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#a855f7" />
                </marker>
              </defs>

              {svgCurves.map((curve) => (
                <path
                  key={curve.id}
                  d={curve.d}
                  fill="none"
                  stroke={
                    curve.isViolation
                      ? "#ef4444"
                      : curve.type === "prerequisite"
                      ? "#0ea5e9"
                      : "#a855f7"
                  }
                  strokeWidth={curve.isHighlighted ? 2.5 : 1.5}
                  strokeOpacity={
                    curve.isDimmed
                      ? 0.05
                      : curve.isHighlighted
                      ? 1
                      : curve.isViolation
                      ? 0.85
                      : 0.22
                  }
                  strokeDasharray={curve.type === "corequisite" ? "4 3" : undefined}
                  markerEnd={
                    curve.isViolation
                      ? "url(#arrow-prereq-violation)"
                      : curve.type === "prerequisite"
                      ? "url(#arrow-prereq)"
                      : "url(#arrow-coreq)"
                  }
                  className="transition-all duration-150"
                />
              ))}
            </svg>
          )}

          {/* Semesters Columns Grid Container */}
          <div
            className="flex gap-4 items-start relative z-20 pb-12"
            style={{ minWidth: `${chart.semesters.length * 280}px` }}
          >
            {chart.semesters.map((sem, sIdx) => {
              const semStats = validation.semesterCredits.find(
                (sc) => sc.semesterNumber === sem.semesterNumber
              );
              const semUnits = semStats?.units || 0;
              const isOverMax = semStats?.isOverMax || false;
              const isUnderMin = semStats?.isUnderMin || false;
              const isOver = dragOverSemester === sem.semesterNumber;

              return (
                <div
                  key={sem.semesterNumber}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverSemester(sem.semesterNumber);
                  }}
                  onDragLeave={() => setDragOverSemester(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverSemester(null);
                    const courseId = e.dataTransfer.getData("text/plain") || draggedCourseId;
                    if (courseId) {
                      moveCourseToSemester(courseId, sem.semesterNumber);
                    }
                  }}
                  className={`w-72 shrink-0 rounded-2xl border transition-all duration-150 flex flex-col bg-card shadow-2xs ${
                    isOver
                      ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                      : "border-border/80"
                  }`}
                >
                  {/* Semester Column Header */}
                  <div className="p-3 border-b border-border/70 bg-card rounded-t-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
                          {sem.semesterNumber}
                        </span>
                        <h3 className="text-xs font-bold">ترم {sem.semesterNumber}</h3>
                      </div>

                      {/* Total Units Badge */}
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${
                          isOverMax
                            ? "bg-destructive/15 text-destructive border border-destructive/30"
                            : isUnderMin
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {semUnits} واحد
                      </span>
                    </div>

                    {/* Quick Link to Semester Weekly Schedule Planner */}
                    <div className="flex items-center justify-between pt-1">
                      <Link
                        href={`/schedule?chartId=${chart.id}&term=${sem.semesterNumber}`}
                        className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-medium"
                      >
                        <Clock className="h-3 w-3" />
                        <span>برنامه زمانی هفتگی</span>
                        <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                      </Link>

                      <span className="text-[10px] text-muted-foreground/70">
                        {sem.courseIds.length} درس
                      </span>
                    </div>
                  </div>

                  {/* Semester Course Cards (Drop Zone) */}
                  <div className="p-2.5 space-y-2 min-h-[360px] flex-1">
                    {sem.courseIds.map((cId) => {
                      const course = allCourses.find((c) => c.id === cId);
                      if (!course) return null;

                      const assignment = course.trackAssignments?.find(
                        (a) => a.trackId === selectedTrackId
                      );
                      const vcat = visualCategories.find(
                        (vc) => vc.id === assignment?.visualCategoryId
                      );
                      const isViolation = validation.courseViolations.has(cId);
                      const isHovered = hoveredCourseId === cId;

                      return (
                        <div
                          key={cId}
                          ref={(el) => {
                            if (el) cardElementsRef.current.set(cId, el);
                            else cardElementsRef.current.delete(cId);
                          }}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", cId);
                            setDraggedCourseId(cId);
                          }}
                          onDragEnd={() => setDraggedCourseId(null)}
                          onMouseEnter={() => setHoveredCourseId(cId)}
                          onMouseLeave={() => setHoveredCourseId(null)}
                          style={{
                            borderRightColor: vcat?.color || "#94a3b8",
                            borderRightWidth: "4px",
                          }}
                          className={`group relative p-2.5 rounded-xl border bg-background transition-all cursor-grab active:cursor-grabbing shadow-2xs ${
                            isViolation
                              ? "border-destructive ring-1 ring-destructive/40 bg-destructive/5"
                              : isHovered
                              ? "border-primary ring-2 ring-primary/30 shadow-xs"
                              : "border-border/80 hover:border-border"
                          }`}
                        >
                          {/* Course Header */}
                          <div className="flex items-start justify-between gap-1">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold">{course.name}</p>
                                {isViolation && (
                                  <AlertTriangle
                                    className="h-3.5 w-3.5 text-destructive shrink-0 animate-pulse"
                                    title="خطای پیش‌نیاز یا عدم تطابق قوانین"
                                  />
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                {course.code}
                              </p>
                            </div>

                            {/* Remove button */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeCourseFromChart(cId);
                              }}
                              className="h-6 w-6 p-0 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                              title="حذف از این ترم"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>

                          {/* Units & Category Tag */}
                          <div className="mt-2 flex items-center justify-between text-[10px]">
                            <span
                              style={{ color: vcat?.color || undefined }}
                              className="font-medium"
                            >
                              {vcat?.name || "عمومی"}
                            </span>
                            <span className="font-semibold text-muted-foreground">
                              {course.units} واحد
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {sem.courseIds.length === 0 && (
                      <div className="h-full border-2 border-dashed border-border/50 rounded-xl flex flex-col items-center justify-center p-6 text-center text-muted-foreground/60 text-xs">
                        <Layers className="h-5 w-5 mb-1.5 opacity-40" />
                        <span>درسی قرار ندارد</span>
                        <span className="text-[10px] opacity-70">برای افزودن، درس را اینجا رها کنید</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
