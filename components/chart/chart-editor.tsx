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
  Lock,
  Shield,
  Copy,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { validateFullChart } from "@/lib/rules-engine";
import { ThemeToggle } from "@/components/theme-toggle";
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
  UserSession,
} from "@/lib/types";

interface ChartEditorProps {
  initialChart: StudentChart;
  allTracks: Track[];
  allCourses: Course[];
  visualCategories: VisualCategory[];
  ruleCategories: RuleCategory[];
  user?: UserSession | null;
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
  user,
}: ChartEditorProps) {
  const router = useRouter();
  const [chart, setChart] = useState<StudentChart>(initialChart);
  const [title, setTitle] = useState(initialChart.title);
  const [selectedTrackId, setSelectedTrackId] = useState(initialChart.trackId);
  const [activeTrack, setActiveTrack] = useState<Track | null>(
    allTracks.find((t) => t.id === initialChart.trackId) || null
  );

  // Authorization and Read-Only Rules
  const isApprovedChart = Boolean(initialChart.isApprovedDefault);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isOwner = user ? initialChart.userId === user.id : false;
  const isReadOnly = (isApprovedChart && !isAdmin) || (!isApprovedChart && !isOwner && !isAdmin);

  // Search & Category Filter for drawer
  const [drawerSearch, setDrawerSearch] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [showArrows, setShowArrows] = useState(true);

  // Drag & Drop State
  const [draggedCourseId, setDraggedCourseId] = useState<string | null>(null);
  const [dragOverSemester, setDragOverSemester] = useState<number | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

  // Issues & Validation Details Modal
  const [issuesModalOpen, setIssuesModalOpen] = useState(false);

  // Approved Curriculum Selection Modal
  const [loadApprovedModalOpen, setLoadApprovedModalOpen] = useState(false);
  const [approvedChartsList, setApprovedChartsList] = useState<StudentChart[]>([]);
  const [loadingApprovedCharts, setLoadingApprovedCharts] = useState(false);

  // Hovered Course for SVG Arrow Highlighting
  const [hoveredCourseId, setHoveredCourseId] = useState<string | null>(null);

  // Saving & Cloning Status
  const [isSaving, setIsSaving] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Clone approved / read-only chart for current user
  const handleCloneForMe = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    setIsCloning(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/charts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `نسخه من از ${chart.title}`,
          trackId: chart.trackId,
          cloneFromId: chart.id,
        }),
      }).then((r) => r.json());

      if (res.success && res.data) {
        router.push(`/charts/${res.data.id}`);
      } else {
        setErrorMsg(res.message || "خطا در ایجاد نسخه شخصی از چارت");
      }
    } catch {
      setErrorMsg("خطا در برقراری ارتباط با سرور");
    } finally {
      setIsCloning(false);
    }
  };

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
    let total = 0;
    chart.semesters.forEach((sem) => {
      sem.courseIds.forEach((cId) => {
        const c = allCourses.find((course) => course.id === cId);
        if (c) total += c.units;
      });
    });
    return total;
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

  // Recalculate SVG connection curves in absolute scroll content space
  const updateSvgCurves = useCallback(() => {
    if (!canvasRef.current || !showArrows) {
      setSvgCurves([]);
      return;
    }

    const canvas = canvasRef.current;
    const canvasRect = canvas.getBoundingClientRect();
    const scrollTop = canvas.scrollTop;
    const scrollLeft = canvas.scrollLeft;
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

            // Calculate vertical connection in absolute scroll-content space:
            const x1 = srcRect.left - canvasRect.left + scrollLeft + srcRect.width / 2;
            const y1 = srcRect.bottom - canvasRect.top + scrollTop;

            const x2 = tgtRect.left - canvasRect.left + scrollLeft + tgtRect.width / 2;
            const y2 = tgtRect.top - canvasRect.top + scrollTop;

            const dy = Math.max(25, Math.abs(y2 - y1) * 0.4);
            const pathData = `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;

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

    const canvasEl = canvasRef.current;
    if (canvasEl) {
      canvasEl.addEventListener("scroll", updateSvgCurves, { passive: true });
    }

    window.addEventListener("resize", updateSvgCurves);
    return () => {
      clearTimeout(timer);
      if (canvasEl) {
        canvasEl.removeEventListener("scroll", updateSvgCurves);
      }
      window.removeEventListener("resize", updateSvgCurves);
    };
  }, [updateSvgCurves, chart.semesters]);

  // Move a course to a specific semester with optional target index for reordering
  const moveCourseToSemester = (
    courseId: string,
    targetSemesterNumber: number,
    targetIndex?: number
  ) => {
    if (isReadOnly) return;
    setChart((prev) => {
      // 1. Remove course from any existing semester
      const cleanedSemesters = prev.semesters.map((sem) => ({
        ...sem,
        courseIds: sem.courseIds.filter((id) => id !== courseId),
      }));

      // 2. Add to target semester at specified index or at end
      const targetSemIndex = cleanedSemesters.findIndex((s) => s.semesterNumber === targetSemesterNumber);
      if (targetSemIndex !== -1) {
        const semCourses = [...cleanedSemesters[targetSemIndex].courseIds];
        if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= semCourses.length) {
          semCourses.splice(targetIndex, 0, courseId);
        } else {
          semCourses.push(courseId);
        }
        cleanedSemesters[targetSemIndex].courseIds = semCourses;
      }

      return {
        ...prev,
        semesters: cleanedSemesters,
      };
    });
  };

  // Remove a course from the entire chart
  const removeCourseFromChart = (courseId: string) => {
    if (isReadOnly) return;
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
    if (isReadOnly || chart.semesters.length >= 12) return;
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
    if (isReadOnly || chart.semesters.length <= 8) return;
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

  // Open modal to load from approved curriculum list
  const handleOpenLoadApprovedModal = async () => {
    if (isReadOnly) return;
    setLoadApprovedModalOpen(true);
    setLoadingApprovedCharts(true);
    try {
      const res = await fetch(`/api/charts?trackId=${selectedTrackId}&approved=true`).then((r) => r.json());
      if (res.success && Array.isArray(res.data)) {
        setApprovedChartsList(res.data);
      } else {
        setApprovedChartsList([]);
      }
    } catch {
      setApprovedChartsList([]);
    } finally {
      setLoadingApprovedCharts(false);
    }
  };

  // Apply chosen approved chart
  const handleApplyApprovedChart = (selectedChart: StudentChart) => {
    if (isReadOnly) return;
    if (!confirm(`آیا از بارگذاری «${selectedChart.title}» مطمئن هستید؟ دروس فعلی چارت با این برنامه جایگزین خواهند شد.`)) {
      return;
    }
    setChart((prev) => ({
      ...prev,
      semesters: selectedChart.semesters,
    }));
    setLoadApprovedModalOpen(false);
  };

  // Save chart changes to backend
  const handleSaveChart = async () => {
    if (isReadOnly) return;
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
        const assignment =
          course.trackAssignments?.find((a) => a.trackId === selectedTrackId) ||
          course.trackAssignments?.[0];
        if (assignment?.visualCategoryId !== selectedCategoryFilter) return false;
      }

      return true;
    });
  }, [allCourses, drawerSearch, selectedCategoryFilter, selectedTrackId]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background text-foreground select-none">
      {/* ========================================================================= */}
      {/* 0. READ-ONLY MODE BANNER */}
      {/* ========================================================================= */}
      {isReadOnly && (
        <div className="shrink-0 bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
            <Shield className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="font-bold">
              {isApprovedChart
                ? "حالت فقط‌خواندنی (چارت مصوب رسمی دانشگاه)"
                : "حالت فقط مشاهده چارت"}
            </span>
            <span className="hidden md:inline text-muted-foreground text-[11px]">
              {isApprovedChart
                ? "ویرایش مستقیم چارت‌های مصوب رسمی تنها توسط مدیران مجاز است. برای شخصی‌سازی، یک نسخه از آن ایجاد کنید."
                : "شما دسترسی ویرایش مستقیم این چارت را ندارید."}
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleCloneForMe}
            disabled={isCloning}
            className="h-7 text-xs gap-1.5 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs"
          >
            <Copy className="h-3 w-3" />
            <span>{isCloning ? "در حال ایجاد نسخه شخصی..." : "ایجاد نسخه شخصی از این چارت برای من"}</span>
          </Button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TOP INTERACTIVE TOOLBAR */}
      {/* ========================================================================= */}
      <div className="shrink-0 z-30 border-b border-border/70 bg-card/95 backdrop-blur px-4 py-2.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 max-w-[1700px] mx-auto">
          {/* Title & Track Info */}
          <div className="flex items-center gap-2.5">
            <Link href="/charts">
              <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs px-2.5 rounded-lg border border-border/80 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-muted/70 shadow-2xs">
                <ArrowRight className="h-3.5 w-3.5" />
                چارت‌ها
              </Button>
            </Link>

            <div className="flex items-center gap-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isReadOnly}
                className="h-8 text-xs font-bold w-52 sm:w-64 rounded-lg border-border/70 focus:border-primary px-3 transition-colors bg-background/60 shadow-2xs disabled:opacity-85 disabled:cursor-not-allowed"
                placeholder="عنوان چارت تحصیلی..."
              />
              <Badge variant="outline" className="text-[11px] h-8 px-2.5 rounded-lg text-primary border-primary/30 bg-primary/5 flex items-center gap-1.5 shadow-2xs font-medium">
                {isApprovedChart && <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />}
                <span>{activeTrack?.name || "گرایش انتخاب‌نشده"}</span>
                {isApprovedChart && (
                  <span className="text-[9px] bg-primary/10 text-primary px-1 py-0.2 rounded font-bold">
                    {isAdmin ? "مصوب (مدیریت)" : "مصوب"}
                  </span>
                )}
              </Badge>
            </div>
          </div>

          {/* Real-time Validation Status & Stats (Clickable to open detailed report) */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIssuesModalOpen(true)}
              className={`h-8 gap-1.5 text-xs font-semibold px-3 rounded-lg transition-all cursor-pointer shadow-2xs ${
                validation.hasErrors
                  ? "bg-destructive/15 text-destructive hover:bg-destructive/25 border border-destructive/30"
                  : validation.isGraduationReady
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 border border-amber-500/30"
              }`}
              title="کلیک جهت مشاهده گزارش کامل خطاها و قوانین"
            >
              {validation.hasErrors ? (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 animate-pulse text-destructive shrink-0" />
                  <span>{validation.issues.filter((i) => i.type === "error").length} خطا (مشاهده گزارش)</span>
                </>
              ) : validation.isGraduationReady ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>آماده فارغ‌التحصیلی ({totalChartCredits} واحد)</span>
                </>
              ) : (
                <>
                  <Info className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span>{totalChartCredits} واحد (مشاهده وضعیت)</span>
                </>
              )}
            </Button>

            {/* Toggle Arrow Layer */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowArrows(!showArrows)}
              className={`h-8 gap-1.5 text-xs px-3 rounded-lg border transition-all shadow-2xs ${
                showArrows
                  ? "bg-muted/70 text-foreground border-border/90"
                  : "bg-background/50 text-muted-foreground border-border/80 hover:bg-muted/50"
              }`}
              title="نمایش / پنهان کردن فلش‌های پیش‌نیاز"
            >
              {showArrows ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">فلش‌های پیش‌نیاز</span>
            </Button>

            {/* Load Approved Curriculum Button */}
            {!isReadOnly && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleOpenLoadApprovedModal}
                className="h-8 gap-1.5 text-xs px-3 rounded-lg text-primary border border-primary/30 bg-primary/5 hover:bg-primary/15 transition-all shadow-2xs font-medium"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span className="hidden sm:inline">بارگذاری چارت مصوب / پیشنهادی</span>
              </Button>
            )}

            {/* Add / Remove Semester */}
            {!isReadOnly && (
              <div className="h-8 flex items-center bg-background/60 p-0.5 rounded-lg border border-border/80 shadow-2xs">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={addSemester}
                  disabled={chart.semesters.length >= 12}
                  className="h-7 text-xs px-2.5 rounded-md gap-1 text-foreground hover:bg-muted/80 transition-colors"
                  title="افزودن یک ترم جدید به انتها"
                >
                  <Plus className="h-3.5 w-3.5 text-primary" />
                  <span>ترم {chart.semesters.length + 1}</span>
                </Button>
                {chart.semesters.length > 8 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={removeLastSemester}
                    className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="حذف آخرین ترم"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}

            {/* Save Button OR Clone Button */}
            {isReadOnly ? (
              <Button
                size="sm"
                onClick={handleCloneForMe}
                disabled={isCloning}
                className="h-8 gap-1.5 text-xs px-3.5 rounded-lg font-semibold shadow-2xs border border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>{isCloning ? "در حال ایجاد..." : "کپی در چارت‌های من"}</span>
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSaveChart}
                disabled={isSaving}
                className="h-8 gap-1.5 text-xs px-3.5 rounded-lg font-semibold shadow-2xs border border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
              >
                {isSaving ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : saveSuccess ? (
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saveSuccess ? "ذخیره شد!" : "ذخیره چارت"}
              </Button>
            )}

            {/* Dark / Light Mode Toggle */}
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Error banner if any */}
      {errorMsg && (
        <div className="shrink-0 bg-destructive/15 border-b border-destructive/30 px-4 py-2 text-xs text-destructive flex items-center justify-between">
          <span>{errorMsg}</span>
          <Button size="sm" variant="ghost" onClick={() => setErrorMsg(null)} className="h-6 w-6 p-0 text-destructive">
            <XCircle className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MAIN WORKSPACE: CANVAS + RIGHT DRAWER */}
      {/* ========================================================================= */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* RIGHT DRAWER: Categorized Course Palette */}
        <aside className="w-80 shrink-0 h-full border-l border-border/70 bg-card/50 flex flex-col overflow-hidden">
          {/* Drawer Header & Search */}
          <div className="p-3 border-b border-border/70 space-y-2.5 shrink-0">
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
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            {filteredDrawerCourses.map((course) => {
              const assignment =
                course.trackAssignments?.find((a) => a.trackId === selectedTrackId) ||
                course.trackAssignments?.[0];
              const vcat = visualCategories.find((vc) => vc.id === assignment?.visualCategoryId);
              const placedSem = placedCourseIdMap.get(course.id);
              const isPlaced = placedSem !== undefined;
              const prereqs = course.prerequisites || [];
              const baseColor = vcat?.color || "#64748b";

              return (
                <div
                  key={course.id}
                  draggable={!isReadOnly}
                  onDragStart={(e) => {
                    if (isReadOnly) {
                      e.preventDefault();
                      return;
                    }
                    e.dataTransfer.setData("text/plain", course.id);
                    setDraggedCourseId(course.id);
                  }}
                  onDragEnd={() => setDraggedCourseId(null)}
                  onMouseEnter={() => setHoveredCourseId(course.id)}
                  onMouseLeave={() => setHoveredCourseId(null)}
                  style={{
                    backgroundColor: `${baseColor}12`,
                    borderColor: `${baseColor}38`,
                    borderRight: `4px solid ${baseColor}`,
                  }}
                  className={`p-2.5 rounded-xl border transition-all shadow-2xs ${
                    isReadOnly
                      ? "cursor-default"
                      : "cursor-grab active:cursor-grabbing"
                  } ${
                    isPlaced
                      ? "opacity-60 bg-muted/40 hover:opacity-100"
                      : "hover:border-primary/50 hover:shadow-xs"
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div>
                      <p className="text-xs font-bold">{course.name}</p>
                      <p className="text-[10px] text-muted-foreground">{course.code}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold text-foreground border border-border/40">
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
                          className={`text-[9px] px-1.5 py-0.5 rounded-md ${
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
          <div className="p-3 border-t border-border/70 bg-muted/20 text-[11px] text-muted-foreground flex items-center justify-between shrink-0">
            <span>دروس را بکشید و در ترم‌ها رها کنید</span>
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
          </div>
        </aside>

        {/* ========================================================================= */}
        {/* CENTER CANVAS: FULL-WIDTH VERTICAL STACKED SEMESTERS + SVG CONNECTOR ARROWS */}
        {/* ========================================================================= */}
        <main
          ref={canvasRef}
          className="flex-1 min-h-0 h-full relative overflow-y-auto p-4 sm:p-6 lg:p-8 bg-muted/20"
        >
          {/* Dynamic SVG Connections Overlay (z-30 so it flies ABOVE semester and course card backgrounds) */}
          {showArrows && (
            <svg
              className="absolute top-0 left-0 pointer-events-none z-30"
              style={{
                width: "100%",
                height: `${canvasRef.current ? Math.max(canvasRef.current.scrollHeight, canvasRef.current.clientHeight) : 2500}px`,
                minHeight: "100%",
              }}
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
                      ? 0.9
                      : 0.35
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

          {/* Semesters Stacked Vertically (Full Width, z-10) */}
          <div className="space-y-4 w-full relative z-10 pb-20">
            {chart.semesters.map((sem) => {
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
                  onDragLeave={() => {
                    setDragOverSemester(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverSemester(null);
                    setDragOverCardId(null);
                    const courseId = e.dataTransfer.getData("text/plain") || draggedCourseId;
                    if (courseId) {
                      moveCourseToSemester(courseId, sem.semesterNumber);
                    }
                  }}
                  className={`rounded-2xl border transition-all duration-150 flex flex-col bg-card shadow-2xs ${
                    isOver
                      ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                      : "border-border/80"
                  }`}
                >
                  {/* Semester Row Header */}
                  <div className="p-3 sm:px-4 border-b border-border/70 bg-card rounded-t-2xl flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-2xs">
                        {sem.semesterNumber}
                      </span>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold">ترم {sem.semesterNumber}</h3>
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
                    </div>

                    {/* Quick Link to Semester Weekly Schedule Planner & Count */}
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/schedule?chartId=${chart.id}&term=${sem.semesterNumber}`}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-medium bg-muted/40 hover:bg-muted px-2.5 py-1 rounded-lg border border-border/60"
                      >
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        <span>برنامه زمانی هفتگی</span>
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </Link>

                      <span className="text-xs text-muted-foreground">
                        {sem.courseIds.length} درس
                      </span>
                    </div>
                  </div>

                  {/* Semester Course Cards Grid (Drop Zone with Reordering) */}
                  <div className="p-3 sm:p-4 min-h-[100px]">
                    {sem.courseIds.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                        {sem.courseIds.map((cId) => {
                          const course = allCourses.find((c) => c.id === cId);
                          if (!course) return null;

                          const assignment =
                            course.trackAssignments?.find((a) => a.trackId === selectedTrackId) ||
                            course.trackAssignments?.[0];
                          const vcat = visualCategories.find(
                            (vc) => vc.id === assignment?.visualCategoryId
                          );
                          const isViolation = validation.courseViolations.has(cId);
                          const isHovered = hoveredCourseId === cId;
                          const isDragTarget = dragOverCardId === cId;
                          const baseColor = isViolation ? "#ef4444" : vcat?.color || "#64748b";

                          return (
                            <div
                              key={cId}
                              ref={(el) => {
                                if (el) cardElementsRef.current.set(cId, el);
                                else cardElementsRef.current.delete(cId);
                              }}
                              draggable={!isReadOnly}
                              onDragStart={(e) => {
                                if (isReadOnly) {
                                  e.preventDefault();
                                  return;
                                }
                                e.dataTransfer.setData("text/plain", cId);
                                setDraggedCourseId(cId);
                              }}
                              onDragEnd={() => {
                                setDraggedCourseId(null);
                                setDragOverCardId(null);
                                setDragOverSemester(null);
                              }}
                              onDragOver={(e) => {
                                if (isReadOnly) return;
                                e.preventDefault();
                                e.stopPropagation();
                                setDragOverCardId(cId);
                                setDragOverSemester(sem.semesterNumber);
                              }}
                              onDragLeave={(e) => {
                                e.stopPropagation();
                                if (dragOverCardId === cId) setDragOverCardId(null);
                              }}
                              onDrop={(e) => {
                                if (isReadOnly) return;
                                e.preventDefault();
                                e.stopPropagation();
                                setDragOverCardId(null);
                                setDragOverSemester(null);
                                const droppedCourseId = e.dataTransfer.getData("text/plain") || draggedCourseId;
                                if (droppedCourseId) {
                                  const targetIdx = sem.courseIds.indexOf(cId);
                                  moveCourseToSemester(droppedCourseId, sem.semesterNumber, targetIdx);
                                }
                              }}
                              onMouseEnter={() => setHoveredCourseId(cId)}
                              onMouseLeave={() => setHoveredCourseId(null)}
                              style={{
                                backgroundColor: isViolation ? "rgba(239, 68, 68, 0.09)" : `${baseColor}14`,
                                borderColor: isViolation
                                  ? "rgba(239, 68, 68, 0.5)"
                                  : isHovered || isDragTarget
                                  ? baseColor
                                  : `${baseColor}38`,
                                borderRight: `4px solid ${baseColor}`,
                              }}
                              className={`group relative p-3 rounded-xl border transition-all shadow-2xs ${
                                isReadOnly
                                  ? "cursor-default"
                                  : "cursor-grab active:cursor-grabbing"
                              } ${
                                isDragTarget
                                  ? "ring-2 ring-primary ring-offset-2 scale-[1.02] bg-primary/15"
                                  : isViolation
                                  ? "ring-1 ring-destructive/40 shadow-xs"
                                  : isHovered
                                  ? "ring-2 ring-primary/40 shadow-md scale-[1.01]"
                                  : "hover:shadow-xs"
                              }`}
                            >
                              {/* Course Header */}
                              <div className="flex items-start justify-between gap-1">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-bold leading-snug">{course.name}</p>
                                    {isViolation && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setIssuesModalOpen(true);
                                        }}
                                        className="inline-flex items-center text-destructive hover:scale-110 transition-transform cursor-pointer"
                                        title="کلیک جهت مشاهده متن دقیق خطا"
                                      >
                                        <AlertTriangle
                                          className="h-3.5 w-3.5 text-destructive shrink-0 animate-pulse"
                                        />
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {course.code}
                                  </p>
                                </div>

                                {/* Remove button (Only for editors) */}
                                {!isReadOnly && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeCourseFromChart(cId);
                                    }}
                                    className="h-6 w-6 p-0 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors shrink-0"
                                    title="حذف از این ترم"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>

                              {/* Units & Category Tag */}
                              <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
                                <span
                                  style={{
                                    backgroundColor: `${baseColor}20`,
                                    color: baseColor,
                                    borderColor: `${baseColor}40`,
                                  }}
                                  className="px-2 py-0.5 rounded-md font-semibold border"
                                >
                                  {vcat?.name || "عمومی"}
                                </span>
                                <span className="font-bold text-foreground bg-background/80 px-1.5 py-0.5 rounded border border-border/40">
                                  {course.units} واحد
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-border/60 rounded-xl flex items-center justify-center p-6 text-center text-muted-foreground/60 text-xs gap-2">
                        <Layers className="h-4 w-4 opacity-40" />
                        <span>درسی در این ترم قرار ندارد — دروس را از پنل راست به اینجا بکشید</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floating Issues Banner at bottom */}
          {validation.issues.length > 0 && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
              <button
                type="button"
                onClick={() => setIssuesModalOpen(true)}
                className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-background/95 backdrop-blur border border-destructive/40 text-destructive text-xs font-bold shadow-lg hover:bg-destructive/10 transition-all cursor-pointer"
              >
                <AlertTriangle className="h-4 w-4 animate-pulse shrink-0" />
                <span>
                  {validation.issues.filter((i) => i.type === "error").length} خطا و {validation.issues.filter((i) => i.type === "warning").length} هشدار در چارت — کلیک جهت مشاهده جزئیات
                </span>
                <ArrowRight className="h-3 w-3 rotate-180 shrink-0" />
              </button>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================= */}
      {/* VALIDATION REPORT DIALOG (MODAL) */}
      {/* ========================================================= */}
      <Dialog open={issuesModalOpen} onOpenChange={setIssuesModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden" dir="rtl">
          <DialogHeader className="p-4 sm:p-5 border-b shrink-0">
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary" />
              گزارش جامع اعتبارسنجی قوانین و پیش‌نیازهای چارت
            </DialogTitle>
            <DialogDescription className="text-xs">
              بررسی انطباق پیش‌نیازها، هم‌نیازها، سقف/کف واحدهای هر ترم و شروط فارغ‌التحصیلی گرایش
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
            {/* Summary Chips */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl border border-destructive/20 bg-destructive/5">
                <p className="text-[10px] text-muted-foreground">خطاهای پیش‌نیاز</p>
                <p className="text-sm font-bold text-destructive">
                  {validation.issues.filter((i) => i.type === "error").length} مورد
                </p>
              </div>
              <div className="p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <p className="text-[10px] text-muted-foreground">هشدارهای ترم‌ها</p>
                <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                  {validation.issues.filter((i) => i.type === "warning").length} مورد
                </p>
              </div>
              <div className="p-2.5 rounded-xl border border-primary/20 bg-primary/5">
                <p className="text-[10px] text-muted-foreground">مجموع کل واحدها</p>
                <p className="text-sm font-bold text-primary">{totalChartCredits} واحد</p>
              </div>
            </div>

            {/* Issues List */}
            {validation.issues.length > 0 ? (
              <div className="space-y-2">
                <p className="font-bold text-foreground">لیست خطاها و هشدارهای شناسایی‌شده:</p>
                <div className="space-y-2">
                  {validation.issues.map((issue, idx) => (
                    <div
                      key={issue.id || idx}
                      className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                        issue.type === "error"
                          ? "border-destructive/30 bg-destructive/10 text-destructive dark:text-red-300"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                      }`}
                    >
                      {issue.type === "error" ? (
                        <XCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                      )}
                      <div className="space-y-0.5 flex-1">
                        <p className="font-semibold text-xs leading-relaxed">{issue.message}</p>
                        {issue.termIndex && (
                          <span className="inline-block text-[10px] opacity-75">
                            مربوط به ترم {issue.termIndex}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-center space-y-2 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
                <p className="font-bold">تمام پیش‌نیازها و هم‌نیازها کاملاً رعایت شده‌اند!</p>
                <p className="text-xs opacity-80">هیچ تداخل ترتیبی یا خطای واحدی در چارت شما وجود ندارد.</p>
              </div>
            )}

            {/* Track Graduation Requirements Status */}
            {validation.ruleEval && (
              <div className="pt-2 border-t space-y-2">
                <p className="font-bold text-foreground">وضعیت شروط مصوب گرایش ({activeTrack?.name}):</p>
                <div className="space-y-1.5">
                  {validation.ruleEval.categoryStats.map((catStat) => (
                    <div
                      key={catStat.categoryId}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-xs"
                    >
                      <span>{catStat.categoryName}:</span>
                      <span className="font-bold">
                        {catStat.actualCredits} از {catStat.minCreditsRequired} واحد مجاز
                        {catStat.isSatisfied ? " ✓" : " ✗"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-3 border-t bg-muted/20 shrink-0">
            <Button
              size="sm"
              onClick={() => setIssuesModalOpen(false)}
              className="w-full h-8 text-xs font-semibold"
            >
              متوجه شدم و بستن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* 2. LOAD APPROVED / RECOMMENDED CURRICULUM MODAL */}
      {/* ========================================================= */}
      <Dialog open={loadApprovedModalOpen} onOpenChange={setLoadApprovedModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden" dir="rtl">
          <DialogHeader className="p-4 sm:p-5 border-b shrink-0">
            <DialogTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              انتخاب چارت مصوب یا پیشنهادی ({activeTrack?.name || "گرایش"})
            </DialogTitle>
            <DialogDescription className="text-xs">
              یکی از چارت‌های استاندارد زیر را انتخاب کنید تا چیدمان ترمی دروس در چارت شما بارگذاری شود.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3">
            {loadingApprovedCharts ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-xs text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                <span>در حال دریافت لیست چارت‌های مصوب و پیشنهادی...</span>
              </div>
            ) : approvedChartsList.length > 0 ? (
              <div className="space-y-3">
                {approvedChartsList.map((ac) => {
                  let totalCredits = 0;
                  let totalCourses = 0;
                  ac.semesters.forEach((sem) => {
                    totalCourses += sem.courseIds.length;
                    sem.courseIds.forEach((cId) => {
                      const c = allCourses.find((course) => course.id === cId);
                      if (c) totalCredits += c.units;
                    });
                  });

                  return (
                    <div
                      key={ac.id}
                      className="p-3.5 rounded-xl border border-border/80 bg-card hover:border-primary/50 transition-all space-y-3 shadow-2xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                            <BookOpen className="h-3.5 w-3.5 text-primary" />
                            {ac.title}
                          </h4>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {ac.semesters.length} ترم • {totalCourses} درس • {totalCredits} واحد
                          </p>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => handleApplyApprovedChart(ac)}
                          className="h-7 text-xs font-semibold gap-1"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          بارگذاری این چارت
                        </Button>
                      </div>

                      {/* Term breakdown */}
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 pt-1 border-t border-border/50">
                        {ac.semesters.map((sem) => {
                          let semCredits = 0;
                          sem.courseIds.forEach((cId) => {
                            const c = allCourses.find((course) => course.id === cId);
                            if (c) semCredits += c.units;
                          });

                          return (
                            <div
                              key={sem.semesterNumber}
                              className="p-1 rounded-md bg-muted/40 text-center text-[10px]"
                            >
                              <span className="font-bold block">ترم {sem.semesterNumber}</span>
                              <span className="text-muted-foreground text-[9px] block">
                                {sem.courseIds.length} درس ({semCredits}و)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-2 border-2 border-dashed rounded-xl">
                <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto opacity-75" />
                <p className="font-bold text-foreground">هنوز چارت مصوبی برای این گرایش تعریف نشده است.</p>
                <p>می‌توانید دروس را به صورت دستی از سایدبار در ترم‌ها قرار دهید.</p>
              </div>
            )}
          </div>

          <DialogFooter className="p-3 border-t bg-muted/20 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLoadApprovedModalOpen(false)}
              className="h-8 text-xs w-full sm:w-auto"
            >
              انصراف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
