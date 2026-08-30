"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import {
  Plus,
  Trash2,
  Clock,
  MapPin,
  User,
  Calendar,
  Sparkles,
  Loader2,
  BookOpen,
} from "lucide-react";
import type { Course, CourseEvent } from "@/lib/types";

interface CustomEventDialogProps {
  course: Course | null;
  term: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (event: CourseEvent) => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "شنبه" },
  { value: 1, label: "یکشنبه" },
  { value: 2, label: "دوشنبه" },
  { value: 3, label: "سه‌شنبه" },
  { value: 4, label: "چهارشنبه" },
];

const STANDARD_TIME_OPTIONS = [
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
];

export function CustomEventDialog({
  course,
  term,
  open,
  onOpenChange,
  onCreated,
}: CustomEventDialogProps) {
  const [professorName, setProfessorName] = useState("");
  const [location, setLocation] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examStartTime, setExamStartTime] = useState("08:30");
  const [examEndTime, setExamEndTime] = useState("11:00");
  const [slots, setSlots] = useState<{ dayOfWeek: number; startTime: string; endTime: string }[]>([
    { dayOfWeek: 0, startTime: "10:30", endTime: "12:00" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!course) return null;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!professorName.trim()) {
      setError("لطفاً نام استاد را وارد کنید.");
      return;
    }
    if (slots.length === 0) {
      setError("لطفاً حداقل یک ساعت کلاسی هفتگی تعریف کنید.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: course.id,
          professorName: professorName.trim(),
          term: term || "1403-1",
          location: location.trim(),
          examDate,
          examStartTime,
          examEndTime,
          slots,
          isUserCustom: true,
        }),
      }).then((r) => r.json());

      if (!res.success || !res.data) {
        setError(res.message || "خطا در ثبت رویداد شخصی");
        return;
      }

      onCreated(res.data);
      onOpenChange(false);

      // Reset form
      setProfessorName("");
      setLocation("");
      setExamDate("");
      setSlots([{ dayOfWeek: 0, startTime: "10:30", endTime: "12:00" }]);
    } catch (err: any) {
      console.error("Custom event creation error:", err);
      setError("خطا در ارتباط با سرور");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-5 pb-4 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                تعریف ارائه شخصی برای {course.name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                این ارائه به صورت اختصاصی برای شما ذخیره می‌شود و می‌توانید آن را در چارت و برنامه هفتگی خود قرار دهید.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              {error}
            </div>
          )}

          {/* Professor Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-primary" />
              نام و عنوان استاد *
            </Label>
            <Input
              value={professorName}
              onChange={(e) => setProfessorName(e.target.value)}
              placeholder="مثال: دکتر علیرضا رضایی"
              required
              autoFocus
            />
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
                className="h-7 text-xs gap-1 border-dashed"
              >
                <Plus className="h-3 w-3" />
                افزودن تایم دیگر
              </Button>
            </div>

            <div className="space-y-2">
              {slots.map((slot, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2.5 rounded-lg border bg-card/60"
                >
                  <select
                    value={slot.dayOfWeek}
                    onChange={(e) =>
                      handleUpdateSlot(idx, "dayOfWeek", Number(e.target.value))
                    }
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-xs text-muted-foreground">از</span>
                    <input
                      type="time"
                      value={slot.startTime}
                      onChange={(e) =>
                        handleUpdateSlot(idx, "startTime", e.target.value)
                      }
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs flex-1 font-mono text-center focus:outline-none focus:ring-1 focus:ring-ring"
                      required
                    />
                    <span className="text-xs text-muted-foreground">تا</span>
                    <input
                      type="time"
                      value={slot.endTime}
                      onChange={(e) =>
                        handleUpdateSlot(idx, "endTime", e.target.value)
                      }
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs flex-1 font-mono text-center focus:outline-none focus:ring-1 focus:ring-ring"
                      required
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
              ))}
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
                  <input
                    type="time"
                    value={examStartTime}
                    onChange={(e) => setExamStartTime(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-2 text-xs flex-1 font-mono text-center focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <span className="text-xs text-muted-foreground">تا</span>
                  <input
                    type="time"
                    value={examEndTime}
                    onChange={(e) => setExamEndTime(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-2 text-xs flex-1 font-mono text-center focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              انصراف
            </Button>
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال ثبت...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  ثبت ارائه شخصی و افزودن به چارت
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
