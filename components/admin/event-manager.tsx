"use client";

import React, { useState, useEffect } from "react";
import type { CourseOffering, CourseEvent, Faculty } from "@/lib/types";
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
  Copy,
  FolderSync,
  Sparkles,
  CheckCircle2,
  CalendarRange,
  Building2,
} from "lucide-react";

interface EventManagerProps {
  offerings?: CourseOffering[];
  faculties?: Faculty[];
  selectedFacultyId?: string;
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

export function EventManager({
  offerings: initialOfferings,
  faculties = [],
  selectedFacultyId,
}: EventManagerProps) {
  const [offerings, setOfferings] = useState<CourseOffering[]>(initialOfferings || []);
  const [events, setEvents] = useState<CourseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  const currentFaculty = faculties.find((f) => f.id === selectedFacultyId);

  // Active selected semester - ALL operations & views are strictly bound to this term
  const [activeTerm, setActiveTerm] = useState<string>("1403-1");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [isNewTermModalOpen, setIsNewTermModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Term Form state
  const [newTermYear, setNewTermYear] = useState("1404");
  const [newTermType, setNewTermType] = useState<"fall" | "spring" | "summer">("fall");

  // Clone Form state
  const [cloneSourceTerm, setCloneSourceTerm] = useState<string>("");
  const [resetExamDates, setResetExamDates] = useState(true);

  // Event Form state (Term is omitted because it's locked to activeTerm)
  const [selectedOfferingId, setSelectedOfferingId] = useState("");
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
      const offUrl = selectedFacultyId ? `/api/offerings?facultyId=${selectedFacultyId}` : "/api/offerings";
      const evUrl = selectedFacultyId ? `/api/events?facultyId=${selectedFacultyId}` : "/api/events";
      const [offRes, evRes] = await Promise.all([
        fetch(offUrl).then((r) => r.json()),
        fetch(evUrl).then((r) => r.json()),
      ]);

      if (offRes.success) setOfferings(offRes.data);
      if (evRes.success) {
        setEvents(evRes.data);
        // If current activeTerm has no events and there are existing terms in DB, default to the latest term
        const existingTerms = Array.from(new Set(evRes.data.map((e: CourseEvent) => e.term).filter(Boolean)));
        if (existingTerms.length > 0 && !existingTerms.includes(activeTerm)) {
          setActiveTerm(existingTerms[0] as string);
        }
      }
    } catch (err) {
      console.error("Failed to load events data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedFacultyId]);

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
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offeringId: selectedOfferingId,
          term: activeTerm, // Automatically use selected active term
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
        setIsCreateModalOpen(false);
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

  const handleCloneEvents = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneSourceTerm) {
      alert("لطفاً نیمسال مبدأ را انتخاب کنید.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/events/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceTerm: cloneSourceTerm,
          targetTerm: activeTerm,
          resetExamDates,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setIsCloneModalOpen(false);
        alert(res.message || "رویدادها با موفقیت کپی شدند.");
        await loadData();
      } else {
        alert(res.message || "خطا در کپی رویدادها");
      }
    } catch (err) {
      console.error("Clone events error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateNewTerm = (e: React.FormEvent) => {
    e.preventDefault();
    const semCode = newTermType === "fall" ? "1" : newTermType === "spring" ? "2" : "3";
    const generatedTerm = `${newTermYear}-${semCode}`;
    setActiveTerm(generatedTerm);
    setIsNewTermModalOpen(false);
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

  // Distinct terms collected from events plus defaults and activeTerm
  const existingTerms = Array.from(new Set([...events.map((e) => e.term), activeTerm, "1403-1", "1403-2"].filter(Boolean)));
  
  // Filter events strictly by activeTerm
  const termEvents = events.filter((evt) => evt.term === activeTerm);

  const filteredEvents = termEvents.filter((evt) => {
    return (
      (evt.courseName || "").toLowerCase().includes(search.toLowerCase()) ||
      (evt.courseCode || "").toLowerCase().includes(search.toLowerCase()) ||
      (evt.professorName || "").toLowerCase().includes(search.toLowerCase()) ||
      (evt.location || "").toLowerCase().includes(search.toLowerCase()) ||
      (evt.groupCode || "").includes(search)
    );
  });

  // Other terms that contain events (eligible for cloning)
  const cloneableSourceTerms = Array.from(
    new Set(events.filter((e) => e.term !== activeTerm).map((e) => e.term))
  );

  const offeringOptions = offerings.map((o) => ({
    value: o.id,
    label: `${o.courseName} (${o.professorName})`,
  }));

  const dayOptions = DAYS_OF_WEEK.map((d) => ({
    value: String(d.value),
    label: d.label,
  }));

  const yearOptions = [
    { value: "1405", label: "۱۴۰۵" },
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
      {/* Top Semester & Faculty Active Filter Bar */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/10 via-primary/5 to-card p-4 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20 shrink-0">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">دانشکده انتخابی:</span>
                {currentFaculty ? (
                  <Badge variant="default" className="text-xs px-2.5 py-0.5 font-bold shadow-xs">
                    {currentFaculty.name} ({currentFaculty.code})
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs px-2.5 py-0.5 text-destructive border-destructive/40">
                    دانشکده‌ای انتخاب نشده است
                  </Badge>
                )}
                <span className="text-muted-foreground font-bold">|</span>
                <span className="text-xs font-semibold text-muted-foreground">نیمسال فعال:</span>
                <Badge variant="secondary" className="text-xs px-2.5 py-0.5 font-bold shadow-xs bg-primary/15 text-primary border-primary/20">
                  {formatSemesterLabel(activeTerm)} ({activeTerm})
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                تمام رویدادها، ساعات هفتگی و آزمون‌های ارائه‌شده در این دانشکده و نیمسال مدیریت می‌شوند.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Semester Select Dropdown */}
            <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur-xs rounded-xl border border-border/80 p-1">
              <span className="text-[11px] font-semibold px-2 text-muted-foreground whitespace-nowrap">
                تغییر نیمسال:
              </span>
              <Select
                value={activeTerm}
                onValueChange={(val) => val && setActiveTerm(val)}
              >
                <SelectTrigger size="sm" className="h-8 min-w-[150px] text-xs font-bold border-none bg-muted/40">
                  <SelectValue placeholder="انتخاب نیمسال..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {existingTerms.map((t) => {
                      const count = events.filter((e) => e.term === t).length;
                      return (
                        <SelectItem key={t} value={t} className="text-xs">
                          {formatSemesterLabel(t)} ({count} رویداد)
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsNewTermModalOpen(true)}
                className="h-8 px-2 text-xs gap-1 text-primary hover:bg-primary/10"
                title="تعریف یا رفتن به نیمسال جدید"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">نیمسال جدید</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Events Table Card */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-primary" />
              <span>رویدادهای کلاسی {formatSemesterLabel(activeTerm)}</span>
            </CardTitle>
            <CardDescription className="text-xs">
              مدیریت و تعریف گروه‌های کلاسی، ساعات تشکیل، محل برگزاری و زمان آزمون‌های این نیمسال
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {/* Clone Button */}
            {cloneableSourceTerms.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCloneSourceTerm(cloneableSourceTerms[0] || "");
                  setIsCloneModalOpen(true);
                }}
                className="h-8 gap-1.5 text-xs shadow-2xs border-primary/30 text-primary hover:bg-primary/10"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>کپی از نیمسال دیگر</span>
              </Button>
            )}

            {/* Create Event Button */}
            <Button
              size="sm"
              onClick={() => {
                setSelectedOfferingId(offerings[0]?.id || "");
                setGroupCode("01");
                setCapacity(40);
                setLocation("دانشکده فنی - کلاس ۱۰۲");
                setIsCreateModalOpen(true);
              }}
              disabled={offerings.length === 0}
              className="h-8 gap-1.5 text-xs shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              تعریف رویداد کلاسی جدید
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Search and Counts Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative">
              <Input
                placeholder="جستجوی درس، استاد، کلاس یا گروه..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-72 text-xs pr-8"
              />
              <Search className="pointer-events-none absolute right-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            </div>

            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span>تعداد رویدادهای این نیمسال:</span>
              <Badge variant="secondary" className="font-bold text-foreground">
                {filteredEvents.length} رویداد
              </Badge>
            </div>
          </div>

          {/* Events List Table */}
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                  <th className="py-2.5 px-3 text-right">نام درس و استاد</th>
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

                    {/* Group */}
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        گروه {evt.groupCode || "01"}
                      </Badge>
                    </td>

                    {/* Capacity */}
                    <td className="py-2.5 px-3 text-center text-muted-foreground">
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
                              className="text-[10px] gap-1"
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
                    <td className="py-2.5 px-3 text-[11px]">
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
                    <td colSpan={7} className="text-center py-12 text-xs text-muted-foreground">
                      {loading ? (
                        "در حال دریافت برنامه کلاسی..."
                      ) : (
                        <div className="max-w-md mx-auto space-y-3 py-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mx-auto text-muted-foreground">
                            <CalendarDays className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-foreground">
                              هیچ رویداد کلاسی برای نیمسال {formatSemesterLabel(activeTerm)} تعریف نشده است.
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              می‌توانید رویدادهای این نیمسال را به صورت دستی تعریف کنید یا با یک کلیک از نیمسال‌های قبلی کپی نمایید.
                            </p>
                          </div>
                          <div className="flex items-center justify-center gap-2 pt-2">
                            {cloneableSourceTerms.length > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setCloneSourceTerm(cloneableSourceTerms[0] || "");
                                  setIsCloneModalOpen(true);
                                }}
                                className="h-8 gap-1.5 text-xs text-primary border-primary/30"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                کپی از نیمسال دیگر
                              </Button>
                            )}
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedOfferingId(offerings[0]?.id || "");
                                setGroupCode("01");
                                setCapacity(40);
                                setIsCreateModalOpen(true);
                              }}
                              className="h-8 gap-1.5 text-xs"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              تعریف اولین رویداد
                            </Button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 1. Modal: Create Event (NO semester/year asked - pre-locked to activeTerm) */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              تعریف رویداد کلاسی جدید
            </DialogTitle>
            <DialogDescription className="text-xs">
              مشخصات درس، گروه، ظرفیت، محل تشکیل و زمان‌بندی جلسات هفتگی را وارد کنید.
            </DialogDescription>
          </DialogHeader>

          {/* Active Semester Banner */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span className="text-muted-foreground">ثبت در نیمسال تحصیلی:</span>
              <span className="font-bold text-foreground">{formatSemesterLabel(activeTerm)} ({activeTerm})</span>
            </div>
            <Badge variant="outline" className="text-[10px]">تثبیت‌شده</Badge>
          </div>

          <form onSubmit={handleCreateEvent} className="space-y-3.5 pt-1">
            {/* Select Offering */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ارائه درس (درس و استاد مدرس):</Label>
              <Select
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

            {/* Group Code & Capacity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">کد گروه درسی:</Label>
                <Input
                  value={groupCode}
                  onChange={(e) => setGroupCode(e.target.value)}
                  placeholder="مثلاً ۰۱"
                  className="h-8 text-xs"
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
                  className="h-8 text-xs"
                  required
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">محل تشکیل کلاس / شماره اتاق:</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="مثلاً دانشکده فنی - کلاس ۱۰۲"
                className="h-8 text-xs"
              />
            </div>

            {/* Weekly Slots Builder */}
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
                      className="h-8 w-24 text-xs text-center"
                    />

                    <span className="text-muted-foreground text-[11px]">تا</span>

                    {/* End Time */}
                    <Input
                      value={slot.endTime}
                      onChange={(e) => handleUpdateSlot(idx, "endTime", e.target.value)}
                      placeholder="12:00"
                      className="h-8 w-24 text-xs text-center"
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

            {/* Exam Details */}
            <div className="space-y-2 rounded-xl border border-border/70 bg-muted/15 p-3">
              <Label className="text-xs font-bold">مشخصات آزمون پایان‌ترم:</Label>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">تاریخ آزمون:</span>
                  <Input
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    placeholder="1403/10/22"
                    className="h-8 text-xs text-center"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">ساعت شروع:</span>
                  <Input
                    value={examStartTime}
                    onChange={(e) => setExamStartTime(e.target.value)}
                    placeholder="08:30"
                    className="h-8 text-xs text-center"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">ساعت پایان:</span>
                  <Input
                    value={examEndTime}
                    onChange={(e) => setExamEndTime(e.target.value)}
                    placeholder="11:00"
                    className="h-8 text-xs text-center"
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
                {isSubmitting ? "در حال ثبت..." : `ذخیره رویداد در ${formatSemesterLabel(activeTerm)}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Modal: Clone / Copy All Events from Another Semester */}
      <Dialog open={isCloneModalOpen} onOpenChange={setIsCloneModalOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Copy className="h-4 w-4 text-primary" />
              کپی کامل رویدادها از نیمسال دیگر
            </DialogTitle>
            <DialogDescription className="text-xs">
              تمامی دروس، اساتید، گروه‌ها، جلسات هفتگی و محل کلاس‌های یک نیمسال را به نیمسال فعلی منتقل کنید.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCloneEvents} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">نیمسال مبدأ (جهت کپی رویدادها):</Label>
              <Select
                value={cloneSourceTerm}
                onValueChange={(val) => val && setCloneSourceTerm(val)}
              >
                <SelectTrigger size="sm" className="w-full text-xs font-medium">
                  <SelectValue placeholder="-- انتخاب نیمسال مبدأ --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {cloneableSourceTerms.map((t) => {
                      const count = events.filter((e) => e.term === t).length;
                      return (
                        <SelectItem key={t} value={t} className="text-xs">
                          {formatSemesterLabel(t)} ({count} رویداد کلاسی)
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">نیمسال مقصد (فعلی):</span>
                <Badge variant="default" className="font-bold">
                  {formatSemesterLabel(activeTerm)} ({activeTerm})
                </Badge>
              </div>

              <div className="pt-2 border-t border-border/60 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="resetExams"
                  checked={resetExamDates}
                  onChange={(e) => setResetExamDates(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <Label htmlFor="resetExams" className="text-xs cursor-pointer font-normal">
                  پاک کردن تاریخ امتحانات قبلی (جهت تعیین مجدد در ترم جدید)
                </Label>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !cloneSourceTerm}
                className="w-full h-8 text-xs font-semibold gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isSubmitting ? "در حال کپی رویدادها..." : `کپی همه رویدادها به ${formatSemesterLabel(activeTerm)}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 3. Modal: Quick Define / Switch New Academic Term */}
      <Dialog open={isNewTermModalOpen} onOpenChange={setIsNewTermModalOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-primary" />
              تعریف / جابجایی به نیمسال جدید
            </DialogTitle>
            <DialogDescription className="text-xs">
              سال و دوره تحصیلی را انتخاب کنید تا پنل رویدادها به آن نیمسال منتقل شود.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateNewTerm} className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">سال تحصیلی:</Label>
              <Select
                value={newTermYear}
                onValueChange={(val) => val && setNewTermYear(val)}
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
              <Label className="text-xs font-semibold">دوره نیمسال:</Label>
              <Select
                value={newTermType}
                onValueChange={(val) => val && setNewTermType(val as any)}
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

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                size="sm"
                className="w-full h-8 text-xs font-semibold"
              >
                تنظیم و انتقال به این نیمسال
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
