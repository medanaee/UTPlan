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
  AlertCircle,
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
  ShieldCheck,
  Copy,
  Minus,
  ZoomIn,
  ZoomOut,
  PanelRightClose,
  PanelRightOpen,
  Camera,
  GraduationCap,
  Cloud,
  CloudOff,
  Sun,
} from "lucide-react";
import { toPng } from "html-to-image";
import { persianSearch } from "@/lib/search/persian-search";
import { cn } from "@/lib/utils";
import { fetchJson, postJson, putJson } from "@/lib/api-client";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Combobox } from "@/components/ui/combobox";
import { validateFullChart, formatTermDisplay } from "@/lib/rules-engine";
import { ThemeToggle } from "@/components/theme-toggle";
import { TermSchedulePlanner } from "./term-schedule-planner";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import type {
  StudentChart,
  ChartSemester,
  Course,
  Category,
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
  categories?: Category[];
  visualCategories?: VisualCategory[];
  ruleCategories?: RuleCategory[];
  user?: UserSession | null;
}

interface SvgConnection {
  id: string;
  sourceCourseId: string;
  targetCourseId: string;
  type: "prerequisite" | "corequisite" | "recommended";
  sourceSemester: number;
  targetSemester: number;
  isViolation: boolean;
}

export function ChartEditor({
  initialChart,
  allTracks,
  allCourses,
  categories: categoriesProp,
  visualCategories,
  ruleCategories,
  user,
}: ChartEditorProps) {
  const categories = useMemo(() => {
    return categoriesProp || visualCategories || ruleCategories || [];
  }, [categoriesProp, visualCategories, ruleCategories]);
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
  const [selectedCategoryFilter, setSelectedCategoryFilter] = usePersistedState<string>("ut_ece_chart_cat_filter", "all");
  const [showArrows, setShowArrows] = usePersistedState<boolean>("ut_ece_chart_show_arrows", true);
  const [isDrawerCollapsed, setIsDrawerCollapsed] = usePersistedState<boolean>("ut_ece_chart_drawer_collapsed", false);

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

  // Term Weekly Schedule Planner Modal State
  const [activePlannerSemester, setActivePlannerSemester] = useState<number | null>(null);

  const handlePlannerEventSelect = async (courseId: string, eventId: string | null) => {
    if (activePlannerSemester === null) return;
    setChart((prev) => {
      const nextSemesters = prev.semesters.map((s) => {
        if (s.semesterNumber !== activePlannerSemester) return s;
        const nextMap = { ...(s.courseEventsMap || {}) };
        if (eventId) {
          nextMap[courseId] = eventId;
        } else {
          delete nextMap[courseId];
        }
        return { ...s, courseEventsMap: nextMap };
      });
      return { ...prev, semesters: nextSemesters };
    });

    try {
      await fetch("/api/charts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chartId: chart.id,
          termIndex: activePlannerSemester,
          courseId,
          selectedEventId: eventId,
        }),
      });
    } catch (err) {
      console.error("Error persisting selected event:", err);
    }
  };

  // Hovered Course for SVG Arrow Highlighting
  const [hoveredCourseId, setHoveredCourseId] = useState<string | null>(null);

  // Auto-Save Status & References
  type AutoSaveStatus = "saved" | "saving" | "pending" | "offline";
  const [saveStatus, setSaveStatus] = useState<AutoSaveStatus>("saved");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedPayloadRef = useRef<string>("");
  const isInitialMountRef = useRef<boolean>(true);

  const [isCloning, setIsCloning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExportingImage, setIsExportingImage] = useState(false);

  // Clone approved / read-only chart for current user
  const handleCloneForMe = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    setIsCloning(true);
    setErrorMsg(null);
    try {
      const res = await postJson("/api/charts", {
        title: `نسخه من از ${chart.title}`,
        trackId: chart.trackId,
        cloneFromId: chart.id,
      });

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
  const contentRef = useRef<HTMLDivElement>(null);
  const cardElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const [svgCurves, setSvgCurves] = useState<
    {
      id: string;
      d: string;
      type: "prerequisite" | "corequisite" | "recommended";
      sourceId: string;
      targetId: string;
      isViolation: boolean;
      isHighlighted: boolean;
      isDimmed: boolean;
    }[]
  >([]);

  // Zoom percentage state (70% to 130%)
  const [zoom, setZoom] = useState<number>(100);

  // Waived courses state (prerequisites assumed to be satisfied)
  const [waivedCourseIds, setWaivedCourseIds] = useState<string[]>(initialChart.waivedCourseIds || []);
  const [waivedModalOpen, setWaivedModalOpen] = useState<boolean>(false);
  const [courseToAddWaived, setCourseToAddWaived] = useState<string>("");

  const handleWaiveCourse = (courseId: string) => {
    if (isReadOnly) return;
    setWaivedCourseIds((prev) => {
      if (prev.includes(courseId)) return prev;
      return [...prev, courseId];
    });
  };

  const handleUnwaiveCourse = (courseId: string) => {
    if (isReadOnly) return;
    setWaivedCourseIds((prev) => prev.filter((id) => id !== courseId));
  };

  // Combobox items for passed courses selection
  const waivedComboboxItems = useMemo(() => {
    return allCourses
      .filter((c) => !waivedCourseIds.includes(c.id))
      .map((c) => ({
        value: c.id,
        label: c.name,
        sublabel: `${c.units} واحد`,
        badge: c.code,
        keywords: [c.name, c.code, ...(c.abbreviation ? [c.abbreviation] : [])],
      }));
  }, [allCourses, waivedCourseIds]);

  // Derived start and end semester numbers
  const startSem = useMemo(() => {
    return chart.semesters.length > 0
      ? Math.min(...chart.semesters.map((s) => Math.floor(s.semesterNumber)))
      : 1;
  }, [chart.semesters]);

  const endSem = useMemo(() => {
    return chart.semesters.length > 0
      ? Math.max(...chart.semesters.map((s) => Math.floor(s.semesterNumber)))
      : 8;
  }, [chart.semesters]);

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
    const countedCourseIds = new Set<string>();
    chart.semesters.forEach((sem) => {
      sem.courseIds.forEach((cId) => {
        if (!countedCourseIds.has(cId)) {
          countedCourseIds.add(cId);
          const c = allCourses.find((course) => course.id === cId);
          if (c) total += c.units;
        }
      });
    });
    waivedCourseIds.forEach((cId) => {
      if (!countedCourseIds.has(cId)) {
        countedCourseIds.add(cId);
        const c = allCourses.find((course) => course.id === cId);
        if (c) total += c.units;
      }
    });
    return total;
  }, [chart.semesters, allCourses, waivedCourseIds]);

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
      if (c.trackAssignments) {
        const assignmentsForTrack = activeTrack?.id
          ? c.trackAssignments.filter((a) => a.trackId === activeTrack.id)
          : c.trackAssignments;
        allTrackAssignments.push(...assignmentsForTrack);
      }
    });

    const allPrereqs: any[] = [];
    allCourses.forEach((c) => {
      if (c.prerequisites) allPrereqs.push(...c.prerequisites);
    });

    const fullResult = validateFullChart({
      trackId: activeTrack?.id,
      chartCourses,
      rulesTree: activeTrack?.rulesTree,
      ruleCategories: categories,
      trackAssignments: allTrackAssignments,
      allCourses,
      prerequisites: allPrereqs,
      waivedCourseIds,
      startTerm: startSem,
      totalTerms: endSem,
    });

    const courseViolations = new Set<string>();
    const courseWarnings = new Set<string>();
    fullResult.issues.forEach((issue) => {
      if (issue.courseId) {
        if (issue.type === "error") {
          courseViolations.add(issue.courseId);
        } else if (issue.type === "warning") {
          courseWarnings.add(issue.courseId);
        }
      }
    });

    const semesterCredits = chart.semesters.map((sem) => {
      let semUnits = 0;
      sem.courseIds.forEach((cId) => {
        const c = allCourses.find((course) => course.id === cId);
        if (c) semUnits += c.units;
      });

      const isSummer = sem.isSummer || sem.semesterNumber % 1 !== 0;
      const isLastTerm = sem.semesterNumber === endSem;

      return {
        semesterNumber: sem.semesterNumber,
        units: semUnits,
        isOverMax: isSummer ? semUnits > 20 : semUnits > 24,
        isUnderMin: !isSummer && !isLastTerm && semUnits < 12,
        isSummer,
      };
    });

    const hasErrors = fullResult.issues.filter((i) => i.type === "error").length > 0;
    const hasWarnings = fullResult.issues.filter((i) => i.type === "warning").length > 0;
    const errorCount = fullResult.issues.filter((i) => i.type === "error").length;
    const warningCount = fullResult.issues.filter((i) => i.type === "warning").length;

    return {
      issues: fullResult.issues,
      courseViolations,
      courseWarnings,
      semesterCredits,
      ruleEval: fullResult,
      isGraduationReady: fullResult.isGraduationSatisfied && !hasErrors && !hasWarnings,
      hasErrors,
      hasWarnings,
      errorCount,
      warningCount,
    };
  }, [chart.semesters, allCourses, placedCourseIdMap, activeTrack, categories, totalChartCredits, waivedCourseIds]);

  // Recalculate SVG connection curves in absolute scroll content space
  const updateSvgCurves = useCallback(() => {
    if (!contentRef.current || !showArrows) {
      setSvgCurves([]);
      return;
    }

    const content = contentRef.current;
    const contentRect = content.getBoundingClientRect();
    const zoomFactor = (content.style as any).zoom
      ? parseFloat((content.style as any).zoom) || 1
      : Math.max(0.1, zoom / 100);
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
            const isSameSemester = sourceSem === sem.semesterNumber;
            let pathData = "";

            if (isSameSemester) {
              // Same semester (e.g. corequisites): Arch curve from TOP of source to TOP of target
              const x1 = (srcRect.left - contentRect.left) / zoomFactor + (srcRect.width / 2) / zoomFactor;
              const y1 = (srcRect.top - contentRect.top) / zoomFactor;

              const x2 = (tgtRect.left - contentRect.left) / zoomFactor + (tgtRect.width / 2) / zoomFactor;
              const y2 = (tgtRect.top - contentRect.top) / zoomFactor;

              const arcHeight = Math.min(48, Math.max(22, Math.abs(x2 - x1) * 0.18));
              pathData = `M ${x1} ${y1} C ${x1} ${y1 - arcHeight}, ${x2} ${y2 - arcHeight}, ${x2} ${y2}`;
            } else if (sourceSem < sem.semesterNumber) {
              // Standard forward: from BOTTOM of source to TOP of target
              const x1 = (srcRect.left - contentRect.left) / zoomFactor + (srcRect.width / 2) / zoomFactor;
              const y1 = (srcRect.bottom - contentRect.top) / zoomFactor;

              const x2 = (tgtRect.left - contentRect.left) / zoomFactor + (tgtRect.width / 2) / zoomFactor;
              const y2 = (tgtRect.top - contentRect.top) / zoomFactor;

              const dy = Math.max(25, Math.abs(y2 - y1) * 0.4);
              pathData = `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
            } else {
              // Backward violation: from TOP of source to BOTTOM of target
              const x1 = (srcRect.left - contentRect.left) / zoomFactor + (srcRect.width / 2) / zoomFactor;
              const y1 = (srcRect.top - contentRect.top) / zoomFactor;

              const x2 = (tgtRect.left - contentRect.left) / zoomFactor + (tgtRect.width / 2) / zoomFactor;
              const y2 = (tgtRect.bottom - contentRect.top) / zoomFactor;

              const dy = Math.max(25, Math.abs(y1 - y2) * 0.4);
              pathData = `M ${x1} ${y1} C ${x1} ${y1 - dy}, ${x2} ${y2 + dy}, ${x2} ${y2}`;
            }

            const isPrereqPassed = waivedCourseIds.includes(sourceCourseId);

            const isViolation = isPrereqPassed
              ? false
              : pr.type === "prerequisite"
                ? sourceSem >= sem.semesterNumber
                : pr.type === "corequisite"
                  ? sourceSem > sem.semesterNumber
                  : sourceSem >= sem.semesterNumber;

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
  }, [chart.semesters, allCourses, placedCourseIdMap, showArrows, hoveredCourseId, zoom, waivedCourseIds]);

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

  // Increase start term (remove first semester, e.g. 1 -> 2)
  const increaseStartSemester = () => {
    if (isReadOnly || startSem >= endSem - 1) return;
    const firstSem = chart.semesters[0];
    if (firstSem && firstSem.courseIds.length > 0) {
      if (
        !confirm(
          `ترم ${firstSem.semesterNumber} دارای درس است. با افزایش ترم شروع، این ترم از چارت حذف خواهد شد. آیا مطمئن هستید؟`
        )
      ) {
        return;
      }
    }
    setChart((prev) => ({
      ...prev,
      semesters: prev.semesters.slice(1),
    }));
  };

  // Decrease start term (prepend new semester, e.g. 2 -> 1)
  const decreaseStartSemester = () => {
    if (isReadOnly || startSem <= 1) return;
    setChart((prev) => ({
      ...prev,
      semesters: [
        { semesterNumber: startSem - 1, courseIds: [] },
        ...prev.semesters,
      ],
    }));
  };

  // Add new semester to the end (up to 12)
  const addSemester = () => {
    if (isReadOnly || endSem >= 12) return;
    setChart((prev) => ({
      ...prev,
      semesters: [
        ...prev.semesters,
        { semesterNumber: endSem + 1, courseIds: [] },
      ],
    }));
  };

  // Remove last semester (floor is 8)
  const removeLastSemester = () => {
    if (isReadOnly || endSem <= 8) return;
    const lastSem = chart.semesters[chart.semesters.length - 1];
    if (lastSem && lastSem.courseIds.length > 0) {
      if (!confirm(`ترم ${lastSem.semesterNumber} دارای درس است. آیا از حذف آن مطمئن هستید؟`)) {
        return;
      }
    }
    setChart((prev) => ({
      ...prev,
      semesters: prev.semesters.slice(0, -1),
    }));
  };

  // Add summer semester after an even semester (e.g. after term 2 -> 2.5)
  const addSummerSemester = (evenSemesterNumber: number) => {
    if (isReadOnly) return;
    const summerNum = evenSemesterNumber + 0.5;
    if (chart.semesters.some((s) => s.semesterNumber === summerNum)) return;

    setChart((prev) => {
      const newSemesters = [
        ...prev.semesters,
        {
          semesterNumber: summerNum,
          isSummer: true,
          courseIds: [],
        },
      ];
      newSemesters.sort((a, b) => a.semesterNumber - b.semesterNumber);
      return {
        ...prev,
        semesters: newSemesters,
      };
    });
  };

  // Remove summer semester and return its courses to unplaced list
  const removeSummerSemester = (summerSemesterNumber: number) => {
    if (isReadOnly) return;
    const targetSem = chart.semesters.find((s) => s.semesterNumber === summerSemesterNumber);
    if (!targetSem) return;

    if (targetSem.courseIds.length > 0) {
      if (
        !confirm(
          `این ترم تابستان دارای ${targetSem.courseIds.length} درس است. با حذف آن، این دروس از چارت خارج شده و به لیست دروس برنامه‌ریزی‌نشده بازمی‌گردند. آیا از حذف آن مطمئن هستید؟`
        )
      ) {
        return;
      }
    }

    setChart((prev) => ({
      ...prev,
      semesters: prev.semesters.filter((s) => s.semesterNumber !== summerSemesterNumber),
    }));
  };

  // Open modal to load from approved curriculum list
  const handleOpenLoadApprovedModal = async () => {
    if (isReadOnly) return;
    setLoadApprovedModalOpen(true);
    setLoadingApprovedCharts(true);
    try {
      const res = await fetchJson(`/api/charts?trackId=${selectedTrackId}&approved=true`);
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

  // Sync chart changes to backend (Auto-Save / Manual trigger)
  const syncToServer = async (payloadToSend?: string) => {
    if (isReadOnly) return;

    const payload =
      payloadToSend ||
      JSON.stringify({
        id: chart.id,
        title,
        trackId: selectedTrackId,
        semesters: chart.semesters,
        waivedCourseIds,
      });

    if (payload === lastSavedPayloadRef.current) {
      setSaveStatus("saved");
      return;
    }

    setSaveStatus("saving");
    setErrorMsg(null);

    try {
      const res = await fetchJson("/api/charts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });

      if (res.success) {
        lastSavedPayloadRef.current = payload;
        setSaveStatus("saved");

        // Mark local draft as synced
        try {
          const cached = localStorage.getItem(`ut_ece_chart_draft_${chart.id}`);
          if (cached) {
            const draft = JSON.parse(cached);
            draft.syncedWithServer = true;
            localStorage.setItem(`ut_ece_chart_draft_${chart.id}`, JSON.stringify(draft));
          }
        } catch { }
      } else {
        console.warn("Auto-save server response:", res.message);
        setSaveStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "pending");
      }
    } catch (err) {
      console.error("Auto-save server error:", err);
      setSaveStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "pending");
    }
  };

  // 1. Initial Draft Recovery & Setting baseline payload on mount
  useEffect(() => {
    if (isReadOnly) return;
    try {
      const draftKey = `ut_ece_chart_draft_${initialChart.id}`;
      const cached = localStorage.getItem(draftKey);
      if (cached) {
        const draft = JSON.parse(cached);
        const serverUpdated = initialChart.updatedAt ? new Date(initialChart.updatedAt).getTime() : 0;
        // If local draft is newer than server update time by at least 2 seconds
        if (draft.savedAt && draft.savedAt > serverUpdated + 2000) {
          if (draft.semesters && Array.isArray(draft.semesters)) {
            setChart((prev) => ({ ...prev, semesters: draft.semesters }));
          }
          if (draft.title) setTitle(draft.title);
          if (draft.trackId) {
            setSelectedTrackId(draft.trackId);
            setActiveTrack(allTracks.find((t) => t.id === draft.trackId) || null);
          }
          if (draft.waivedCourseIds && Array.isArray(draft.waivedCourseIds)) {
            setWaivedCourseIds(draft.waivedCourseIds);
          }
          if (!draft.syncedWithServer) {
            setSaveStatus("pending");
          }
        }
      }
    } catch (e) {
      console.error("Failed to recover local chart draft:", e);
    }

    lastSavedPayloadRef.current = JSON.stringify({
      id: initialChart.id,
      title: initialChart.title,
      trackId: initialChart.trackId,
      semesters: initialChart.semesters,
      waivedCourseIds: initialChart.waivedCourseIds || [],
    });
  }, [initialChart.id, isReadOnly]);

  // 2. Dual-Tier Auto-Save Effect (Immediate LocalStorage + Debounced Server Sync)
  useEffect(() => {
    if (isReadOnly) return;

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    const currentPayloadObj = {
      id: chart.id,
      title,
      trackId: selectedTrackId,
      semesters: chart.semesters,
      waivedCourseIds,
    };
    const currentPayloadStr = JSON.stringify(currentPayloadObj);

    if (currentPayloadStr === lastSavedPayloadRef.current) {
      return;
    }

    // Tier 1: Instant LocalStorage persistence (< 1ms)
    try {
      localStorage.setItem(
        `ut_ece_chart_draft_${chart.id}`,
        JSON.stringify({
          ...currentPayloadObj,
          savedAt: Date.now(),
          syncedWithServer: false,
        })
      );
    } catch (e) {
      console.warn("Failed to persist chart draft to localStorage:", e);
    }

    // Update status to pending
    setSaveStatus((prev) => (prev === "saving" ? prev : "pending"));

    // Tier 2: Debounced Server Sync (2.5 seconds idle time)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      syncToServer(currentPayloadStr);
    }, 2500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [chart.id, chart.semesters, title, selectedTrackId, waivedCourseIds, isReadOnly]);

  // 3. Re-sync when network recovers from offline
  useEffect(() => {
    const handleOnline = () => {
      if (saveStatus === "offline" || saveStatus === "pending") {
        syncToServer();
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [saveStatus, chart.id, chart.semesters, title, selectedTrackId, waivedCourseIds]);

  // 4. Keepalive background flush on tab close/unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isReadOnly) return;
      const payload = JSON.stringify({
        id: chart.id,
        title,
        trackId: selectedTrackId,
        semesters: chart.semesters,
        waivedCourseIds,
      });
      if (payload !== lastSavedPayloadRef.current) {
        try {
          fetch("/api/charts", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          });
        } catch { }
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [chart.id, chart.semesters, title, selectedTrackId, waivedCourseIds, isReadOnly]);

  // Export High-Quality Image of the Entire Chart
  const handleExportImage = async () => {
    if (!contentRef.current || isExportingImage) return;

    try {
      setIsExportingImage(true);
      const content = contentRef.current;

      // 1. Temporarily normalize zoom to 1 and add padding for a framed, crisp export
      content.style.zoom = "1";
      content.style.padding = "20px";

      // 2. Recalculate SVG curves for zoom = 1
      updateSvgCurves();

      // 3. Allow React and DOM to complete reflow and paint
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 4. Match current theme background so the PNG has a solid, crisp background
      const isDark = document.documentElement.classList.contains("dark");
      const backgroundColor = isDark ? "#09090b" : "#ffffff";

      // 5. Generate high-resolution PNG using html-to-image
      let dataUrl: string;
      try {
        dataUrl = await toPng(content, {
          pixelRatio: 2,
          cacheBust: true,
          backgroundColor,
          filter: (node: HTMLElement) => {
            if (node?.getAttribute && node.getAttribute("data-no-export") === "true") {
              return false;
            }
            return true;
          },
        });
      } catch (firstErr) {
        console.warn("Retrying chart image export at 1.5x with skipFonts...", firstErr);
        dataUrl = await toPng(content, {
          pixelRatio: 1.5,
          skipFonts: true,
          backgroundColor,
          filter: (node: HTMLElement) => {
            if (node?.getAttribute && node.getAttribute("data-no-export") === "true") {
              return false;
            }
            return true;
          },
        });
      }

      // 6. Trigger automatic download
      const chartTitle = (title || chart.title || "چارت تحصیلی").trim();
      const safeTitle = chartTitle.replace(/[/\\?%*:|"<>]/g, "-").trim();
      const link = document.createElement("a");
      link.download = `${safeTitle || "chart"}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to export chart image:", err);
      alert("خطا در تهیه خروجی تصویر از چارت. لطفاً دوباره تلاش کنید.");
    } finally {
      // 7. Restore original zoom and padding, then recalculate SVG curves
      if (contentRef.current) {
        contentRef.current.style.zoom = `${zoom / 100}`;
        contentRef.current.style.padding = "";
        updateSvgCurves();
      }
      setIsExportingImage(false);
    }
  };

  // Helper: Get category ID and all its descendants recursively
  const getCategoryAndDescendantIds = useCallback((catId: string, categories: VisualCategory[]): Set<string> => {
    const set = new Set<string>();
    const queue = [catId];
    while (queue.length > 0) {
      const currId = queue.shift()!;
      set.add(currId);
      for (const cat of categories) {
        if (cat.parentId === currId && !set.has(cat.id)) {
          queue.push(cat.id);
        }
      }
    }
    return set;
  }, []);

  // Filter and sort drawer courses (unplaced courses first, placed courses at the bottom)
  const filteredDrawerCourses = useMemo(() => {
    // 1. Category filter (matches category and all its descendants)
    let list = allCourses;
    if (selectedCategoryFilter !== "all") {
      const allowedCatIds = getCategoryAndDescendantIds(selectedCategoryFilter, categories);
      list = list.filter((course) => {
        const assignment =
          course.trackAssignments?.find((a) => a.trackId === selectedTrackId) ||
          course.trackAssignments?.[0];
        const catId = assignment?.categoryId || (assignment as any)?.visualCategoryId || (assignment as any)?.ruleCategoryId;
        return Boolean(catId && allowedCatIds.has(catId));
      });
    }

    // 2. Intelligent Persian search with typo tolerance & space invariance
    if (drawerSearch.trim()) {
      list = persianSearch(list, drawerSearch);
    }

    // 3. Sort: unplaced/unpassed courses first, placed or passed courses pushed to the bottom (stable sort)
    return list.slice().sort((a, b) => {
      const aDone = placedCourseIdMap.has(a.id) || waivedCourseIds.includes(a.id);
      const bDone = placedCourseIdMap.has(b.id) || waivedCourseIds.includes(b.id);
      if (aDone === bDone) return 0;
      return aDone ? 1 : -1;
    });
  }, [allCourses, drawerSearch, selectedCategoryFilter, selectedTrackId, placedCourseIdMap, categories, getCategoryAndDescendantIds, waivedCourseIds]);

  // Dynamic grid column count based on zoom level:
  // Base (90%+): 3 -> 8 cols
  // 80%: +1 col (4 -> 9 cols)
  // 70% (zoom floor): +2 cols (5 -> 10 cols)
  const gridColsClass = useMemo(() => {
    if (zoom <= 70) {
      return "grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 xl:grid-cols-9 2xl:grid-cols-10";
    }
    if (zoom <= 80) {
      return "grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-9";
    }
    return "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8";
  }, [zoom]);

  // Active ancestor path from root down to selectedCategoryFilter
  const activeCategoryPath = useMemo(() => {
    if (selectedCategoryFilter === "all") return [];
    const path: Category[] = [];
    let curr = categories.find((c) => c.id === selectedCategoryFilter);
    while (curr) {
      path.unshift(curr);
      curr = curr.parentId ? categories.find((c) => c.id === curr!.parentId) : undefined;
    }
    return path;
  }, [selectedCategoryFilter, categories]);

  // Hierarchical category filter levels (Row 1: roots, Row 2: children of path[0], Row 3: children of path[1]...)
  const categoryFilterLevels = useMemo(() => {
    const levels: {
      levelIndex: number;
      parentCatId: string | null;
      activeId: string;
      categories: Category[];
      onSelectAll: () => void;
    }[] = [];

    // Level 0: Root categories
    const rootCats = categories.filter(
      (c) => !c.parentId || !categories.some((p) => p.id === c.parentId)
    );

    if (rootCats.length === 0) return levels;

    const level0ActiveId = activeCategoryPath.length > 0 ? activeCategoryPath[0].id : "all";
    levels.push({
      levelIndex: 0,
      parentCatId: null,
      activeId: level0ActiveId,
      categories: rootCats,
      onSelectAll: () => setSelectedCategoryFilter("all"),
    });

    // Sub-levels: For each ancestor on path, if it has children in categories
    for (let i = 0; i < activeCategoryPath.length; i++) {
      const currentParent = activeCategoryPath[i];
      const children = categories.filter((c) => c.parentId === currentParent.id);
      if (children.length > 0) {
        const nextInPath = activeCategoryPath[i + 1];
        const nextActiveId = nextInPath ? nextInPath.id : "all";
        levels.push({
          levelIndex: i + 1,
          parentCatId: currentParent.id,
          activeId: nextActiveId,
          categories: children,
          onSelectAll: () => setSelectedCategoryFilter(currentParent.id),
        });
      }
    }

    return levels;
  }, [categories, activeCategoryPath, setSelectedCategoryFilter]);

  return (
    <TooltipProvider delayDuration={300}>
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
        <div className="shrink-0 z-30 border-b border-border/70 bg-card/95 backdrop-blur p-3 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2.5 mx-auto">
            {/* Title & Track Info */}
            <div className="flex items-center gap-2">
              <Link href="/charts" className="flex items-center">
                <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs px-2.5 rounded-lg border border-border/80 bg-background/50 text-foreground hover:bg-muted/70 shadow-2xs">
                  <ArrowRight className="h-3.5 w-3.5 text-foreground shrink-0" />
                  <span>چارت‌ها</span>
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
                <Badge variant="outline" className="text-[11px] h-8 px-2.5 rounded-lg text-foreground border-border/80 bg-muted/30 flex items-center gap-1.5 shadow-2xs font-medium">
                  {isApprovedChart && <Sparkles className="h-3.5 w-3.5 text-foreground shrink-0" />}
                  <span>{activeTrack?.name || "گرایش انتخاب‌نشده"}</span>
                  {isApprovedChart && (
                    <span className="text-[9px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-bold">
                      {isAdmin ? "مصوب (مدیریت)" : "مصوب"}
                    </span>
                  )}
                </Badge>
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIssuesModalOpen(true)}
                className={`h-8 gap-1.5 text-xs font-semibold px-3 rounded-lg transition-all cursor-pointer shadow-2xs flex items-center ${validation.hasErrors
                  ? "bg-destructive/15 text-destructive hover:bg-destructive/25 dark:hover:bg-destructive/25 border border-destructive/30"
                  : validation.hasWarnings
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25 border border-amber-500/30"
                    : validation.isGraduationReady
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30"
                      : "bg-muted/50 text-foreground hover:bg-muted/80 border border-border/80"
                  }`}
                title="کلیک جهت مشاهده گزارش کامل خطاها و قوانین"
              >
                {validation.hasErrors ? (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5 animate-pulse text-destructive shrink-0" />
                    <span>{validation.errorCount} خطا (مشاهده گزارش)</span>
                  </>
                ) : validation.hasWarnings ? (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>{validation.warningCount} هشدار / توصیه ({totalChartCredits} واحد)</span>
                  </>
                ) : validation.isGraduationReady ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>آماده فارغ‌التحصیلی ({totalChartCredits} واحد)</span>
                  </>
                ) : (
                  <>
                    <Info className="h-3.5 w-3.5 text-foreground shrink-0" />
                    <span>{totalChartCredits} واحد (مشاهده وضعیت)</span>
                  </>
                )}
              </Button>
            </div>

            {/* Actions & Buttons */}
            <div className="flex items-center gap-2">
              {/* Waived Prerequisites / Ignored Errors Manager */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setWaivedModalOpen(true)}
                className="h-8 gap-1.5 text-xs px-2.5 sm:px-3 rounded-lg border border-border bg-background/50 text-foreground hover:bg-muted/70 transition-all shadow-2xs flex items-center"
                title="مدیریت دروس پاس‌شده و معاف از پیش‌نیاز"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="hidden sm:inline">دروس پاس‌شده</span>
                {waivedCourseIds.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="h-4 px-1 text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold"
                  >
                    {waivedCourseIds.length}
                  </Badge>
                )}
              </Button>

              {/* Load Approved Curriculum Button */}
              {!isReadOnly && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleOpenLoadApprovedModal}
                  className="h-8 gap-1.5 text-xs px-3 rounded-lg border border-border bg-background/50 text-foreground hover:bg-muted/70 transition-all shadow-2xs flex items-center"
                >
                  <span className="hidden sm:inline">بارگذاری چارت مصوب / پیشنهادی</span>
                </Button>
              )}

              {/* Export High-Quality Image Button */}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleExportImage}
                disabled={isExportingImage}
                title="دریافت خروجی تصویری باکیفیت از کل چارت (PNG)"
                className="h-8 gap-1.5 text-xs px-3 rounded-lg border border-border bg-background/50 text-foreground hover:bg-muted/70 transition-all shadow-2xs flex items-center cursor-pointer"
              >
                {isExportingImage ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                ) : (
                  <Camera className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
                <span className="hidden sm:inline">
                  {isExportingImage ? "در حال آماده‌سازی..." : "خروجی تصویر"}
                </span>
              </Button>

              {/* Auto-Save Status Indicator OR Clone Button */}
              {isReadOnly ? (
                <Button
                  size="sm"
                  onClick={handleCloneForMe}
                  disabled={isCloning}
                  className="h-8 gap-1.5 text-xs px-3.5 rounded-lg font-semibold shadow-2xs border border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center"
                >
                  <Copy className="h-3.5 w-3.5 text-primary-foreground shrink-0" />
                  <span>{isCloning ? "در حال ایجاد..." : "کپی در چارت‌های من"}</span>
                </Button>
              ) : (
                <div
                  onClick={() => {
                    if (saveStatus === "pending" || saveStatus === "offline") {
                      syncToServer();
                    }
                  }}
                  title={
                    saveStatus === "saved"
                      ? "تمام تغییرات در مرورگر و سرور ذخیره شده است"
                      : saveStatus === "saving"
                        ? "در حال ذخیره‌سازی در دیتابیس..."
                        : saveStatus === "offline"
                          ? "ارتباط با سرور برقرار نیست؛ تغییرات در حافظه مرورگر امن است (جهت تلاش مجدد کلیک کنید)"
                          : "تغییرات در صف ذخیره‌سازی خودکار (جهت ذخیره آنی کلیک کنید)"
                  }
                  className={cn(
                    "h-8 text-xs px-3 rounded-lg border transition-all flex items-center gap-1.5 shadow-2xs select-none",
                    saveStatus === "saved" &&
                    "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-medium",
                    saveStatus === "saving" &&
                    "bg-primary/10 border-primary/30 text-primary font-medium",
                    saveStatus === "pending" &&
                    "bg-muted/80 border-border text-muted-foreground hover:text-foreground cursor-pointer hover:bg-muted",
                    saveStatus === "offline" &&
                    "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 font-medium cursor-pointer hover:bg-amber-500/20"
                  )}
                >
                  {saveStatus === "saved" && (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="hidden sm:inline">ذخیره خودکار</span>
                      <span className="sm:hidden">ذخیره شد</span>
                    </>
                  )}
                  {saveStatus === "saving" && (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                      <span>در حال ذخیره...</span>
                    </>
                  )}
                  {saveStatus === "pending" && (
                    <>
                      <Cloud className="h-3.5 w-3.5 text-muted-foreground animate-pulse shrink-0" />
                      <span className="hidden sm:inline">در انتظار ذخیره...</span>
                      <span className="sm:hidden">در انتظار...</span>
                    </>
                  )}
                  {saveStatus === "offline" && (
                    <>
                      <CloudOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="hidden sm:inline">ذخیره محلی (آفلاین)</span>
                      <span className="sm:hidden">آفلاین</span>
                    </>
                  )}
                </div>
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
          {isDrawerCollapsed ? (
            <aside className="w-11 shrink-0 h-full border-l border-border/70 bg-card/60 flex flex-col items-center py-2.5 justify-between transition-all duration-200 select-none z-20">
              <div className="flex flex-col items-center gap-2.5 w-full">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsDrawerCollapsed(false)}
                  className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  title="باز کردن پنل دروس"
                >
                  <PanelRightOpen className="h-4 w-4" />
                </Button>

                <button
                  type="button"
                  onClick={() => setIsDrawerCollapsed(false)}
                  className="[writing-mode:vertical-rl] rotate-180 flex items-center gap-2 text-[11px] font-bold text-muted-foreground hover:text-foreground mt-3 tracking-wide cursor-pointer transition-colors"
                  title="کلیک جهت باز کردن پنل دروس"
                >
                  <BookOpen className="h-3.5 w-3.5 rotate-90 text-primary" />
                  <span> دروس گرایش ({allCourses.length})</span>
                </button>
              </div>

              <div
                onClick={() => setIsDrawerCollapsed(false)}
                className="cursor-pointer text-[10px] text-muted-foreground hover:text-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/40 font-bold"
                title="تعداد دروس در چارت یا پاس‌شده"
              >
                {placedCourseIdMap.size + waivedCourseIds.length}/{allCourses.length}
              </div>
            </aside>
          ) : (
            <aside className="w-80 shrink-0 h-full border-l border-border/70 bg-card/50 flex flex-col overflow-hidden transition-all duration-200 z-20">
              {/* Drawer Header & Search */}
              <div className="p-3 border-b border-border/70 space-y-2.5 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-primary" />
                    دروس گرایش ({allCourses.length} درس)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">
                      {placedCourseIdMap.size} در چارت{waivedCourseIds.length > 0 ? ` + ${waivedCourseIds.length} پاس‌شده` : ""}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsDrawerCollapsed(true)}
                      className="h-6 w-6 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                      title="جمع کردن پنل دروس"
                    >
                      <PanelRightClose className="h-3.5 w-3.5" />
                    </Button>
                  </div>
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

                {/* Visual Category Multi-Row Dynamic Filters */}
                <div className="space-y-1.5 pt-0.5 max-w-full">
                  {categoryFilterLevels.map((lvl) => (
                    <div
                      key={lvl.levelIndex}
                      className={`flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full text-[11px] select-none scrollbar-thin ${lvl.levelIndex > 0 ? "pr-2 border-r-2 border-primary/40 mr-1" : ""
                        }`}
                    >
                      <button
                        type="button"
                        onClick={lvl.onSelectAll}
                        className={`px-2.5 py-1 rounded-md font-medium transition-colors shrink-0 whitespace-nowrap ${lvl.activeId === "all"
                            ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                      >
                        همه
                      </button>
                      {lvl.categories.map((vcat) => {
                        const isActive = lvl.activeId === vcat.id;
                        return (
                          <button
                            key={vcat.id}
                            type="button"
                            onClick={() => setSelectedCategoryFilter(vcat.id)}
                            style={{
                              borderColor: isActive ? vcat.color : `${vcat.color}40`,
                              backgroundColor: isActive ? `${vcat.color}25` : undefined,
                              color: isActive ? vcat.color : undefined,
                            }}
                            className={`px-2.5 py-1 rounded-md border text-[11px] shrink-0 whitespace-nowrap transition-colors ${!isActive
                                ? "bg-muted/60 text-muted-foreground hover:text-foreground"
                                : "font-bold shadow-2xs"
                              }`}
                          >
                            {vcat.name}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Drawer Course List (Draggable Cards) */}
              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
                {filteredDrawerCourses.map((course) => {
                  const assignment =
                    course.trackAssignments?.find((a) => a.trackId === selectedTrackId) ||
                    course.trackAssignments?.[0];
                  const catId = assignment?.categoryId || (assignment as any)?.visualCategoryId || (assignment as any)?.ruleCategoryId;
                  const vcat = categories.find((vc) => vc.id === catId);
                  const placedSem = placedCourseIdMap.get(course.id);
                  const isPlaced = placedSem !== undefined;
                  const isWaived = waivedCourseIds.includes(course.id);
                  const isDone = isPlaced || isWaived;
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
                      }}
                      className={`p-2 rounded-xl border transition-all shadow-2xs ${isReadOnly
                        ? "cursor-default"
                        : "cursor-grab active:cursor-grabbing"
                        } ${isDone
                          ? "opacity-60 bg-muted/40 hover:opacity-100"
                          : "hover:border-primary/50 hover:shadow-xs"
                        }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <p className="text-xs font-bold leading-snug">{course.name}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold text-foreground border border-border/40">
                            {course.units} واحد
                          </span>
                          {course.offeredIn === "fall" && (
                            <span className="rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold">
                              فقط فرد
                            </span>
                          )}
                          {course.offeredIn === "spring" && (
                            <span className="rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 px-1.5 py-0.5 text-[9px] font-semibold">
                              فقط زوج
                            </span>
                          )}
                          {course.offeredIn === "none" && (
                            <span className="rounded bg-destructive/10 text-destructive border border-destructive/20 px-1.5 py-0.5 text-[9px] font-semibold">
                              عدم ارائه
                            </span>
                          )}
                          {isWaived ? (
                            <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                              پاس شده
                            </Badge>
                          ) : isPlaced ? (
                            <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                              {placedSem % 1 !== 0 ? `تابستان (${Math.floor(placedSem)})` : `ترم ${placedSem}`}
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      {/* Prerequisites tags preview */}
                      {prereqs.length > 0 && (
                        <div className="mt-2 pt-1.5 border-t border-border/40 flex flex-wrap gap-1">
                          {prereqs.map((pr) => (
                            <span
                              key={pr.id}
                              className={`text-[9px] px-1.5 py-0.5 rounded-md border ${pr.type === "prerequisite"
                                ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                                : pr.type === "corequisite"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                }`}
                            >
                              {pr.type === "prerequisite"
                                ? "پیش‌نیاز: "
                                : pr.type === "corequisite"
                                  ? "هم‌نیاز: "
                                  : "پیشنهادی: "}
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
          )}

          {/* ========================================================================= */}
          {/* CENTER WORKSPACE: DEDICATED SUB-TOOLBAR + VERTICAL STACKED CANVAS */}
          {/* ========================================================================= */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-muted/20">
            {/* Sub-toolbar row above the terms */}
            <div className="shrink-0 h-8 sm:h-8.5 border-b border-border/70 bg-card/90 backdrop-blur flex items-stretch justify-between z-20 select-none p-0 overflow-x-auto overflow-y-hidden">
              {/* Right side (start in RTL): Zoom Controller & Arrow Hints */}
              <div className="flex items-stretch h-full">
                {/* Zoom Controller */}
                <div className="flex items-center px-1.5 sm:px-2 gap-1 h-full border-l border-border/70">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setZoom((z) => Math.max(70, z - 10))}
                    disabled={zoom <= 70}
                    className="h-6 w-6 p-0 rounded-md text-foreground hover:bg-muted/80 disabled:opacity-40 transition-colors flex items-center justify-center"
                    title="کوچک‌نمایی (Zoom Out)"
                  >
                    <ZoomOut className="h-3.5 w-3.5 text-foreground shrink-0" />
                  </Button>
                  <button
                    type="button"
                    onClick={() => setZoom(100)}
                    className="h-6 px-1.5 text-xs font-bold text-foreground hover:bg-muted/70 transition-colors cursor-pointer rounded-md flex items-center justify-center"
                    title="کلیک جهت بازنشانی بزرگ‌نمایی به ۱۰۰٪"
                  >
                    {zoom}%
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setZoom((z) => Math.min(130, z + 10))}
                    disabled={zoom >= 130}
                    className="h-6 w-6 p-0 rounded-md text-foreground hover:bg-muted/80 disabled:opacity-40 transition-colors flex items-center justify-center"
                    title="بزرگ‌نمایی (Zoom In)"
                  >
                    <ZoomIn className="h-3.5 w-3.5 text-foreground shrink-0" />
                  </Button>
                </div>

                {/* 3 Arrow Hints (Legend) */}
                <div className="flex items-center px-1.5 sm:px-2.5 gap-1 sm:gap-2 h-full border-l border-border/70 text-[11px] select-none">
                  {/* 1. Prerequisite */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="group flex items-center gap-1.5 px-1.5 py-0.5 rounded-md hover:bg-muted/60 transition-colors cursor-help">
                        <svg width="18" height="10" viewBox="0 0 18 10" className="shrink-0 text-sky-500 dark:text-sky-400 rtl:-scale-x-100">
                          <line x1="1" y1="5" x2="12" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M 10 2.2 L 16 5 L 10 7.8 Z" fill="currentColor" />
                        </svg>
                        <span className="text-[11px] font-medium text-foreground/80 group-hover:text-foreground">پیش‌نیاز</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={6} className="text-xs">
                      پیش‌نیاز رسمی (خط ممتد آبی - الزام گذراندن در ترم‌های قبل)
                    </TooltipContent>
                  </Tooltip>

                  {/* 2. Corequisite */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="group flex items-center gap-1.5 px-1.5 py-0.5 rounded-md hover:bg-muted/60 transition-colors cursor-help">
                        <svg width="18" height="10" viewBox="0 0 18 10" className="shrink-0 text-emerald-500 dark:text-emerald-400 rtl:-scale-x-100">
                          <line x1="1" y1="5" x2="12" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M 10 2.2 L 16 5 L 10 7.8 Z" fill="currentColor" />
                        </svg>
                        <span className="text-[11px] font-medium text-foreground/80 group-hover:text-foreground">هم‌نیاز</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={6} className="text-xs">
                      هم‌نیاز رسمی (خط ممتد سبز - اخذ همزمان یا در ترم‌های قبل)
                    </TooltipContent>
                  </Tooltip>

                  {/* 3. Recommended */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="group flex items-center gap-1.5 px-1.5 py-0.5 rounded-md hover:bg-muted/60 transition-colors cursor-help">
                        <svg width="18" height="10" viewBox="0 0 18 10" className="shrink-0 text-violet-500 dark:text-violet-400 rtl:-scale-x-100">
                          <line x1="1" y1="5" x2="12" y2="5" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2" strokeLinecap="round" />
                          <path d="M 10 2.2 L 16 5 L 10 7.8 Z" fill="currentColor" />
                        </svg>
                        <span className="text-[11px] font-medium text-foreground/80 group-hover:text-foreground">پیشنهادی</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={6} className="text-xs">
                      پیش‌نیاز پیشنهادی (خط‌چین بنفش - توصیه آموزشی، غیرالزامی)
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* Left side (end in RTL): Prerequisite Arrows Toggle & Semester Range */}
              <div className="flex items-stretch h-full">
                {/* Toggle Arrow Layer */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowArrows(!showArrows)}
                  className={`h-full px-2.5 sm:px-3 text-xs gap-1.5 rounded-none border-r border-border/70 transition-colors flex items-center ${showArrows
                      ? "bg-accent/40 text-foreground"
                      : "text-foreground hover:bg-muted/60"
                    }`}
                  title="نمایش / پنهان کردن فلش‌های پیش‌نیاز"
                >
                  {showArrows ? (
                    <Eye className="h-3.5 w-3.5 text-foreground shrink-0" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-foreground shrink-0" />
                  )}
                  <span className="hidden sm:inline">فلش‌های پیش‌نیاز</span>
                </Button>

                {/* Start Term & End Term Controls */}
                {!isReadOnly && (
                  <div className="flex items-stretch h-full">
                    {/* Start Semester Group */}
                    <div
                      className="flex items-center px-1.5 sm:px-2 gap-1 h-full border-r border-border/70"
                      title="تنظیم ترم شروع چارت"
                    >
                      <span className="text-[11px] font-semibold text-muted-foreground px-1 hidden md:inline">
                        شروع:
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={increaseStartSemester}
                        disabled={startSem >= endSem - 1}
                        className="h-6 w-6 p-0 rounded-md text-foreground hover:bg-muted/80 transition-colors flex items-center justify-center disabled:opacity-40"
                        title="افزایش ترم شروع (حذف ترم قبل)"
                      >
                        <Plus className="h-3.5 w-3.5 text-foreground shrink-0" />
                      </Button>
                      <span className="text-xs font-bold text-foreground px-1 min-w-9.5 text-center">
                        ترم {startSem}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={decreaseStartSemester}
                        disabled={startSem <= 1}
                        className="h-6 w-6 p-0 rounded-md text-foreground hover:bg-muted/80 transition-colors flex items-center justify-center disabled:opacity-40"
                        title="کاهش ترم شروع (افزودن ترم قبل)"
                      >
                        <Minus className="h-3.5 w-3.5 text-foreground shrink-0" />
                      </Button>
                    </div>

                    {/* End Semester Group */}
                    <div
                      className="flex items-center px-1.5 sm:px-2 gap-1 h-full border-r border-border/70"
                      title="تنظیم حداکثر ترم چارت"
                    >
                      <span className="text-[11px] font-semibold text-muted-foreground px-1 hidden md:inline">
                        پایان:
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={addSemester}
                        disabled={endSem >= 12}
                        className="h-6 w-6 p-0 rounded-md text-foreground hover:bg-muted/80 transition-colors flex items-center justify-center disabled:opacity-40"
                        title="افزودن یک ترم جدید به انتها"
                      >
                        <Plus className="h-3.5 w-3.5 text-foreground shrink-0" />
                      </Button>
                      <span className="text-xs font-bold text-foreground px-1 min-w-9.5 text-center">
                        ترم {endSem}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={removeLastSemester}
                        disabled={endSem <= 8}
                        className="h-6 w-6 p-0 rounded-md text-foreground hover:text-destructive hover:bg-muted/80 transition-colors flex items-center justify-center disabled:opacity-40"
                        title="حذف آخرین ترم"
                      >
                        <Minus className="h-3.5 w-3.5 text-foreground shrink-0" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Main Scrollable Canvas */}
            <main
              ref={canvasRef}
              className="flex-1 min-h-0 h-full relative overflow-y-auto p-1 sm:p-2 lg:p-4"
            >
              <div
                ref={contentRef}
                className="relative w-full min-h-full"
                style={{ zoom: `${zoom / 100}` }}
              >
                {/* Dynamic SVG Connections Overlay (z-30 so it flies ABOVE semester and course card backgrounds) */}
                {showArrows && (
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible"
                  >
                    <defs>
                      {/* 1. Official Prerequisite (Solid Sky Blue / Red on Error) */}
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

                      {/* 2. Official Corequisite (Solid Emerald Green) */}
                      <marker
                        id="arrow-coreq"
                        viewBox="0 0 10 10"
                        refX="6"
                        refY="5"
                        markerWidth="5"
                        markerHeight="5"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
                      </marker>

                      {/* 3. Recommended Prerequisite (Distinct Violet / Amber on Advisory Warning) */}
                      <marker
                        id="arrow-recommended"
                        viewBox="0 0 10 10"
                        refX="6"
                        refY="5"
                        markerWidth="5"
                        markerHeight="5"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1 L 10 5 L 0 9 z" fill="#8b5cf6" />
                      </marker>
                      <marker
                        id="arrow-recommended-violation"
                        viewBox="0 0 10 10"
                        refX="6"
                        refY="5"
                        markerWidth="5"
                        markerHeight="5"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
                      </marker>
                    </defs>

                    {svgCurves.map((curve) => {
                      const strokeColor =
                        curve.type === "recommended"
                          ? curve.isViolation
                            ? "#f59e0b"
                            : "#8b5cf6"
                          : curve.isViolation
                            ? "#ef4444"
                            : curve.type === "prerequisite"
                              ? "#0ea5e9"
                              : "#10b981";

                      const markerEnd =
                        curve.type === "recommended"
                          ? curve.isViolation
                            ? "url(#arrow-recommended-violation)"
                            : "url(#arrow-recommended)"
                          : curve.isViolation
                            ? "url(#arrow-prereq-violation)"
                            : curve.type === "prerequisite"
                              ? "url(#arrow-prereq)"
                              : "url(#arrow-coreq)";

                      const dashArray =
                        curve.type === "recommended"
                          ? "3 3"
                          : undefined;

                      return (
                        <path
                          key={curve.id}
                          d={curve.d}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={curve.isHighlighted ? 2.5 : 1.5}
                          strokeOpacity={
                            curve.isDimmed
                              ? 0.05
                              : curve.isHighlighted
                                ? 1
                                : curve.isViolation
                                  ? 0.9
                                  : 0.4
                          }
                          strokeDasharray={dashArray}
                          markerEnd={markerEnd}
                          className="transition-all duration-150"
                        />
                      );
                    })}
                  </svg>
                )}


                {/* Semesters Stacked Vertically (Full Width, z-10) */}
                <div className="space-y-3 w-full relative z-10 pb-6">
                  {chart.semesters.map((sem) => {
                    const isSummer = sem.isSummer || sem.semesterNumber % 1 !== 0;
                    const semStats = validation.semesterCredits.find(
                      (sc) => sc.semesterNumber === sem.semesterNumber
                    );
                    const semUnits = semStats?.units || 0;
                    const isOverMax = semStats?.isOverMax || false;
                    const isUnderMin = semStats?.isUnderMin || false;
                    const isOver = dragOverSemester === sem.semesterNumber;

                    const isEvenRegularTerm = !isSummer && sem.semesterNumber % 2 === 0;
                    const hasSummerAfter = chart.semesters.some(
                      (s) => s.semesterNumber === sem.semesterNumber + 0.5
                    );

                    return (
                      <React.Fragment key={sem.semesterNumber}>
                        <div
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
                          className={`relative rounded-2xl border transition-all duration-150 flex flex-col bg-card shadow-2xs ${isOver
                            ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                            : "border-border/80"
                            }`}
                        >
                          {/* Semester Row Header */}
                          <div className="px-3 py-1.5 sm:px-3.5 sm:py-2 border-b border-border/70 bg-card rounded-t-2xl flex flex-wrap items-center justify-between gap-2">
                            {isSummer ? (
                              <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[11px] font-bold shadow-2xs border border-amber-500/30">
                                  <Sun className="h-3.5 w-3.5" />
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h3 className="text-xs font-bold flex items-center gap-1.5">
                                    <span>ترم تابستان</span>
                                    <span className="text-[10px] text-muted-foreground font-normal">
                                      (بعد از ترم {Math.floor(sem.semesterNumber)})
                                    </span>
                                  </h3>
                                  <span
                                    className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${isOverMax
                                      ? "bg-destructive/15 text-destructive border border-destructive/30"
                                      : "bg-muted text-foreground"
                                      }`}
                                  >
                                    {semUnits} واحد
                                  </span>
                                  <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold bg-muted/60 text-muted-foreground border border-border/40">
                                    {sem.courseIds.length} درس
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-[11px] font-bold shadow-2xs">
                                  {sem.semesterNumber}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <h3 className="text-xs font-bold">ترم {sem.semesterNumber}</h3>
                                  <span
                                    className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${isOverMax
                                      ? "bg-destructive/15 text-destructive border border-destructive/30"
                                      : isUnderMin
                                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                        : "bg-muted text-foreground"
                                      }`}
                                  >
                                    {semUnits} واحد
                                  </span>
                                  <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold bg-muted/60 text-muted-foreground border border-border/40">
                                    {sem.courseIds.length} درس
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Quick Link to Semester Weekly Schedule Planner & Delete Summer Button */}
                            <div className="flex items-center gap-1.5" data-no-export="true">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setActivePlannerSemester(sem.semesterNumber)}
                                className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 font-medium bg-muted/40 hover:bg-muted px-2.5 py-1 rounded-lg border border-border/60 h-7"
                              >
                                <Clock className="h-3 w-3 text-primary" />
                                <span>برنامه زمانی هفتگی</span>
                                {sem.courseEventsMap && Object.keys(sem.courseEventsMap).length > 0 && (
                                  <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                )}
                              </Button>

                              {isSummer && !isReadOnly && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeSummerSemester(sem.semesterNumber)}
                                  className="text-[11px] text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1 font-medium px-2 py-1 rounded-lg border border-destructive/20 h-7"
                                  title="حذف ترم تابستان"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  <span className="hidden sm:inline">حذف</span>
                                </Button>
                              )}
                            </div>
                          </div>

                        {/* Semester Course Cards Grid (Drop Zone with Reordering) */}
                        <div className="p-2.5 sm:p-3 min-h-15">
                          {sem.courseIds.length > 0 ? (
                            <div className={`grid ${gridColsClass} gap-2.5`}>
                              {sem.courseIds.map((cId) => {
                                const course = allCourses.find((c) => c.id === cId);
                                if (!course) return null;

                                const assignment =
                                  course.trackAssignments?.find((a) => a.trackId === selectedTrackId) ||
                                  course.trackAssignments?.[0];
                                const catId = assignment?.categoryId || (assignment as any)?.visualCategoryId || (assignment as any)?.ruleCategoryId;
                                const vcat = categories.find(
                                  (vc) => vc.id === catId
                                );
                                const isViolation = validation.courseViolations.has(cId);
                                const isWarning = validation.courseWarnings.has(cId);
                                const courseIssue = validation.issues.find((i) => i.courseId === cId);
                                const isHovered = hoveredCourseId === cId;
                                const isDragTarget = dragOverCardId === cId;
                                const baseColor = isViolation
                                  ? "#ef4444"
                                  : isWarning
                                    ? "#f59e0b"
                                    : vcat?.color || "#64748b";

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
                                      backgroundColor: isViolation
                                        ? "rgba(239, 68, 68, 0.09)"
                                        : isWarning
                                          ? "rgba(245, 158, 11, 0.09)"
                                          : `${baseColor}14`,
                                      borderColor: isViolation
                                        ? "rgba(239, 68, 68, 0.55)"
                                        : isWarning
                                          ? "rgba(245, 158, 11, 0.55)"
                                          : isHovered || isDragTarget
                                            ? baseColor
                                            : `${baseColor}38`,
                                      boxShadow: isViolation
                                        ? "0 0 14px 2px rgba(239, 68, 68, 0.35), 0 0 3px rgba(239, 68, 68, 0.45)"
                                        : isWarning
                                          ? "0 0 14px 2px rgba(245, 158, 11, 0.35), 0 0 3px rgba(245, 158, 11, 0.45)"
                                          : undefined,
                                    }}
                                    className={`group relative p-2.5 rounded-xl border transition-all duration-150 ${isReadOnly
                                      ? "cursor-default"
                                      : "cursor-grab active:cursor-grabbing"
                                      } ${isDragTarget
                                        ? "ring-2 ring-primary ring-offset-2 scale-[1.02] bg-primary/15"
                                        : isViolation
                                          ? "ring-1 ring-destructive/60"
                                          : isWarning
                                            ? "ring-1 ring-amber-500/60"
                                            : isHovered
                                              ? "ring-2 ring-primary/40 shadow-md scale-[1.01]"
                                              : "shadow-2xs hover:shadow-xs"
                                      }`}
                                  >
                                    {/* Course Header */}
                                    <div className="flex items-center justify-between gap-1">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <p className="text-xs font-bold leading-snug">{course.name}</p>
                                        {isViolation ? (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setIssuesModalOpen(true);
                                                }}
                                                className="inline-flex items-center text-destructive hover:scale-110 transition-transform cursor-pointer shrink-0"
                                              >
                                                <AlertTriangle
                                                  className="h-3.5 w-3.5 text-destructive shrink-0 animate-pulse drop-shadow-[0_0_6px_rgba(239,68,68,0.6)]"
                                                />
                                              </button>
                                            </TooltipTrigger>
                                            <TooltipContent
                                              side="top"
                                              sideOffset={5}
                                              className="max-w-70 bg-red-600 text-white p-2.5 text-xs text-right leading-relaxed shadow-lg rounded-lg border border-destructive/20 z-50 font-medium"
                                              dir="rtl"
                                            >
                                              <div className="flex items-start gap-1.5">
                                                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                                <span>
                                                  {courseIssue?.message || "خطای اعتبارسنجی چارت (کلیک جهت مشاهده جزئیات)"}
                                                </span>
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                        ) : isWarning ? (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setIssuesModalOpen(true);
                                                }}
                                                className="inline-flex items-center text-amber-500 dark:text-amber-400 hover:scale-110 transition-transform cursor-pointer shrink-0"
                                              >
                                                <AlertCircle
                                                  className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 shrink-0 animate-pulse drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]"
                                                />
                                              </button>
                                            </TooltipTrigger>
                                            <TooltipContent
                                              side="top"
                                              sideOffset={5}
                                              className="max-w-70 bg-amber-500 text-slate-950 p-2.5 text-xs text-right leading-relaxed shadow-lg rounded-lg border border-amber-600/30 z-50 font-medium"
                                              dir="rtl"
                                            >
                                              <div className="flex items-start gap-1.5">
                                                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-950" />
                                                <span>
                                                  {courseIssue?.message || "توصیه پیش‌نیاز پیشنهادی (کلیک جهت مشاهده جزئیات)"}
                                                </span>
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                        ) : null}
                                      </div>

                                      {/* Remove button (Only on card hover) */}
                                      {!isReadOnly && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            removeCourseFromChart(cId);
                                          }}
                                          className="opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md shrink-0"
                                          title="حذف از این ترم"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>

                                    {/* Units & Category Tag */}
                                    <div className="mt-1.5 pt-1.5 border-t border-border/40 flex items-center justify-between text-[10px]">
                                      {vcat?.name && (
                                        <span
                                          style={{
                                            backgroundColor: `${baseColor}20`,
                                            color: baseColor,
                                            borderColor: `${baseColor}40`,
                                          }}
                                          className="px-1.5 py-0.2 rounded-md font-semibold border"
                                        >
                                          {vcat?.name}
                                        </span>
                                      )}
                                      <div className="flex items-center gap-1">
                                        {course.offeredIn === "fall" && (
                                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-semibold" title="ارائه فقط در نیمسال‌های فرد (پاییز)">
                                            فرد
                                          </span>
                                        )}
                                        {course.offeredIn === "spring" && (
                                          <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-semibold" title="ارائه فقط در نیمسال‌های زوج (بهار)">
                                            زوج
                                          </span>
                                        )}
                                        {course.offeredIn === "none" && (
                                          <span className="text-[9px] px-1 py-0.2 rounded bg-destructive/10 text-destructive border border-destructive/20 font-semibold" title="عدم ارائه در هیچ نیمسالی">
                                            غیرفعال
                                          </span>
                                        )}
                                        <span className="font-bold text-foreground bg-background/80 px-1.5 py-0.2 rounded border border-border/40">
                                          {course.units} واحد
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="border-2 border-dashed border-border/60 rounded-xl flex items-center justify-center p-3.5 text-center text-muted-foreground/60 text-xs gap-2 min-h-11">
                              <Layers className="h-4 w-4 opacity-40" />
                              <span>درسی در این ترم قرار ندارد — دروس را از پنل راست به اینجا بکشید</span>
                            </div>
                          )}
                        </div>

                        {/* Add Summer Term Bubble Trigger on Bottom Stroke of Even Terms */}
                        {isEvenRegularTerm && !hasSummerAfter && !isReadOnly && (
                          <div
                            className="absolute bottom-0 translate-y-1/2 left-1/2 -translate-x-1/2 z-30 group/summer py-2.5 px-6 cursor-pointer select-none"
                            data-no-export="true"
                            onClick={() => addSummerSemester(sem.semesterNumber)}
                            title="افزودن ترم تابستان"
                          >
                            <div
                              className="flex items-center justify-center rounded-full transition-all duration-300 ease-out origin-center overflow-hidden
                                h-1 w-14 bg-amber-500/80
                                group-hover/summer:h-7 group-hover/summer:w-32 group-hover/summer:bg-background dark:group-hover/summer:bg-card
                                group-hover/summer:border group-hover/summer:border-amber-500 group-hover/summer:shadow-xs
                                group-hover/summer:px-3"
                            >
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap opacity-0 scale-75 group-hover/summer:opacity-100 group-hover/summer:scale-100 transition-all duration-200 delay-75 pointer-events-none">
                                <Plus className="h-3.5 w-3.5 shrink-0 transition-transform group-hover/summer:rotate-90 duration-300 text-amber-500" />
                                <Sun className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                                <span className="text-[11px] font-bold">ترم تابستان</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
                </div>
              </div>
            </main>
          </div>
        </div>

        {/* ========================================================= */}
        {/* VALIDATION REPORT DIALOG (MODAL) */}
        {/* ========================================================= */}
        <Dialog open={issuesModalOpen} onOpenChange={setIssuesModalOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden" dir="rtl">
            <DialogHeader className="p-4 sm:p-5 border-b shrink-0">
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-foreground" />
                اعتبارسنجی قوانین و پیش‌نیازهای چارت
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 space-y-4 text-xs">


              {/* Issues List */}
              {validation.issues.length > 0 ? (
                <div className="space-y-2">
                  <div className="space-y-2">
                    {validation.issues.map((issue, idx) => {
                      const isRecPrereq = issue.id.includes("issue_rec_prereq");
                      return (
                        <div
                          key={issue.id || idx}
                          className={`p-3 rounded-xl border flex items-start gap-2.5 ${issue.type === "error"
                            ? "border-destructive/30 bg-destructive/10 text-destructive dark:text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                            }`}
                        >
                          {issue.type === "error" ? (
                            <XCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5 drop-shadow-[0_0_4px_rgba(239,68,68,0.5)]" />
                          ) : isRecPrereq ? (
                            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5 drop-shadow-[0_0_4px_rgba(245,158,11,0.5)]" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5 drop-shadow-[0_0_4px_rgba(245,158,11,0.5)]" />
                          )}
                          <div className="space-y-0.5 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs leading-relaxed">{issue.message}</span>
                              {isRecPrereq && (
                                <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10">
                                  پیش‌نیاز پیشنهادی (غیرالزامی)
                                </Badge>
                              )}
                            </div>
                            {issue.termIndex && (
                              <span className="inline-block text-[10px] opacity-75">
                                مربوط به {formatTermDisplay(issue.termIndex)}
                              </span>
                            )}
                          </div>

                          {/* Action: "پاس کردم" for prerequisite / corequisite issues */}
                          {issue.requiredCourseId && !isReadOnly && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleWaiveCourse(issue.requiredCourseId!)}
                              className="h-7 px-2.5 text-[11px] font-bold gap-1 shrink-0 bg-background/90 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/15 hover:border-emerald-500 transition-colors shadow-2xs cursor-pointer"
                              title="ثبت درس پیش‌نیاز/هم‌نیاز به عنوان درس پاس‌شده"
                            >
                              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                              <span>پاس کردم</span>
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-center space-y-2 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
                  <p className="font-bold">تمام پیش‌نیازها و هم‌نیازها کاملاً رعایت شده‌اند!</p>
                  <p className="text-xs opacity-80">هیچ تداخل ترتیبی یا خطای واحدی در چارت شما وجود ندارد.</p>
                </div>
              )}

            </div>

            <div className="p-3 sm:p-4 border-t bg-muted/30 flex items-center justify-end gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                onClick={() => setIssuesModalOpen(false)}
                className="h-8 px-5 text-xs font-semibold shadow-xs"
              >
                متوجه شدم
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ========================================================= */}
        {/* 1.5. WAIVED PREREQUISITES / PASSED COURSES MODAL */}
        {/* ========================================================= */}
        <Dialog open={waivedModalOpen} onOpenChange={setWaivedModalOpen}>
          <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden" dir="rtl">
            <DialogHeader className="p-4 sm:p-5 border-b shrink-0 bg-card/60">
              <DialogTitle className="text-sm sm:text-base font-bold flex items-center gap-2 text-foreground">
                <ShieldCheck className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                مدیریت دروس گذرانده‌شده و معاف از پیش‌نیاز
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                دروسی که در این لیست ثبت می‌شوند، به عنوان دروس پاس‌شده (مانند تطبیق واحد یا گذرانده‌شده در گذشته) در نظر گرفته می‌شوند و نیاز پیش‌نیاز سایر دروس به آن‌ها برطرف خواهد شد.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 space-y-4 text-xs">
              {/* Search & Add Course Section with Combobox */}
              {!isReadOnly && (
                <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-2">
                  <p className="font-bold text-foreground flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5 text-primary" />
                    ثبت درس جدید به عنوان درس پاس‌شده:
                  </p>
                  <div className="flex items-center gap-2 w-full">
                    <div className="flex-1 min-w-0">
                      <Combobox
                        items={waivedComboboxItems}
                        value={courseToAddWaived}
                        onChange={setCourseToAddWaived}
                        placeholder="جستجو و انتخاب درس گذرانده‌شده..."
                        searchPlaceholder="نام یا کد درس را جستجو کنید..."
                        emptyText="درسی یافت نشد."
                        className="w-full h-8 text-xs bg-background"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!courseToAddWaived}
                      onClick={() => {
                        if (courseToAddWaived) {
                          handleWaiveCourse(courseToAddWaived);
                          setCourseToAddWaived("");
                        }
                      }}
                      className="h-8 px-3.5 text-xs font-bold gap-1 shrink-0 whitespace-nowrap shadow-2xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      افزودن
                    </Button>
                  </div>
                </div>
              )}

              {/* List of currently waived courses */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-foreground">
                    دروس گذرانده‌شده خارج از چارت ({waivedCourseIds.length} درس):
                  </p>
                  {waivedCourseIds.length > 0 && !isReadOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setWaivedCourseIds([])}
                      className="h-6 text-[11px] text-destructive hover:text-destructive/80 px-2"
                    >
                      حذف همه
                    </Button>
                  )}
                </div>

                {waivedCourseIds.length > 0 ? (
                  <div className="space-y-2">
                    {waivedCourseIds.map((cId) => {
                      const course = allCourses.find((c) => c.id === cId);
                      const courseName = course ? course.name : cId;
                      const courseCode = course?.code;
                      const units = course?.units;

                      return (
                        <div
                          key={cId}
                          className="px-3 py-1 rounded-xl border border-border/80 bg-card flex items-center justify-between gap-3 shadow-2xs hover:border-border transition-colors"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-foreground">{courseName}</span>
                              {courseCode && (
                                <Badge variant="outline" className="text-[10px] font-mono">
                                  {courseCode}
                                </Badge>
                              )}
                              {units !== undefined && (
                                <span className="text-[10px] text-muted-foreground font-semibold">
                                  ({units} واحد)
                                </span>
                              )}
                            </div>
                          </div>

                          {!isReadOnly && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUnwaiveCourse(cId)}
                              className="p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 transition-colors"
                              title="حذف از لیست دروس گذرانده‌شده"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl border border-dashed border-border/80 bg-muted/10 text-center space-y-2">
                    <ShieldCheck className="h-9 w-9 text-muted-foreground/40 mx-auto" />
                    <p className="font-bold text-foreground text-xs">هنوز درسی به عنوان گذرانده‌شده ثبت نشده است</p>
                    <p className="text-[11px] text-muted-foreground max-w-sm mx-auto leading-relaxed">
                      می‌توانید درس پیش‌نیاز را از کادر بالا انتخاب و ثبت کنید، یا در پنجره خطاهای چارت روی دکمه «پاس کردم» کلیک نمایید.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Dialog Footer */}
            <div className="p-3 sm:p-4 border-t bg-muted/30 flex items-center justify-end gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                onClick={() => setWaivedModalOpen(false)}
                className="h-8 px-5 text-xs font-semibold shadow-xs"
              >
                تأیید و بستن
              </Button>
            </div>
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
                                <span className="font-bold block">
                                  {sem.semesterNumber % 1 !== 0 ? `تابستان (${Math.floor(sem.semesterNumber)})` : `ترم ${sem.semesterNumber}`}
                                </span>
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

            <div className="p-3 sm:p-4 border-t bg-muted/30 flex items-center justify-end gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLoadApprovedModalOpen(false)}
                className="h-8 px-4 text-xs font-medium"
              >
                انصراف
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Term Weekly Schedule Planner Modal */}
        {activePlannerSemester !== null && (
          <TermSchedulePlanner
            chartId={chart.id}
            termIndex={activePlannerSemester}
            termCourses={(() => {
              const sem = chart.semesters.find((s) => s.semesterNumber === activePlannerSemester);
              if (!sem) return [];
              return sem.courseIds
                .map((cId) => allCourses.find((c) => c.id === cId))
                .filter(Boolean) as Course[];
            })()}
            allCategories={categories}
            allVisualCategories={categories}
            selectedEventsMap={
              chart.semesters.find((s) => s.semesterNumber === activePlannerSemester)?.courseEventsMap || {}
            }
            onEventSelect={handlePlannerEventSelect}
            onClose={() => setActivePlannerSemester(null)}
            user={user}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
