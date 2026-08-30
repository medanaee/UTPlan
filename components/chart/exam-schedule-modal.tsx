"use client";

import React, { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Clock,
  BookOpen,
  User,
  MapPin,
} from "lucide-react";
import type { Course, CourseEvent, VisualCategory } from "@/lib/types";

interface ExamScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  termIndex: number;
  courses: Course[];
  selectedEventsMap: Record<string, string>; // courseId -> eventId
  allEvents: CourseEvent[];
  visualCategories: VisualCategory[];
}

interface ExamItem {
  courseId: string;
  courseName: string;
  courseCode: string;
  courseUnits: number;
  professorName: string;
  location: string;
  examDate: string; // "1403/10/22"
  examStartTime: string; // "08:30"
  examEndTime: string; // "11:00"
  categoryColor: string;
}

export function ExamScheduleModal({
  open,
  onOpenChange,
  termIndex,
  courses,
  selectedEventsMap,
  allEvents,
  visualCategories,
}: ExamScheduleModalProps) {
  // Collect all exams for selected courses
  const { examItems, sameDayConflicts, sameHourConflicts } = useMemo(() => {
    const items: ExamItem[] = [];

    courses.forEach((c) => {
      const selectedEventId = selectedEventsMap[c.id];
      if (!selectedEventId) return;

      const evt = allEvents.find((e) => e.id === selectedEventId);
      if (!evt || !evt.examDate) return;

      const catColor =
        c.trackAssignments?.[0]?.visualCategoryId
          ? visualCategories.find(
              (vc) => vc.id === c.trackAssignments?.[0]?.visualCategoryId
            )?.color || "#3b82f6"
          : "#3b82f6";

      items.push({
        courseId: c.id,
        courseName: c.name,
        courseCode: c.code,
        courseUnits: c.units,
        professorName: evt.professorName || "تعیین‌نشده",
        location: evt.location || "نامشخص",
        examDate: evt.examDate,
        examStartTime: evt.examStartTime || "08:30",
        examEndTime: evt.examEndTime || "11:00",
        categoryColor: catColor,
      });
    });

    // Sort by exam date then start time
    items.sort((a, b) => {
      const dateCmp = a.examDate.localeCompare(b.examDate);
      if (dateCmp !== 0) return dateCmp;
      return a.examStartTime.localeCompare(b.examStartTime);
    });

    // Detect conflicts
    const sameDay: { examA: ExamItem; examB: ExamItem }[] = [];
    const sameHour: { examA: ExamItem; examB: ExamItem }[] = [];

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];

        if (a.examDate === b.examDate) {
          // Check time overlap
          const aStart = a.examStartTime || "08:30";
          const aEnd = a.examEndTime || "11:00";
          const bStart = b.examStartTime || "08:30";
          const bEnd = b.examEndTime || "11:00";

          const hasTimeOverlap = aStart < bEnd && bStart < aEnd;

          if (hasTimeOverlap) {
            sameHour.push({ examA: a, examB: b });
          } else {
            sameDay.push({ examA: a, examB: b });
          }
        }
      }
    }

    return {
      examItems: items,
      sameDayConflicts: sameDay,
      sameHourConflicts: sameHour,
    };
  }, [courses, selectedEventsMap, allEvents, visualCategories]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-5 pb-4 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  برنامه امتحانات ترم {termIndex}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  برنامه زمانی و تقویم امتحانات پایان‌ترم دروس انتخاب‌شده
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs ">
              {examItems.length} امتحان ثبت‌شده
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Conflict Alerts */}
          {sameHourConflicts.length > 0 && (
            <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <XCircle className="h-4.5 w-4.5 shrink-0" />
                <span>تداخل بحرانی ساعت امتحان!</span>
              </div>
              <p className="leading-relaxed">
                امتحانات دروس زیر در یک روز و ساعت یکسان با یکدیگر تداخل دارند و
                حضور در هر دو هم‌زمان امکان‌پذیر نیست:
              </p>
              <ul className="list-disc list-inside space-y-1 font-medium">
                {sameHourConflicts.map((c, idx) => (
                  <li key={idx}>
                    «{c.examA.courseName}» با «{c.examB.courseName}» در تاریخ{" "}
                    {c.examA.examDate} (ساعت {c.examA.examStartTime} تا{" "}
                    {c.examA.examEndTime})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sameDayConflicts.length > 0 && (
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>هشدار برگزاری دو امتحان در یک روز</span>
              </div>
              <p className="leading-relaxed">
                دروس زیر در یک تاریخ برگزار می‌شوند که فشار مطالعاتی بالایی برای
                دانشجو ایجاد می‌کند:
              </p>
              <ul className="list-disc list-inside space-y-1 font-medium">
                {sameDayConflicts.map((c, idx) => (
                  <li key={idx}>
                    «{c.examA.courseName}» (ساعت {c.examA.examStartTime}) و «
                    {c.examB.courseName}» (ساعت {c.examB.examStartTime}) در تاریخ{" "}
                    {c.examA.examDate}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sameHourConflicts.length === 0 && sameDayConflicts.length === 0 && examItems.length > 0 && (
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                برنامه امتحانات این ترم کاملاً مرتب و بدون تداخل زمانی است.
              </span>
            </div>
          )}

          {/* Exam Timeline List */}
          {examItems.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-2">
              <CalendarDays className="h-10 w-10 mx-auto opacity-40" />
              <p className="text-xs">
                هنوز هیچ ارائه‌ای با تاریخ امتحان برای دروس این ترم انتخاب نشده است.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {examItems.map((item, idx) => {
                const hasHourCollision = sameHourConflicts.some(
                  (c) =>
                    c.examA.courseId === item.courseId ||
                    c.examB.courseId === item.courseId
                );
                const hasDayCollision = sameDayConflicts.some(
                  (c) =>
                    c.examA.courseId === item.courseId ||
                    c.examB.courseId === item.courseId
                );

                return (
                  <div
                    key={item.courseId}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      hasHourCollision
                        ? "border-destructive/50 bg-destructive/5"
                        : hasDayCollision
                        ? "border-amber-500/40 bg-amber-500/5"
                        : "border-border/60 bg-card hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-2.5 h-10 rounded-full shrink-0 mt-0.5"
                        style={{ backgroundColor: item.categoryColor }}
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">
                            {item.courseName}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] "
                          >
                            {item.courseCode}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            ({item.courseUnits} واحد)
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {item.professorName}
                          </span>
                          {item.location && item.location !== "نامشخص" && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {item.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-border/40 gap-1 text-right shrink-0">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>{item.examDate}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground ">
                        <Clock className="h-3 w-3" />
                        <span>
                          {item.examStartTime} تا {item.examEndTime}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
