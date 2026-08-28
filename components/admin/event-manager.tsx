"use client";

import React, { useState, useEffect } from "react";
import type { CourseOffering, CourseEvent } from "@/lib/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Trash2,
  BookOpen,
  CalendarDays,
  FileText,
  AlertCircle,
} from "lucide-react";

interface EventManagerProps {
  offerings?: CourseOffering[];
}

const DAYS_OF_WEEK = [
  { value: 0, label: "شنبه" },
  { value: 1, label: "یکشنبه" },
  { value: 2, label: "دوشنبه" },
  { value: 3, label: "سه‌شنبه" },
  { value: 4, label: "چهارشنبه" },
];

export function EventManager({ offerings: initialOfferings }: EventManagerProps) {
  const [offerings, setOfferings] = useState<CourseOffering[]>(initialOfferings || []);
  const [events, setEvents] = useState<CourseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [selectedOfferingId, setSelectedOfferingId] = useState("");
  const [location, setLocation] = useState("دانشکده فنی - کلاس ۱۰۲");
  const [examDate, setExamDate] = useState("1403/10/22");
  const [examStartTime, setExamStartTime] = useState("08:30");
  const [examEndTime, setExamEndTime] = useState("11:00");
  const [slots, setSlots] = useState<
    { dayOfWeek: number; startTime: string; endTime: string }[]
  >([
    { dayOfWeek: 0, startTime: "10:30", endTime: "12:00" },
    { dayOfWeek: 2, startTime: "10:30", endTime: "12:00" },
  ]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [offRes, evRes] = await Promise.all([
        fetch("/api/offerings").then((r) => r.json()),
        fetch("/api/events").then((r) => r.json()),
      ]);

      if (offRes.success) setOfferings(offRes.data);
      if (evRes.success) setEvents(evRes.data);
    } catch (err) {
      console.error("Failed to load events data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddSlot = () => {
    setSlots([...slots, { dayOfWeek: 1, startTime: "08:00", endTime: "09:30" }]);
  };

  const handleRemoveSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  const handleUpdateSlot = (
    index: number,
    field: "dayOfWeek" | "startTime" | "endTime",
    value: any
  ) => {
    const updated = [...slots];
    updated[index] = { ...updated[index], [field]: value };
    setSlots(updated);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfferingId) {
      alert("لطفاً یک ارائه درس را انتخاب کنید.");
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedOff = offerings.find((o) => o.id === selectedOfferingId);
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offeringId: selectedOfferingId,
          term: selectedOff?.term || "1403-1",
          location,
          examDate,
          examStartTime,
          examEndTime,
          slots,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setIsModalOpen(false);
        await loadData();
      } else {
        alert(res.message || "خطا در ثبت رویداد");
      }
    } catch (err) {
      console.error("Create event error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("آیا از حذف این زمان‌بندی کلاسی مطمئن هستید؟")) return;

    try {
      const res = await fetch(`/api/events?id=${id}`, { method: "DELETE" }).then((r) =>
        r.json()
      );
      if (res.success) {
        await loadData();
      }
    } catch (err) {
      console.error("Delete event error:", err);
    }
  };

  const offeringOptions = offerings.map((o) => ({
    value: o.id,
    label: `${o.courseName} (${o.professorName} - گروه ${o.groupCode || "01"})`,
  }));

  const dayOptions = DAYS_OF_WEEK.map((d) => ({
    value: String(d.value),
    label: d.label,
  }));

  return (
    <div className="space-y-4">
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <span>زمان‌بندی کلاس‌ها و امتحانات (Events & Timetable)</span>
            </CardTitle>
            <CardDescription className="text-xs">
              تعریف روزها و ساعات تشکیل جلسات درسی در طول هفته همراه با تاریخ و ساعت امتحانات
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setSelectedOfferingId(offerings[0]?.id || "");
              setIsModalOpen(true);
            }}
            disabled={offerings.length === 0}
            className="h-8 gap-1.5 text-xs shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            ثبت زمان‌بندی جدید
          </Button>
        </CardHeader>

        <CardContent className="p-4 space-y-5">
          {/* Weekly Calendar Visualizer */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span>نمای هفتگی کلاس‌های زمان‌بندی‌شده (شنبه تا چهارشنبه):</span>
            </h3>

            <div className="grid grid-cols-5 gap-2 text-xs">
              {DAYS_OF_WEEK.map((day) => {
                // Find all slots on this day
                const daySlots = events.flatMap((evt) =>
                  (evt.slots || [])
                    .filter((s) => s.dayOfWeek === day.value)
                    .map((slot) => ({ ...slot, event: evt }))
                );

                return (
                  <div
                    key={day.value}
                    className="rounded-xl border border-border/60 bg-muted/15 p-2.5 space-y-2 min-h-[140px]"
                  >
                    <div className="text-center font-bold text-foreground pb-1.5 border-b border-border/40">
                      {day.label}
                    </div>

                    <div className="space-y-1.5">
                      {daySlots.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-[11px] space-y-1 shadow-2xs"
                        >
                          <p className="font-bold text-primary truncate">
                            {item.event.courseName}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                            <span>
                              {item.startTime} - {item.endTime}
                            </span>
                            <Badge variant="secondary" className="text-[9px] px-1 h-3.5">
                              گروه {item.event.groupCode || "01"}
                            </Badge>
                          </div>
                          {item.event.location && (
                            <p className="text-[9px] text-muted-foreground/80 truncate">
                              📍 {item.event.location}
                            </p>
                          )}
                        </div>
                      ))}

                      {daySlots.length === 0 && (
                        <p className="text-[10px] text-muted-foreground text-center py-4 opacity-50">
                          کلاسی نیست
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Events List Table */}
          <div className="space-y-2 pt-3 border-t">
            <h3 className="text-xs font-bold text-foreground">
              لیست کامل زمان‌بندی‌ها ({events.length} مورد):
            </h3>

            <div className="overflow-x-auto rounded-xl border border-border/70">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                    <th className="py-2.5 px-3 text-right">درس و استاد</th>
                    <th className="py-2.5 px-3 text-right">جلسات هفتگی</th>
                    <th className="py-2.5 px-3 text-right">محل تشکیل</th>
                    <th className="py-2.5 px-3 text-right">آزمون پایان‌ترم</th>
                    <th className="py-2.5 px-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {events.map((evt) => (
                    <tr key={evt.id} className="hover:bg-muted/20 transition-colors">
                      {/* Course & Prof */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 font-bold text-xs shrink-0">
                            <BookOpen className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <div className="font-bold text-foreground">{evt.courseName}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {evt.professorName} (گروه {evt.groupCode || "01"})
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Slots */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {(evt.slots || []).map((slot) => {
                            const dayName =
                              DAYS_OF_WEEK.find((d) => d.value === slot.dayOfWeek)?.label || "";
                            return (
                              <Badge
                                key={slot.id}
                                variant="secondary"
                                className="text-[10px] font-mono gap-1"
                              >
                                <span>{dayName}</span>
                                <span>
                                  {slot.startTime}-{slot.endTime}
                                </span>
                              </Badge>
                            );
                          })}
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
                          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                          <span>{evt.location || "تعیین‌نشده"}</span>
                        </div>
                      </td>

                      {/* Exam */}
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {evt.examDate ? (
                          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span>
                              {evt.examDate} ({evt.examStartTime || ""}-{evt.examEndTime || ""})
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60 text-[10px]">بدون امتحان</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteEvent(evt.id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}

                  {events.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-xs text-muted-foreground">
                        {loading
                          ? "در حال دریافت برنامه کلاسی..."
                          : "هنوز زمان‌بندی برای درسی ثبت نشده است."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              تعریف زمان‌بندی هفتگی و امتحان کلاس
            </DialogTitle>
            <DialogDescription className="text-xs">
              جلسات هفتگی (ساعت شروع و پایان) و مشخصات آزمون پایان‌ترم را ثبت کنید.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateEvent} className="space-y-4 pt-2">
            {/* Select Offering */}
            <div className="space-y-1.5">
              <Label className="text-xs">انتخاب ارائه درس:</Label>
              <Select
                items={offeringOptions}
                value={selectedOfferingId}
                onValueChange={(val) => val && setSelectedOfferingId(val)}
              >
                <SelectTrigger size="sm" className="w-full text-xs">
                  <SelectValue placeholder="-- انتخاب ارائه درس --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {offeringOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Label className="text-xs">محل تشکیل کلاس / شماره اتاق:</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="مثلاً دانشکده فنی - کلاس ۱۰۲"
                className="h-8 text-xs"
              />
            </div>

            {/* Weekly Slots Builder */}
            <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold">جلسات هفتگی کلاس:</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddSlot}
                  className="h-6 text-[10px] gap-1 shadow-2xs"
                >
                  <Plus className="h-2.5 w-2.5" /> افزودن جلسه
                </Button>
              </div>

              <div className="space-y-2">
                {slots.map((slot, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    {/* Day */}
                    <div className="w-28 shrink-0">
                      <Select
                        items={dayOptions}
                        value={String(slot.dayOfWeek)}
                        onValueChange={(val) =>
                          handleUpdateSlot(idx, "dayOfWeek", parseInt(val))
                        }
                      >
                        <SelectTrigger size="sm" className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {dayOptions.map((d) => (
                              <SelectItem key={d.value} value={d.value}>
                                {d.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Start Time */}
                    <Input
                      value={slot.startTime}
                      onChange={(e) => handleUpdateSlot(idx, "startTime", e.target.value)}
                      placeholder="10:30"
                      className="h-7 w-20 text-xs font-mono text-center"
                    />

                    <span className="text-muted-foreground text-[10px]">تا</span>

                    {/* End Time */}
                    <Input
                      value={slot.endTime}
                      onChange={(e) => handleUpdateSlot(idx, "endTime", e.target.value)}
                      placeholder="12:00"
                      className="h-7 w-20 text-xs font-mono text-center"
                    />

                    {slots.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSlot(idx)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Exam Details */}
            <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
              <Label className="text-xs font-bold">مشخصات آزمون پایان‌ترم:</Label>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">تاریخ آزمون:</span>
                  <Input
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    placeholder="1403/10/22"
                    className="h-7 text-xs font-mono text-center"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">ساعت شروع:</span>
                  <Input
                    value={examStartTime}
                    onChange={(e) => setExamStartTime(e.target.value)}
                    placeholder="08:30"
                    className="h-7 text-xs font-mono text-center"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">ساعت پایان:</span>
                  <Input
                    value={examEndTime}
                    onChange={(e) => setExamEndTime(e.target.value)}
                    placeholder="11:00"
                    className="h-7 text-xs font-mono text-center"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !selectedOfferingId}
                className="w-full h-8 text-xs font-semibold"
              >
                {isSubmitting ? "در حال ثبت..." : "ذخیره زمان‌بندی کلاس"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
