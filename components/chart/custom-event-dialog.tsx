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
import { TimePicker } from "@/components/ui/time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Clock,
  MapPin,
  User,
  Calendar,
  Sparkles,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import type { Course, CourseEvent } from "@/lib/types";

interface CustomEventDialogProps {
  course: Course | null;
  term: string;
  open: boolean;
  eventToEdit?: CourseEvent | null;
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

function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function CustomEventDialog({
  course,
  term,
  open,
  eventToEdit,
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

  React.useEffect(() => {
    if (eventToEdit) {
      setProfessorName(eventToEdit.professorName || "");
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
      setProfessorName("");
      setLocation("");
      setExamDate("");
      setExamStartTime("08:30");
      setExamEndTime("11:00");
      setSlots([{ dayOfWeek: 0, startTime: "10:30", endTime: "12:00" }]);
    }
  }, [eventToEdit, open]);

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

  const isExamTimeInvalid =
    examStartTime &&
    examEndTime &&
    parseTimeToMinutes(examStartTime) >= parseTimeToMinutes(examEndTime);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!professorName.trim()) {
      setError("لطفاً نام استاد را وارد کنید.");
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
        const res = await fetch("/api/events", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: eventToEdit.id,
            professorName: professorName.trim(),
            term: term || "1403-1",
            location: location.trim(),
            examDate,
            examStartTime,
            examEndTime,
            slots,
          }),
        }).then((r) => r.json());

        if (!res.success) {
          setError(res.message || "خطا در ویرایش رویداد شخصی");
          return;
        }

        onCreated({
          ...eventToEdit,
          professorName: professorName.trim(),
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
      }

      // Reset form
      setProfessorName("");
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
        <DialogHeader className=" ">
          <div className="flex items-center gap-2.5">
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>{eventToEdit ? `ویرایش ارائه شخصی برای ${course.name}` : `تعریف ارائه شخصی برای ${course.name}`}</span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {course.code}
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
              className="text-xs"
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
                          <SelectTrigger className="h-8 text-xs w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DAYS_OF_WEEK.map((d) => (
                              <SelectItem key={d.value} value={String(d.value)} className="text-xs">
                                {d.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
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
              disabled={saving}
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
