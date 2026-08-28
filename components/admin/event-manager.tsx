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
  Search,
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

const SEMESTER_TYPES = [
  { value: "fall", label: "پاییز (نیمسال اول)", code: "1" },
  { value: "spring", label: "بهار (نیمسال دوم)", code: "2" },
  { value: "summer", label: "تابستان", code: "3" },
];

export function formatSemesterLabel(termStr: string): string {
  if (!termStr) return "تعیین‌نشده";
  const parts = termStr.split("-");
  if (parts.length === 2) {
    const year = parts[0];
    const sem = parts[1];
    if (sem === "1" || sem === "fall") return `پاییز ${year}`;
    if (sem === "2" || sem === "spring") return `بهار ${year}`;
    if (sem === "3" || sem === "summer") return `تابستان ${year}`;
    return `${sem} ${year}`;
  }
  return termStr;
}

export function EventManager({ offerings: initialOfferings }: EventManagerProps) {
  const [offerings, setOfferings] = useState<CourseOffering[]>(initialOfferings || []);
  const [events, setEvents] = useState<CourseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [selectedOfferingId, setSelectedOfferingId] = useState("");
  const [academicYear, setAcademicYear] = useState("1403");
  const [semesterType, setSemesterType] = useState<"fall" | "spring" | "summer">("fall");
  const [groupCode, setGroupCode] = useState("01");
  const [capacity, setCapacity] = useState(40);
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
      const termCode = `${academicYear}-${semesterType === "fall" ? "1" : semesterType === "spring" ? "2" : "3"}`;
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offeringId: selectedOfferingId,
          term: termCode,
          groupCode,
          capacity: Number(capacity),
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
    if (!confirm("آیا از حذف این رویداد کلاسی مطمئن هستید؟")) return;

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

  const terms = Array.from(new Set(events.map((e) => e.term).filter(Boolean)));
  const termOptions = [
    { value: "all", label: "تمام نیمسال‌ها" },
    ...terms.map((t) => ({ value: t, label: formatSemesterLabel(t) })),
  ];

  const filteredEvents = events.filter((evt) => {
    const matchesSearch =
      (evt.courseName || "").toLowerCase().includes(search.toLowerCase()) ||
      (evt.courseCode || "").toLowerCase().includes(search.toLowerCase()) ||
      (evt.professorName || "").toLowerCase().includes(search.toLowerCase()) ||
      (evt.location || "").toLowerCase().includes(search.toLowerCase()) ||
      (evt.groupCode || "").includes(search);

    const matchesTerm = selectedTerm === "all" || evt.term === selectedTerm;
    return matchesSearch && matchesTerm;
  });

  const offeringOptions = offerings.map((o) => ({
    value: o.id,
    label: `${o.courseName} (${o.professorName})`,
  }));

  const dayOptions = DAYS_OF_WEEK.map((d) => ({
    value: String(d.value),
    label: d.label,
  }));

  const yearOptions = [
    { value: "1404", label: "۱۴۰۴" },
    { value: "1403", label: "۱۴۰۳" },
    { value: "1402", label: "۱۴۰۲" },
    { value: "1401", label: "۱۴۰۱" },
  ];

  const semesterTypeOptions = SEMESTER_TYPES.map((s) => ({
    value: s.value,
    label: s.label,
  }));

  return (
    <div className="space-y-4">
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <span>رویدادها و برنامه‌ریزی کلاسی ترم (Course Events)</span>
            </CardTitle>
            <CardDescription className="text-xs">
              مدیریت و تعریف گروه‌های کلاسی ترم، ساعات تشکیل جلسات، محل برگزاری و زمان آزمون‌ها
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setSelectedOfferingId(offerings[0]?.id || "");
              setAcademicYear("1403");
              setSemesterType("fall");
              setGroupCode("01");
              setCapacity(40);
              setLocation("دانشکده فنی - کلاس ۱۰۲");
              setIsModalOpen(true);
            }}
            disabled={offerings.length === 0}
            className="h-8 gap-1.5 text-xs shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            تعریف رویداد کلاسی جدید
          </Button>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Input
                  placeholder="جستجوی درس، استاد، کلاس یا گروه..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 w-64 text-xs pr-8"
                />
                <Search className="pointer-events-none absolute right-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              </div>

              {terms.length > 0 && (
                <Select
                  items={termOptions}
                  value={selectedTerm}
                  onValueChange={(val) => val && setSelectedTerm(val)}
                >
                  <SelectTrigger size="sm" className="h-8 min-w-[150px] text-xs">
                    <SelectValue placeholder="فیلتر نیمسال..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {termOptions.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              تعداد کل رویدادها: <span className="font-bold text-foreground font-mono">{filteredEvents.length}</span>
            </div>
          </div>

          {/* Events List Table */}
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                  <th className="py-2.5 px-3 text-right">نام درس و استاد</th>
                  <th className="py-2.5 px-3 text-center">نیمسال تحصیلی</th>
                  <th className="py-2.5 px-3 text-center">کد گروه</th>
                  <th className="py-2.5 px-3 text-center">ظرفیت</th>
                  <th className="py-2.5 px-3 text-right">جلسات هفتگی کلاس</th>
                  <th className="py-2.5 px-3 text-right">محل تشکیل</th>
                  <th className="py-2.5 px-3 text-right">آزمون پایان‌ترم</th>
                  <th className="py-2.5 px-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredEvents.map((evt) => (
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
                            {evt.professorName} ({evt.professorTitle || "استاد"})
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Semester */}
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant="outline" className="text-[11px] px-2 py-0.5 font-medium">
                        {formatSemesterLabel(evt.term)}
                      </Badge>
                    </td>

                    {/* Group */}
                    <td className="py-2.5 px-3 text-center font-mono">
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        گروه {evt.groupCode || "01"}
                      </Badge>
                    </td>

                    {/* Capacity */}
                    <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">
                      {evt.capacity || 40} نفر
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

                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                      {loading
                        ? "در حال دریافت برنامه کلاسی..."
                        : "هیچ رویداد کلاسی یافت نشد."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              تعریف رویداد کلاسی ترم (Course Event)
            </DialogTitle>
            <DialogDescription className="text-xs">
              ارائه درس را انتخاب کرده و مشخصات سال، نیمسال، گروه، ظرفیت، محل و زمان‌بندی جلسات را تعیین کنید.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateEvent} className="space-y-3.5 pt-2">
            {/* 1. Select Offering */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ارائه درس (درس و استاد مدرس):</Label>
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

            {/* 2. Academic Year & Semester Type (2 equal columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">سال تحصیلی:</Label>
                <Select
                  items={yearOptions}
                  value={academicYear}
                  onValueChange={(val) => val && setAcademicYear(val)}
                >
                  <SelectTrigger size="sm" className="w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {yearOptions.map((y) => (
                        <SelectItem key={y.value} value={y.value}>
                          {y.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">نیمسال تحصیلی:</Label>
                <Select
                  items={semesterTypeOptions}
                  value={semesterType}
                  onValueChange={(val) => val && setSemesterType(val as any)}
                >
                  <SelectTrigger size="sm" className="w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {semesterTypeOptions.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 3. Group Code & Capacity (2 equal columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">کد گروه درسی:</Label>
                <Input
                  value={groupCode}
                  onChange={(e) => setGroupCode(e.target.value)}
                  placeholder="مثلاً ۰۱"
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">ظرفیت کلاس (نفر):</Label>
                <Input
                  type="number"
                  min={1}
                  max={300}
                  value={capacity}
                  onChange={(e) => setCapacity(parseInt(e.target.value) || 40)}
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>
            </div>

            {/* 4. Location */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">محل تشکیل کلاس / شماره اتاق:</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="مثلاً دانشکده فنی - کلاس ۱۰۲"
                className="h-8 text-xs"
              />
            </div>

            {/* 5. Weekly Slots Builder */}
            <div className="space-y-2 rounded-xl border border-border/70 bg-muted/15 p-3">
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
                    <div className="w-32 shrink-0">
                      <Select
                        items={dayOptions}
                        value={String(slot.dayOfWeek)}
                        onValueChange={(val) =>
                          handleUpdateSlot(idx, "dayOfWeek", parseInt(val))
                        }
                      >
                        <SelectTrigger size="sm" className="h-8 text-xs">
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
                      className="h-8 w-24 text-xs font-mono text-center"
                    />

                    <span className="text-muted-foreground text-[11px]">تا</span>

                    {/* End Time */}
                    <Input
                      value={slot.endTime}
                      onChange={(e) => handleUpdateSlot(idx, "endTime", e.target.value)}
                      placeholder="12:00"
                      className="h-8 w-24 text-xs font-mono text-center"
                    />

                    {slots.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSlot(idx)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 6. Exam Details */}
            <div className="space-y-2 rounded-xl border border-border/70 bg-muted/15 p-3">
              <Label className="text-xs font-bold">مشخصات آزمون پایان‌ترم:</Label>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">تاریخ آزمون:</span>
                  <Input
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    placeholder="1403/10/22"
                    className="h-8 text-xs font-mono text-center"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">ساعت شروع:</span>
                  <Input
                    value={examStartTime}
                    onChange={(e) => setExamStartTime(e.target.value)}
                    placeholder="08:30"
                    className="h-8 text-xs font-mono text-center"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">ساعت پایان:</span>
                  <Input
                    value={examEndTime}
                    onChange={(e) => setExamEndTime(e.target.value)}
                    placeholder="11:00"
                    className="h-8 text-xs font-mono text-center"
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
                {isSubmitting ? "در حال ثبت..." : "ذخیره رویداد کلاسی"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
