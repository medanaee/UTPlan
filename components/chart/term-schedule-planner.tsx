"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { toPng } from "html-to-image";
import { calculateSemesterForTerm, formatSemesterLabel } from "@/lib/semester-utils";
import { formatTermDisplay } from "@/lib/rules-engine";
import { persianSearch } from "@/lib/search/persian-search";
import { fetchJson, postJson, putJson, deleteJson } from "@/lib/api-client";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  CalendarDays,
  ArrowRight,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  ZoomIn,
  ZoomOut,
  Download,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Combobox } from "@/components/ui/combobox";
import { ExamScheduleModal } from "./exam-schedule-modal";
import type {
  Course,
  CourseOffering,
  CourseEvent,
  Category,
  VisualCategory,
  UserSession,
} from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface TermSchedulePlannerProps {
  chartId: string;
  termIndex: number;
  termCourses: Course[];
  allCategories?: Category[];
  allVisualCategories?: VisualCategory[];
  selectedEventsMap: Record<string, string>; // courseId -> eventId
  onEventSelect: (courseId: string, eventId: string | null) => Promise<void>;
  onClose: () => void;
  user?: UserSession | null;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "شنبه", shortLabel: "ش" },
  { value: 1, label: "یکشنبه", shortLabel: "ی" },
  { value: 2, label: "دوشنبه", shortLabel: "د" },
  { value: 3, label: "سه‌شنبه", shortLabel: "س" },
  { value: 4, label: "چهارشنبه", shortLabel: "چ" },
];

export const START_HOUR_OPTIONS = [
  "06:00",
  "06:30",
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
];

export const END_HOUR_OPTIONS = [
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
  "22:00",
];

function formatMinutesToTime(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function TermSchedulePlanner({
  chartId,
  termIndex,
  termCourses,
  allCategories,
  allVisualCategories,
  selectedEventsMap,
  onEventSelect,
  onClose,
  user,
}: TermSchedulePlannerProps) {
  const allCats = allCategories || allVisualCategories || [];
  const calculatedSemester = useMemo(() => {
    return calculateSemesterForTerm(user?.entrySemester, termIndex);
  }, [user?.entrySemester, termIndex]);

  const [events, setEvents] = useState<CourseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTerm, setActiveTerm] = useState<string>(calculatedSemester);

  // Sync activeTerm when calculatedSemester changes
  useEffect(() => {
    setActiveTerm(calculatedSemester);
  }, [calculatedSemester]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(
    termCourses[0]?.id || null
  );
  const [customEventCourse, setCustomEventCourse] = useState<Course | null>(null);
  const [editingCustomEvent, setEditingCustomEvent] = useState<CourseEvent | null>(null);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [savingCourseId, setSavingCourseId] = useState<string | null>(null);

  // Weekly Schedule Toolbar States
  const [zoom, setZoom] = useState(100);
  const [startHour, setStartHour] = useState("07:30");
  const [endHour, setEndHour] = useState("19:30");
  const [isExporting, setIsExporting] = useState(false);
  const scheduleRef = useRef<HTMLDivElement>(null);

  // Dynamic Time Calculations
  const startDayMinutes = useMemo(() => parseTimeToMinutes(startHour), [startHour]);
  const endDayMinutes = useMemo(() => parseTimeToMinutes(endHour), [endHour]);
  const totalDayMinutes = useMemo(
    () => Math.max(60, endDayMinutes - startDayMinutes),
    [startDayMinutes, endDayMinutes]
  );

  const timeColumns = useMemo(() => {
    if (endDayMinutes <= startDayMinutes) {
      return [{ start: startHour, end: endHour }];
    }
    const cols: { start: string; end: string }[] = [];
    const step = 90; // Standard 90-minute university blocks
    let cur = startDayMinutes;
    while (cur < endDayMinutes) {
      const next = Math.min(cur + step, endDayMinutes);
      cols.push({
        start: formatMinutesToTime(cur),
        end: formatMinutesToTime(next),
      });
      cur = next;
    }
    return cols;
  }, [startDayMinutes, endDayMinutes, startHour, endHour]);

  // Load available events for the term
  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchJson(`/api/events?term=${activeTerm}`);
      if (res.success && Array.isArray(res.data)) {
        setEvents(res.data);
      }
    } catch (err) {
      console.error("Error loading events in planner:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTerm]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Selected events array (both courses in termCourses and any custom events selected)
  const activeSelectedEvents = useMemo(() => {
    const list: { course: Course; event: CourseEvent }[] = [];

    // 1. Placed term courses
    for (const c of termCourses) {
      const evtId = selectedEventsMap[c.id];
      if (!evtId) continue;
      const evt = events.find((e) => e.id === evtId);
      if (evt) {
        list.push({ course: c, event: evt });
      }
    }

    // 2. Additional custom events
    for (const [key, evtId] of Object.entries(selectedEventsMap)) {
      if (!evtId) continue;
      if (list.some((item) => item.event.id === evtId)) continue;
      const evt = events.find((e) => e.id === evtId);
      if (evt) {
        const dummyCourse: Course = {
          id: evt.courseId || key,
          name: evt.courseName || "ارائه شخصی",
          code: evt.courseCode || "شخصی",
          facultyId: evt.facultyId || "",
          units: evt.courseUnits || 3,
          offeredIn: "both",
          createdAt: evt.createdAt || new Date().toISOString(),
        };
        list.push({ course: dummyCourse, event: evt });
      }
    }

    return list;
  }, [termCourses, selectedEventsMap, events]);

  // Conflict Detection
  const {
    classConflicts,
    examConflicts,
    sameHourExamConflicts,
    sameDayExamConflicts,
  } = useMemo(() => {
    const classConf: {
      courseA: Course;
      eventA: CourseEvent;
      courseB: Course;
      eventB: CourseEvent;
      dayOfWeek: number;
      timeA: string;
      timeB: string;
    }[] = [];

    const examConf: {
      courseA: Course;
      courseB: Course;
      examDate: string;
      timeA?: string;
      timeB?: string;
      isSameHour: boolean;
    }[] = [];

    // Class slot conflicts
    for (let i = 0; i < activeSelectedEvents.length; i++) {
      for (let j = i + 1; j < activeSelectedEvents.length; j++) {
        const itemA = activeSelectedEvents[i];
        const itemB = activeSelectedEvents[j];

        // Compare slots
        for (const slotA of itemA.event.slots || []) {
          for (const slotB of itemB.event.slots || []) {
            if (slotA.dayOfWeek === slotB.dayOfWeek) {
              const startA = parseTimeToMinutes(slotA.startTime);
              const endA = parseTimeToMinutes(slotA.endTime);
              const startB = parseTimeToMinutes(slotB.startTime);
              const endB = parseTimeToMinutes(slotB.endTime);

              const hasOverlap = startA < endB && startB < endA;
              if (hasOverlap) {
                classConf.push({
                  courseA: itemA.course,
                  eventA: itemA.event,
                  courseB: itemB.course,
                  eventB: itemB.event,
                  dayOfWeek: slotA.dayOfWeek,
                  timeA: `${slotA.startTime} تا ${slotA.endTime}`,
                  timeB: `${slotB.startTime} تا ${slotB.endTime}`,
                });
              }
            }
          }
        }

        // Compare exams
        if (
          itemA.event.examDate &&
          itemB.event.examDate &&
          itemA.event.examDate === itemB.event.examDate
        ) {
          const exStartA = itemA.event.examStartTime || "08:30";
          const exEndA = itemA.event.examEndTime || "11:00";
          const exStartB = itemB.event.examStartTime || "08:30";
          const exEndB = itemB.event.examEndTime || "11:00";

          const hasHourCollision = exStartA < exEndB && exStartB < exEndA;
          examConf.push({
            courseA: itemA.course,
            courseB: itemB.course,
            examDate: itemA.event.examDate,
            timeA: `${exStartA} تا ${exEndA}`,
            timeB: `${exStartB} تا ${exEndB}`,
            isSameHour: hasHourCollision,
          });
        }
      }
    }

    const sameHourExam = examConf.filter((e) => e.isSameHour);
    const sameDayExam = examConf.filter((e) => !e.isSameHour);

    return {
      classConflicts: classConf,
      examConflicts: examConf,
      sameHourExamConflicts: sameHourExam,
      sameDayExamConflicts: sameDayExam,
    };
  }, [activeSelectedEvents]);

  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);

  // Handle Delete Custom Event ("حذف کلی از بیخ")
  const handleDeleteCustomEvent = async (eventId: string, courseId?: string) => {
    if (
      !confirm(
        "آیا از حذف دائمی این ارائه شخصی اطمینان دارید؟ این ارائه به طور کامل از سیستم پاک خواهد شد."
      )
    ) {
      return;
    }
    const targetKey = courseId || eventId;
    try {
      setSavingCourseId(targetKey);
      const res = await deleteJson(`/api/events?id=${eventId}`);
      if (res.success) {
        if (selectedEventsMap[targetKey] === eventId) {
          await handleSelectEvent(targetKey, null);
        }
        await loadEvents();
      } else {
        alert(res.message || "خطا در حذف رویداد");
      }
    } catch (err) {
      console.error("Delete custom event error:", err);
      alert("خطا در برقراری ارتباط با سرور برای حذف رویداد.");
    } finally {
      setSavingCourseId(null);
    }
  };

  // Handle High-Res PNG Schedule Image Export
  const handleExportScheduleImage = async () => {
    if (!scheduleRef.current || isExporting) return;
    try {
      setIsExporting(true);

      const content = scheduleRef.current;
      const originalZoom = content.style.zoom;

      // 1. Temporarily reset zoom to 1 for crisp, unscaled capture
      content.style.zoom = "1";

      // 2. Allow DOM to complete reflow and paint
      await new Promise((resolve) => setTimeout(resolve, 200));

      const isDark = document.documentElement.classList.contains("dark");
      const backgroundColor = isDark ? "#09090b" : "#ffffff";

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
        console.warn("Retrying schedule image export at 1.5x with skipFonts...", firstErr);
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

      // 3. Restore original zoom
      content.style.zoom = originalZoom;

      // 4. Trigger download
      const termTitle = formatTermDisplay(termIndex);
      const safeTitle = `برنامه-هفتگی-${termTitle}-${activeTerm}`
        .replace(/[/\\?%*:|"<>]/g, "-")
        .trim();
      const link = document.createElement("a");
      link.download = `${safeTitle || "schedule"}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to export schedule image:", err);
      alert("خطا در تهیه خروجی تصویر از برنامه هفتگی. لطفاً دوباره تلاش کنید.");
    } finally {
      if (scheduleRef.current) {
        scheduleRef.current.style.zoom = `${zoom / 100}`;
      }
      setIsExporting(false);
    }
  };

  // Handle Event Select
  const handleSelectEvent = async (courseId: string, eventId: string | null) => {
    try {
      setSavingCourseId(courseId);
      await onEventSelect(courseId, eventId);
    } finally {
      setSavingCourseId(null);
    }
  };

  // Filtered sidebar courses
  const filteredCourses = useMemo(() => {
    return persianSearch(termCourses, searchQuery);
  }, [termCourses, searchQuery]);

  const totalUnits = useMemo(() => {
    return termCourses.reduce((sum, c) => sum + (c.units || 0), 0);
  }, [termCourses]);

  const selectedCount = useMemo(() => {
    return termCourses.filter((c) => Boolean(selectedEventsMap[c.id])).length;
  }, [termCourses, selectedEventsMap]);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col overflow-hidden">
      {/* Top Header Bar */}
      <header className="h-14 border-b bg-card px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="h-4 w-4" />
            <span className="hidden sm:inline">بازگشت به چارت</span>
          </Button>

          <div className="h-4 w-px bg-border/60" />

          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>برنامه‌ریزی زمانی {formatTermDisplay(termIndex)}</span>
                <Badge variant="secondary" className="text-xs font-bold gap-1 px-2.5 py-0.5">
                  <span>{formatSemesterLabel(activeTerm)}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">({activeTerm})</span>
                </Badge>
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Status Badges */}
          {classConflicts.length > 0 && (
            <Badge
              variant="destructive"
              className="text-xs gap-1 py-1 px-2.5 shadow-2xs animate-pulse"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{classConflicts.length} تداخل کلاسی</span>
            </Badge>
          )}

          {sameHourExamConflicts.length > 0 && (
            <Badge
              variant="destructive"
              className="text-xs gap-1 py-1 px-2.5 shadow-2xs animate-pulse"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>تداخل ساعت امتحان ({sameHourExamConflicts.length})</span>
            </Badge>
          )}

          {sameDayExamConflicts.length > 0 && (
            <Badge
              variant="destructive"
              className="text-xs gap-1 py-1 px-2.5 shadow-2xs animate-pulse"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>تداخل روز امتحان ({sameDayExamConflicts.length})</span>
            </Badge>
          )}

          {classConflicts.length === 0 &&
            sameHourExamConflicts.length === 0 &&
            sameDayExamConflicts.length === 0 && (
              <Badge
                variant="outline"
                className="text-xs gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 py-1 px-2.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">برنامه بدون تداخل</span>
              </Badge>
            )}

          {/* Export High-Quality Image Button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleExportScheduleImage}
            disabled={isExporting}
            title="دریافت خروجی تصویری باکیفیت از برنامه هفتگی (PNG)"
            className="h-8 gap-1.5 text-xs px-3 rounded-lg border border-border bg-background/50 text-foreground hover:bg-muted/70 transition-all shadow-2xs flex items-center cursor-pointer"
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
            ) : (
              <Camera className="h-3.5 w-3.5 text-primary shrink-0" />
            )}
            <span className="hidden sm:inline">
              {isExporting ? "در حال آماده‌سازی..." : "خروجی تصویر"}
            </span>
          </Button>

          {/* Exam Schedule Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExamModalOpen(true)}
            className="h-8 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>برنامه امتحانات</span>
            {examConflicts.length > 0 && (
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs font-bold"
          >
            ثبت و اتمام
          </Button>
        </div>
      </header>

      {/* Missing Entry Semester Warning Alert Banner */}
      {!user?.entrySemester && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-800 dark:text-amber-300 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              نیمسال ورود شما در پروفایل مشخص نشده است. برای تطابق و نمایش صحیح برنامه زمانی هر ترم، لطفاً ابتدا در پروفایل سال و دوره ورود خود را تنظیم کنید.
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            asChild
            className="h-7 text-xs border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 shrink-0 gap-1.5 font-bold"
          >
            <Link href="/profile" target="_blank">
              <ExternalLink className="h-3.5 w-3.5" />
              <span>تنظیم در پروفایل</span>
            </Link>
          </Button>
        </div>
      )}

      {/* Main Workspace (Sidebar + Timetable Grid) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Right Sidebar: Term Courses & Offerings */}
        <aside className="w-80 sm:w-96 border-l bg-card flex flex-col shrink-0 overflow-hidden shadow-sm">
          <div className="p-3.5 border-b space-y-2.5 bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                دروس انتخابی این ترم
              </span>
              <span className="text-[11px] text-muted-foreground ">
                {selectedCount} از {termCourses.length} درس دارای ارائه ({totalUnits} واحد)
              </span>
            </div>

            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute right-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی درس در این ترم..."
                className="h-8 pr-8 text-xs bg-background"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {filteredCourses.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                درسی در این ترم یافت نشد.
              </div>
            ) : (
              filteredCourses.map((course) => {
                const isExpanded = expandedCourseId === course.id;
                const selectedEventId = selectedEventsMap[course.id];
                const selectedEvent = events.find((e) => e.id === selectedEventId);

                const assign = course.trackAssignments?.[0];
                const catId = assign?.categoryId || (assign as any)?.visualCategoryId || (assign as any)?.ruleCategoryId;
                const catColor = catId
                  ? allCats.find((vc) => vc.id === catId)?.color || "#3b82f6"
                  : "#3b82f6";

                // Course available events
                const courseEvents = events.filter(
                  (e) =>
                    e.courseId === course.id ||
                    (e.courseCode && e.courseCode === course.code)
                );

                return (
                  <div
                    key={course.id}
                    className={`rounded-xl border transition-all overflow-hidden ${
                      isExpanded
                        ? "border-primary/40 shadow-xs bg-card ring-1 ring-primary/20"
                        : "border-border/60 bg-card/60 hover:border-border"
                    }`}
                  >
                    {/* Course Header Summary */}
                    <div
                      onClick={() =>
                        setExpandedCourseId(isExpanded ? null : course.id)
                      }
                      className="p-3 cursor-pointer flex items-center justify-between gap-2 select-none"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-2.5 h-7 rounded-full shrink-0"
                          style={{ backgroundColor: catColor }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-foreground truncate">
                              {course.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground  shrink-0">
                              ({course.units} واحد)
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {selectedEvent ? (
                              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 truncate">
                                <Check className="h-3 w-3 shrink-0" />
                                {selectedEvent.professorName} {selectedEvent.code ? `(${selectedEvent.code})` : ""}
                              </span>
                            ) : (
                              <span className="text-[11px] text-amber-600 dark:text-amber-400">
                                بدون ارائه انتخابی
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Offerings & Events List */}
                    {isExpanded && (
                      <div className="border-t bg-muted/10 p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-muted-foreground">
                            ارائه‌های موجود برای این ترم:
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setCustomEventCourse(course)}
                            className="h-6 text-[11px] text-primary gap-1 p-1 hover:bg-primary/10"
                          >
                            <Sparkles className="h-3 w-3" />
                            ارائه شخصی
                          </Button>
                        </div>

                        {courseEvents.length === 0 ? (
                          <div className="p-3 rounded-lg border border-dashed text-center space-y-2 bg-background/50">
                            <p className="text-[11px] text-muted-foreground">
                              هیچ ارائه‌ای برای این درس در نیمسال {activeTerm} ثبت نشده است.
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setCustomEventCourse(course)}
                              className="h-7 text-xs gap-1.5 text-primary border-primary/30 w-full"
                            >
                              <Plus className="h-3 w-3" />
                              تعریف ساعت کلاسی شخصی برای این درس
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {courseEvents.map((evt) => {
                              const isSelected = selectedEventId === evt.id;

                              return (
                                <div
                                  key={evt.id}
                                  onMouseEnter={() => setHoveredEventId(evt.id)}
                                  onMouseLeave={() => setHoveredEventId(null)}
                                  className={`p-2.5 rounded-lg border transition-all space-y-1.5 ${
                                    isSelected
                                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                                      : "border-border/60 bg-card hover:border-primary/40 hover:bg-accent/30"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <User className="h-3.5 w-3.5 text-primary shrink-0" />
                                      <span className="font-bold text-xs text-foreground truncate">
                                        {evt.professorName}
                                      </span>
                                      {evt.code && (
                                        <Badge
                                          variant="outline"
                                          className="text-[9px] font-mono px-1 py-0"
                                        >
                                          {evt.code}
                                        </Badge>
                                      )}
                                      {evt.isUserCustom && (
                                        <Badge
                                          variant="secondary"
                                          className="text-[9px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                                        >
                                          شخصی
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1">
                                      {evt.isUserCustom && (
                                        <>
                                          <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setCustomEventCourse(course);
                                              setEditingCustomEvent(evt);
                                            }}
                                            className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                            title="ویرایش ارائه شخصی"
                                          >
                                            <Pencil className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteCustomEvent(evt.id, course.id);
                                            }}
                                            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                            title="حذف کلی ارائه شخصی (قبل از تایید مدیر)"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </>
                                      )}
                                      <Button
                                        size="sm"
                                        variant={isSelected ? "destructive" : "default"}
                                        disabled={savingCourseId === course.id}
                                        onClick={() =>
                                          handleSelectEvent(
                                            course.id,
                                            isSelected ? null : evt.id
                                          )
                                        }
                                        className="h-6 text-[11px] px-2"
                                      >
                                        {isSelected ? "حذف" : "انتخاب"}
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Slots list */}
                                  <div className="space-y-1 text-[11px] text-muted-foreground">
                                    {evt.slots && evt.slots.length > 0 ? (
                                      evt.slots.map((s, idx) => (
                                        <div
                                          key={idx}
                                          className="flex items-center gap-1.5 "
                                        >
                                          <Clock className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                                          <span>
                                            {DAYS_OF_WEEK.find(
                                              (d) => d.value === s.dayOfWeek
                                            )?.label || "شنبه"}
                                            : {s.startTime} تا {s.endTime}
                                          </span>
                                        </div>
                                      ))
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground italic">
                                        ساعت کلاسی ثبت نشده
                                      </span>
                                    )}

                                    {evt.examDate && (
                                      <div className="flex items-center gap-1.5 text-[10px] text-amber-700 dark:text-amber-300 pt-0.5">
                                        <CalendarDays className="h-3 w-3 shrink-0" />
                                        <span>
                                          امتحان: {evt.examDate} ({evt.examStartTime || "۰۸:۳۰"})
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Left/Main Area: Interactive Weekly Timetable Grid */}
        <main className="flex-1 flex flex-col overflow-hidden bg-muted/10">
          {/* Sub-toolbar row above the timetable */}
          <div className="shrink-0 h-8 sm:h-8.5 border-b border-border/70 bg-card/90 backdrop-blur flex items-stretch justify-between z-20 select-none p-0 overflow-x-auto overflow-y-hidden">
            {/* Right side (start in RTL): Zoom Controller & Time Window */}
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
                  className="h-6 px-1.5 text-xs font-bold text-foreground hover:bg-muted/70 transition-colors cursor-pointer rounded-md flex items-center justify-center font-mono"
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

              {/* Start and End Hour Controls (Shadcn UI Select) */}
              <div className="flex items-center px-2 sm:px-3 gap-2 h-full border-l border-border/70 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="hidden sm:inline font-medium text-foreground text-[11px]">بازه ساعت:</span>

                <div className="flex items-center gap-1">
                  <span className="text-[11px]">از</span>
                  <Select value={startHour} onValueChange={setStartHour}>
                    <SelectTrigger
                      className="h-full! w-fit font-mono px-1.5 gap-1 border-x rounded-none! border-border/60 bg-transparent dark:bg-transparent hover:bg-muted/60"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {START_HOUR_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt} className="text-xs font-mono">
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[11px]">تا</span>
                  <Select value={endHour} onValueChange={setEndHour}>
                    <SelectTrigger
                      className="h-full! w-fit font-mono px-1.5 gap-1 border-x rounded-none! border-border/60 bg-transparent dark:bg-transparent hover:bg-muted/60"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {END_HOUR_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt} className="text-xs font-mono">
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Left side (in RTL): Clean schedule days hint */}
            <div className="flex items-center px-3 h-full text-[11px] text-muted-foreground font-medium select-none">
              <span>شنبه تا چهارشنبه</span>
            </div>
          </div>

          {/* Class Conflict Alert Banner */}
          {classConflicts.length > 0 && (
            <div className="p-3 px-5 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 animate-bounce" />
                <span className="font-bold">تداخل زمانی کلاس‌ها:</span>
                <span>
                  {classConflicts.map((c, i) => (
                    <span key={i} className="mr-1">
                      «{c.courseA.name}» با «{c.courseB.name}» در روز{" "}
                      {DAYS_OF_WEEK.find((d) => d.value === c.dayOfWeek)?.label} ({c.timeA})
                      {i < classConflicts.length - 1 ? " | " : ""}
                    </span>
                  ))}
                </span>
              </div>
            </div>
          )}

          {/* Critical Exam Time Collision Banner (Red) */}
          {sameHourExamConflicts.length > 0 && (
            <div className="p-3 px-5 bg-destructive/15 border-b border-destructive/30 text-destructive text-xs flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 shrink-0 animate-pulse" />
                <span className="font-bold">تداخل همزمان ساعت امتحان (بحرانی):</span>
                <span>
                  {sameHourExamConflicts.map((c, i) => (
                    <span key={i} className="mr-1">
                      امتحان «{c.courseA.name}» ({c.timeA}) با «{c.courseB.name}» ({c.timeB}) در تاریخ {c.examDate} همپوشانی دارند!
                      {i < sameHourExamConflicts.length - 1 ? " | " : ""}
                    </span>
                  ))}
                </span>
              </div>
            </div>
          )}

          {/* Same Day Exam Warning Banner (Amber / Yellow) */}
          {sameDayExamConflicts.length > 0 && (
            <div className="p-3 px-5 bg-amber-500/10 border-b border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="font-bold">هشدار همزمانی روز امتحان:</span>
                <span>
                  {sameDayExamConflicts.map((c, i) => (
                    <span key={i} className="mr-1">
                      در تاریخ {c.examDate} دو امتحان دارید: «{c.courseA.name}» ({c.timeA}) و «{c.courseB.name}» ({c.timeB})
                      {i < sameDayExamConflicts.length - 1 ? " | " : ""}
                    </span>
                  ))}
                </span>
              </div>
            </div>
          )}

          {/* Timetable Grid Canvas */}
          <div className="flex-1 overflow-auto p-4 sm:p-6 flex flex-col min-w-175">
            <div
              ref={scheduleRef}
              style={{ zoom: `${zoom / 100}` }}
              className="flex-1 rounded-2xl border bg-card shadow-xs flex flex-col overflow-hidden"
            >
              {/* Header Title for Image Export & Clarity */}
              <div className="px-4 py-2.5 border-b bg-muted/40 flex items-center justify-between text-xs select-none">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>برنامه زمانی هفتگی {formatTermDisplay(termIndex)}</span>
                  <span className="text-[11px] font-normal text-muted-foreground">({formatSemesterLabel(activeTerm)})</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                  <span>ساعت: {startHour} تا {endHour}</span>
                  <span>•</span>
                  <span>{activeSelectedEvents.length} درس فعال</span>
                </div>
              </div>

              {/* Hours Header Row */}
              <div className="h-10 border-b bg-muted/30 flex items-center text-xs text-muted-foreground select-none">
                <div className="w-20 border-l h-full flex items-center justify-center font-sans font-bold text-foreground text-[11px]">
                  روز / ساعت
                </div>
                <div className="flex-1 flex h-full relative">
                  {timeColumns.map((col, idx) => (
                    <div
                      key={idx}
                      className="flex-1 border-l last:border-l-0 h-full flex items-center justify-center text-[10px] sm:text-[11px] font-mono"
                    >
                      {col.start}
                    </div>
                  ))}
                </div>
              </div>

              {/* 5 Day Rows */}
              <div className="flex-1 flex flex-col divide-y divide-border/60">
                {DAYS_OF_WEEK.map((day) => {
                  return (
                    <div
                      key={day.value}
                      className="flex-1 flex min-h-22.5 group relative hover:bg-muted/10 transition-colors"
                    >
                      {/* Day Label Column */}
                      <div className="w-20 border-l bg-muted/15 flex flex-col items-center justify-center gap-0.5 select-none shrink-0">
                        <span className="font-bold text-xs text-foreground">
                          {day.label}
                        </span>
                      </div>

                      {/* Timeline Slots Container */}
                      <div className="flex-1 relative flex">
                        {/* Background Grid Lines */}
                        {timeColumns.map((_, idx) => (
                          <div
                            key={idx}
                            className="flex-1 border-l last:border-l-0 h-full pointer-events-none border-dashed border-border/30"
                          />
                        ))}

                        {/* Render Active Selected Course Slots */}
                        {activeSelectedEvents.map(({ course, event }) => {
                          const assign = course.trackAssignments?.[0];
                          const catId = assign?.categoryId || (assign as any)?.visualCategoryId || (assign as any)?.ruleCategoryId;
                          const catColor = catId
                            ? allCats.find((vc) => vc.id === catId)?.color || "#3b82f6"
                            : "#3b82f6";

                          const daySlots = (event.slots || []).filter(
                            (s) => s.dayOfWeek === day.value
                          );

                          return daySlots.map((slot, sIdx) => {
                            const startMin = parseTimeToMinutes(slot.startTime);
                            const endMin = parseTimeToMinutes(slot.endTime);

                            const rightPercent = Math.max(
                              0,
                              ((startMin - startDayMinutes) / totalDayMinutes) * 100
                            );
                            const widthPercent = Math.min(
                              100 - rightPercent,
                              ((endMin - startMin) / totalDayMinutes) * 100
                            );

                            const hasConflict = classConflicts.some(
                              (c) =>
                                c.dayOfWeek === day.value &&
                                (c.courseA.id === course.id ||
                                  c.courseB.id === course.id)
                            );

                            return (
                              <div
                                key={`${course.id}_${event.id}_${sIdx}`}
                                style={{
                                  right: `${rightPercent}%`,
                                  width: `${widthPercent}%`,
                                }}
                                className={`absolute top-1.5 bottom-1.5 rounded-xl p-2.5 z-10 transition-all flex flex-col justify-between shadow-xs select-none ${
                                  hasConflict
                                    ? "border-2 border-destructive bg-destructive/15 text-destructive animate-pulse"
                                    : "border text-foreground hover:scale-[1.01] hover:z-20 shadow-md"
                                }`}
                              >
                                <div
                                  className="absolute inset-0 rounded-xl opacity-15"
                                  style={{ backgroundColor: catColor }}
                                />

                                <div className="relative z-10 space-y-0.5">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-bold text-xs truncate">
                                      {course.name}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="text-[9px]  px-1 py-0 shrink-0 bg-background/80"
                                    >
                                      {course.code}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                                    <User className="h-3 w-3 shrink-0" />
                                    <span>{event.professorName}</span>
                                  </div>
                                </div>

                                <div className="relative z-10 flex items-center justify-between text-[10px] text-muted-foreground  pt-1 border-t border-border/30">
                                  <span className="flex items-center gap-0.5">
                                    <Clock className="h-2.5 w-2.5" />
                                    {slot.startTime} - {slot.endTime}
                                  </span>
                                  {event.location && (
                                    <span className="truncate max-w-20">
                                      {event.location}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })}

                        {/* Render Hovered Event Preview (Translucent Ghost Block) */}
                        {hoveredEventId && (() => {
                          const hEvt = events.find((e) => e.id === hoveredEventId);
                          if (!hEvt) return null;
                          const isAlreadySelected = activeSelectedEvents.some(
                            (item) => item.event.id === hoveredEventId
                          );
                          if (isAlreadySelected) return null;

                          const daySlots = (hEvt.slots || []).filter(
                            (s) => s.dayOfWeek === day.value
                          );

                          return daySlots.map((slot, hIdx) => {
                            const startMin = parseTimeToMinutes(slot.startTime);
                            const endMin = parseTimeToMinutes(slot.endTime);

                            const rightPercent = Math.max(
                              0,
                              ((startMin - startDayMinutes) / totalDayMinutes) * 100
                            );
                            const widthPercent = Math.min(
                              100 - rightPercent,
                              ((endMin - startMin) / totalDayMinutes) * 100
                            );

                            return (
                              <div
                                key={`hover_${hIdx}`}
                                style={{
                                  right: `${rightPercent}%`,
                                  width: `${widthPercent}%`,
                                }}
                                className="absolute top-1.5 bottom-1.5 rounded-xl p-2.5 z-20 border-2 border-dashed border-primary bg-primary/20 text-primary pointer-events-none flex flex-col justify-between shadow-lg animate-pulse"
                              >
                                <div>
                                  <div className="font-bold text-xs truncate">
                                    پیش‌نمایش: {hEvt.courseName}
                                  </div>
                                  <div className="text-[10px] truncate">
                                    {hEvt.professorName}
                                  </div>
                                </div>
                                <div className="text-[10px] ">
                                  {slot.startTime} - {slot.endTime}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      </div>

      

      {/* Custom Event Creator / Editor Dialog */}
      <CustomEventDialog
        course={customEventCourse}
        courses={termCourses}
        term={activeTerm}
        eventToEdit={editingCustomEvent}
        open={Boolean(customEventCourse) || Boolean(editingCustomEvent)}
        onOpenChange={(open) => {
          if (!open) {
            setCustomEventCourse(null);
            setEditingCustomEvent(null);
          }
        }}
        onCreated={async (newEvent) => {
          const targetCourseId = customEventCourse?.id || newEvent.courseId;
          setEvents((prev) => [newEvent, ...prev.filter((e) => e.id !== newEvent.id)]);
          await loadEvents();
          if (targetCourseId && newEvent.id && !editingCustomEvent) {
            handleSelectEvent(targetCourseId, newEvent.id);
          }
          setEditingCustomEvent(null);
        }}
      />

      {/* Exam Schedule Modal */}
      <ExamScheduleModal
        open={examModalOpen}
        onOpenChange={setExamModalOpen}
        termIndex={termIndex}
        courses={termCourses}
        selectedEventsMap={selectedEventsMap}
        allEvents={events}
        categories={allCats}
      />
    </div>
  );
}

interface CustomEventDialogProps {
  course: Course | null;
  courses?: Course[];
  term: string;
  open: boolean;
  eventToEdit?: CourseEvent | null;
  onOpenChange: (open: boolean) => void;
  onCreated: (event: CourseEvent) => void;
}

function CustomEventDialog({
  course,
  courses,
  term,
  open,
  eventToEdit,
  onOpenChange,
  onCreated,
}: CustomEventDialogProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(course?.id || "");

  useEffect(() => {
    if (course?.id) {
      setSelectedCourseId(course.id);
    } else if (eventToEdit?.courseId) {
      setSelectedCourseId(eventToEdit.courseId);
    } else if (courses && courses.length > 0) {
      setSelectedCourseId(courses[0].id);
    }
  }, [course, eventToEdit, courses, open]);

  const activeCourse = useMemo(() => {
    return (courses || []).find((c) => c.id === selectedCourseId) || course;
  }, [courses, selectedCourseId, course]);

  const [offerings, setOfferings] = useState<CourseOffering[]>([]);
  const [loadingOfferings, setLoadingOfferings] = useState(false);
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>("");
  const [location, setLocation] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examStartTime, setExamStartTime] = useState("08:30");
  const [examEndTime, setExamEndTime] = useState("11:00");
  const [slots, setSlots] = useState<{ dayOfWeek: number; startTime: string; endTime: string }[]>([
    { dayOfWeek: 0, startTime: "10:30", endTime: "12:00" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch registered offerings (professors) for this specific course
  useEffect(() => {
    if (!activeCourse || !open) return;
    let isMounted = true;
    setLoadingOfferings(true);
    fetchJson(`/api/offerings?courseId=${activeCourse.id}`)
      .then((res) => {
        if (isMounted && res.success && Array.isArray(res.data)) {
          setOfferings(res.data);
          if (eventToEdit) {
            setSelectedOfferingId(eventToEdit.offeringId || (res.data[0]?.id ?? ""));
          } else {
            setSelectedOfferingId(res.data[0]?.id ?? "");
          }
        }
      })
      .catch((err) => console.error("Error loading offerings:", err))
      .finally(() => {
        if (isMounted) setLoadingOfferings(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeCourse, open, eventToEdit]);

  useEffect(() => {
    if (eventToEdit) {
      setSelectedOfferingId(eventToEdit.offeringId || "");
      setLocation(eventToEdit.location || "");
      setExamDate(eventToEdit.examDate || "");
      setExamStartTime(eventToEdit.examStartTime || "08:30");
      setExamEndTime(eventToEdit.examEndTime || "11:00");
      if (eventToEdit.slots && eventToEdit.slots.length > 0) {
        setSlots(
          eventToEdit.slots.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          }))
        );
      } else {
        setSlots([{ dayOfWeek: 0, startTime: "10:30", endTime: "12:00" }]);
      }
    } else {
      setLocation("");
      setExamDate("");
      setExamStartTime("08:30");
      setExamEndTime("11:00");
      setSlots([{ dayOfWeek: 0, startTime: "10:30", endTime: "12:00" }]);
    }
  }, [eventToEdit, open]);

  if (!activeCourse) return null;

  const handleAddSlot = () => {
    setSlots((prev) => [...prev, { dayOfWeek: 2, startTime: "10:30", endTime: "12:00" }]);
  };

  const handleRemoveSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateSlot = (
    index: number,
    field: "dayOfWeek" | "startTime" | "endTime",
    value: any
  ) => {
    setSlots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const isExamTimeInvalid =
    examStartTime &&
    examEndTime &&
    parseTimeToMinutes(examStartTime) >= parseTimeToMinutes(examEndTime);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!selectedOfferingId) {
      setError("لطفاً یک ارائه (استاد) برای این درس انتخاب کنید.");
      return;
    }
    if (slots.length === 0) {
      setError("لطفاً حداقل یک جلسه کلاسی هفتگی تعریف کنید.");
      return;
    }

    // Validate slots time order
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const startMin = parseTimeToMinutes(slot.startTime);
      const endMin = parseTimeToMinutes(slot.endTime);
      const dayName = DAYS_OF_WEEK.find((d) => d.value === slot.dayOfWeek)?.label || "کلاس";

      if (startMin >= endMin) {
        setError(
          "خطای زمان‌بندی: ساعت پایان کلاس در روز «" + dayName + "» (" + slot.endTime + ") باید بعد از ساعت شروع (" + slot.startTime + ") باشد."
        );
        return;
      }
    }

    // Validate exam time order
    if (examDate && isExamTimeInvalid) {
      setError(
        "خطای زمان آزمون: ساعت پایان امتحان (" + examEndTime + ") باید بعد از ساعت شروع (" + examStartTime + ") باشد."
      );
      return;
    }

    try {
      setSaving(true);

      if (eventToEdit) {
        // Edit existing custom event
        const res = await putJson("/api/events", {
          id: eventToEdit.id,
          offeringId: selectedOfferingId,
          term: term || "1403-1",
          location: location.trim(),
          examDate,
          examStartTime,
          examEndTime,
          slots,
        });

        if (!res.success) {
          setError(res.message || "خطا در ویرایش رویداد شخصی");
          return;
        }

        const selectedOffering = offerings.find((o) => o.id === selectedOfferingId);
        onCreated({
          ...eventToEdit,
          offeringId: selectedOfferingId,
          professorName: selectedOffering?.professorName || eventToEdit.professorName,
          professorId: selectedOffering?.professorId || eventToEdit.professorId,
          location: location.trim(),
          examDate,
          examStartTime,
          examEndTime,
          slots: slots.map((s) => ({
            id: `slot_${crypto.randomUUID().slice(0, 8)}`,
            eventId: eventToEdit.id,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
        });
        onOpenChange(false);
      } else {
        // Create new
        const res = await postJson("/api/events", {
          offeringId: selectedOfferingId,
          term: term || "1403-1",
          location: location.trim(),
          examDate,
          examStartTime,
          examEndTime,
          slots,
          isUserCustom: true,
        });

        if (!res.success || !res.data) {
          setError(res.message || "خطا در ثبت رویداد شخصی");
          return;
        }

        onCreated(res.data);
        onOpenChange(false);
      }

      // Reset form
      setLocation("");
      setExamDate("");
      setSlots([{ dayOfWeek: 0, startTime: "10:30", endTime: "12:00" }]);
    } catch (err: any) {
      console.error("Custom event creation/edit error:", err);
      setError("خطا در ارتباط با سرور");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>{eventToEdit ? `ویرایش ارائه شخصی برای ${activeCourse.name}` : `تعریف ارائه شخصی برای ${activeCourse.name}`}</span>
                <Badge variant="outline" className="text-[10px] ">
                  {activeCourse.code}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                {eventToEdit
                  ? "مشخصات ارائه شخصی خود را ویرایش کنید."
                  : "این ارائه به صورت اختصاصی برای شما ذخیره می‌شود و می‌توانید آن را در چارت و برنامه هفتگی خود قرار دهید."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form id="custom-event-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{error}</span>
            </div>
          )}

          {/* Course Selector (if multiple courses available and not editing) */}
          {courses && courses.length > 1 && !eventToEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                انتخاب درس مربوطه *
              </Label>
              <Combobox
                items={courses.map((c) => ({
                  value: c.id,
                  label: c.name,
                  sublabel: `${c.code} (${c.units} واحد)`,
                  keywords: [c.name, c.code],
                }))}
                value={selectedCourseId}
                onChange={(val) => {
                  setSelectedCourseId(val);
                  setSelectedOfferingId("");
                }}
                placeholder="-- انتخاب یا جستجوی درس --"
                searchPlaceholder="جستجوی درس..."
              />
            </div>
          )}

          {/* Offering (Professor) Select */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-primary" />
              انتخاب استاد / ارائه درس *
            </Label>
            {loadingOfferings ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 border rounded-md">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                در حال بارگذاری اساتید درس...
              </div>
            ) : offerings.length === 0 ? (
              <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs">
                هیچ ارائه رسمی (استادی) برای این درس در سامانه تعریف نشده است. لطفاً ابتدا از ادمین بخواهید استاد درس را ثبت کند.
              </div>
            ) : (
              <Combobox
                items={offerings.map((off) => ({
                  value: off.id,
                  label: off.professorName || "استاد نامشخص",
                  sublabel: off.professorTitle || undefined,
                  keywords: [off.professorName || "", off.professorTitle || ""],
                }))}
                value={selectedOfferingId}
                onChange={setSelectedOfferingId}
                placeholder="-- انتخاب یا جستجوی استاد --"
                searchPlaceholder="جستجوی نام استاد..."
              />
            )}
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              مکان کلاس / اتاق (اختیاری)
            </Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="مثال: دانشکده فنی - کلاس ۱۰۴ یا آنلاین"
              className="text-xs"
            />
          </div>

          {/* Weekly Time Slots */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" />
                ساعات هفتگی برگزاری کلاس
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddSlot}
                className="h-7 text-xs gap-1 border-dashed text-primary border-primary/30"
              >
                <Plus className="h-3 w-3" />
                افزودن روز دیگر
              </Button>
            </div>

            <div className="space-y-2">
              {slots.map((slot, idx) => {
                const isInvalid =
                  parseTimeToMinutes(slot.startTime) >= parseTimeToMinutes(slot.endTime);

                return (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl border transition-all shadow-2xs space-y-1.5 ${
                      isInvalid
                        ? "border-destructive/60 bg-destructive/5 ring-1 ring-destructive/30"
                        : "border-border/70 bg-card/60"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="w-28 shrink-0">
                        <Select
                          value={String(slot.dayOfWeek)}
                          onValueChange={(val) =>
                            handleUpdateSlot(idx, "dayOfWeek", Number(val))
                          }
                        >
                          <SelectTrigger className="w-full text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {DAYS_OF_WEEK.map((d) => (
                                <SelectItem key={d.value} value={String(d.value)} className="text-xs">
                                  {d.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-1.5 flex-1 min-w-50">
                        <span className="text-[11px] text-muted-foreground">از</span>
                        <TimePicker
                          value={slot.startTime}
                          onChange={(t) => handleUpdateSlot(idx, "startTime", t)}
                          className="flex-1"
                        />
                        <span className="text-[11px] text-muted-foreground">تا</span>
                        <TimePicker
                          value={slot.endTime}
                          onChange={(t) => handleUpdateSlot(idx, "endTime", t)}
                          className="flex-1"
                        />
                      </div>

                      {slots.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveSlot(idx)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* Inline Time Conflict Warning */}
                    {isInvalid && (
                      <div className="text-[11px] text-destructive flex items-center gap-1 pt-0.5 font-medium">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span>ساعت پایان کلاس باید بعد از ساعت شروع باشد.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Exam Details */}
          <div className="space-y-2.5 pt-2 border-t border-border/50">
            <Label className="text-xs font-bold flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              زمان امتحان پایان‌ترم (اختیاری)
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground">تاریخ شمسی امتحان</span>
                <JalaliDatePicker
                  value={examDate}
                  onChange={setExamDate}
                  placeholder="انتخاب تاریخ امتحان"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground">بازه ساعت امتحان</span>
                <div className="flex items-center gap-1">
                  <TimePicker
                    value={examStartTime}
                    onChange={setExamStartTime}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground">تا</span>
                  <TimePicker
                    value={examEndTime}
                    onChange={setExamEndTime}
                    className="flex-1"
                  />
                </div>
                {isExamTimeInvalid && (
                  <div className="text-[11px] text-destructive flex items-center gap-1 pt-0.5 font-medium">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    <span>ساعت پایان آزمون باید بعد از شروع باشد.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>

        <DialogFooter className="pt-3 border-t" dir="ltr">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            انصراف
          </Button>
          <Button
            size="sm"
            type="submit"
            form="custom-event-form"
            onClick={() => handleSubmit()}
            disabled={saving || offerings.length === 0}
            className="gap-1.5 font-bold"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال ثبت...
              </>
            ) : eventToEdit ? (
              <>
                <Sparkles className="h-4 w-4" />
                ذخیره تغییرات ارائه شخصی
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                ثبت ارائه شخصی و افزودن به چارت
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
