"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  BookOpen,
  CalendarDays,
  ArrowRight,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Eye,
  Info,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CustomEventDialog } from "./custom-event-dialog";
import { ExamScheduleModal } from "./exam-schedule-modal";
import type {
  Course,
  CourseEvent,
  CourseEventSlot,
  VisualCategory,
  UserSession,
} from "@/lib/types";

interface TermSchedulePlannerProps {
  chartId: string;
  termIndex: number;
  termCourses: Course[];
  allVisualCategories: VisualCategory[];
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

const TIME_MARKS = [
  { time: "07:30", minutes: 450 },
  { time: "09:00", minutes: 540 },
  { time: "10:30", minutes: 630 },
  { time: "12:00", minutes: 720 },
  { time: "13:30", minutes: 810 },
  { time: "15:00", minutes: 900 },
  { time: "16:30", minutes: 990 },
  { time: "18:00", minutes: 1080 },
  { time: "19:30", minutes: 1170 },
];

const START_DAY_MINUTES = 450; // 07:30
const TOTAL_DAY_MINUTES = 720; // 12 hours (07:30 to 19:30)

function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function TermSchedulePlanner({
  chartId,
  termIndex,
  termCourses,
  allVisualCategories,
  selectedEventsMap,
  onEventSelect,
  onClose,
  user,
}: TermSchedulePlannerProps) {
  const [events, setEvents] = useState<CourseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTerm, setActiveTerm] = useState<string>("1403-1");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(
    termCourses[0]?.id || null
  );
  const [customEventCourse, setCustomEventCourse] = useState<Course | null>(null);
  const [editingCustomEvent, setEditingCustomEvent] = useState<CourseEvent | null>(null);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [savingCourseId, setSavingCourseId] = useState<string | null>(null);

  // Load available events for the term
  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/events?term=${activeTerm}`).then((r) => r.json());
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

  // Selected events array
  const activeSelectedEvents = useMemo(() => {
    return termCourses
      .map((c) => {
        const evtId = selectedEventsMap[c.id];
        if (!evtId) return null;
        const evt = events.find((e) => e.id === evtId);
        return evt ? { course: c, event: evt } : null;
      })
      .filter(Boolean) as { course: Course; event: CourseEvent }[];
  }, [termCourses, selectedEventsMap, events]);

  // Conflict Detection
  const { classConflicts, examConflicts } = useMemo(() => {
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
            isSameHour: hasHourCollision,
          });
        }
      }
    }

    return { classConflicts: classConf, examConflicts: examConf };
  }, [activeSelectedEvents]);

  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);

  // Handle Delete Custom Event
  const handleDeleteCustomEvent = async (eventId: string, courseId: string) => {
    if (!confirm("آیا از حذف این ارائه شخصی اطمینان دارید؟")) return;
    try {
      setSavingCourseId(courseId);
      const res = await fetch(`/api/events?id=${eventId}`, { method: "DELETE" }).then((r) => r.json());
      if (res.success) {
        if (selectedEventsMap[courseId] === eventId) {
          await handleSelectEvent(courseId, null);
        }
        await loadEvents();
      } else {
        alert(res.message || "خطا در حذف رویداد");
      }
    } catch (err) {
      console.error("Delete custom event error:", err);
    } finally {
      setSavingCourseId(null);
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
    if (!searchQuery.trim()) return termCourses;
    const q = searchQuery.toLowerCase().trim();
    return termCourses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
    );
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
                برنامه‌ریزی زمانی ترم {termIndex}
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {activeTerm}
                </Badge>
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Status Badges */}
          {classConflicts.length > 0 ? (
            <Badge
              variant="destructive"
              className="text-xs gap-1 py-1 px-2.5 shadow-2xs animate-pulse"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{classConflicts.length} تداخل کلاسی</span>
            </Badge>
          ) : examConflicts.some((e) => e.isSameHour) ? (
            <Badge
              variant="destructive"
              className="text-xs gap-1 py-1 px-2.5 shadow-2xs"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>تداخل ساعت امتحان</span>
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-xs gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 py-1 px-2.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">بدون تداخل کلاسی</span>
            </Badge>
          )}

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

      {/* Main Workspace (Sidebar + Timetable Grid) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Right Sidebar: Term Courses & Offerings */}
        <aside className="w-80 sm:w-96 border-l bg-card flex flex-col shrink-0 overflow-hidden shadow-sm">
          <div className="p-3.5 border-b space-y-2.5 bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                دروس انتخابی این ترم
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">
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

                // Visual category color
                const catColor =
                  course.trackAssignments?.[0]?.visualCategoryId
                    ? allVisualCategories.find(
                        (vc) =>
                          vc.id === course.trackAssignments?.[0]?.visualCategoryId
                      )?.color || "#3b82f6"
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
                            <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                              ({course.units} واحد)
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {selectedEvent ? (
                              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 truncate">
                                <Check className="h-3 w-3 shrink-0" />
                                {selectedEvent.professorName} (گروه {selectedEvent.groupCode || "۰۱"})
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
                              هیچ ارائه رسمی برای این درس در ترم {activeTerm} ثبت نشده است.
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
                                      {evt.groupCode && (
                                        <Badge
                                          variant="outline"
                                          className="text-[9px] font-mono px-1 py-0"
                                        >
                                          گروه {evt.groupCode}
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
                                            title="حذف ارائه شخصی"
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
                                          className="flex items-center gap-1.5 font-mono"
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
          {/* Conflict Alert Banner */}
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

          {/* Timetable Grid Canvas */}
          <div className="flex-1 overflow-auto p-4 sm:p-6 flex flex-col min-w-[700px]">
            <div className="flex-1 rounded-2xl border bg-card shadow-xs flex flex-col overflow-hidden">
              {/* Hours Header Row */}
              <div className="h-10 border-b bg-muted/30 flex items-center text-xs font-mono text-muted-foreground select-none">
                <div className="w-20 border-l h-full flex items-center justify-center font-sans font-bold text-foreground text-[11px]">
                  روز / ساعت
                </div>
                <div className="flex-1 flex h-full relative">
                  {TIME_MARKS.map((mark, idx) => (
                    <div
                      key={idx}
                      className="flex-1 border-l last:border-l-0 h-full flex items-center justify-center text-[11px]"
                    >
                      {mark.time}
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
                      className="flex-1 flex min-h-[90px] group relative hover:bg-muted/10 transition-colors"
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
                        {TIME_MARKS.map((_, idx) => (
                          <div
                            key={idx}
                            className="flex-1 border-l last:border-l-0 h-full pointer-events-none border-dashed border-border/30"
                          />
                        ))}

                        {/* Render Active Selected Course Slots */}
                        {activeSelectedEvents.map(({ course, event }) => {
                          const catColor =
                            course.trackAssignments?.[0]?.visualCategoryId
                              ? allVisualCategories.find(
                                  (vc) =>
                                    vc.id ===
                                    course.trackAssignments?.[0]
                                      ?.visualCategoryId
                                )?.color || "#3b82f6"
                              : "#3b82f6";

                          const daySlots = (event.slots || []).filter(
                            (s) => s.dayOfWeek === day.value
                          );

                          return daySlots.map((slot, sIdx) => {
                            const startMin = parseTimeToMinutes(slot.startTime);
                            const endMin = parseTimeToMinutes(slot.endTime);

                            const leftPercent = Math.max(
                              0,
                              ((startMin - START_DAY_MINUTES) / TOTAL_DAY_MINUTES) * 100
                            );
                            const widthPercent = Math.min(
                              100 - leftPercent,
                              ((endMin - startMin) / TOTAL_DAY_MINUTES) * 100
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
                                  left: `${leftPercent}%`,
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
                                      className="text-[9px] font-mono px-1 py-0 shrink-0 bg-background/80"
                                    >
                                      {course.code}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                                    <User className="h-3 w-3 shrink-0" />
                                    <span>{event.professorName}</span>
                                  </div>
                                </div>

                                <div className="relative z-10 flex items-center justify-between text-[10px] text-muted-foreground font-mono pt-1 border-t border-border/30">
                                  <span className="flex items-center gap-0.5">
                                    <Clock className="h-2.5 w-2.5" />
                                    {slot.startTime} - {slot.endTime}
                                  </span>
                                  {event.location && (
                                    <span className="truncate max-w-[80px]">
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

                            const leftPercent = Math.max(
                              0,
                              ((startMin - START_DAY_MINUTES) / TOTAL_DAY_MINUTES) * 100
                            );
                            const widthPercent = Math.min(
                              100 - leftPercent,
                              ((endMin - startMin) / TOTAL_DAY_MINUTES) * 100
                            );

                            return (
                              <div
                                key={`hover_${hIdx}`}
                                style={{
                                  left: `${leftPercent}%`,
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
                                <div className="text-[10px] font-mono">
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
        term={activeTerm}
        eventToEdit={editingCustomEvent}
        open={Boolean(customEventCourse)}
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
        visualCategories={allVisualCategories}
      />
    </div>
  );
}
