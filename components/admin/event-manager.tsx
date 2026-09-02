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
import { NumberInput } from "@/components/ui/number-input";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { TimePicker } from "@/components/ui/time-picker";
import { Switch } from "@/components/ui/switch";
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
  Pencil,
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
  AlertTriangle,
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
  { value: "spring", label: "بهار", code: "1" },
  { value: "fall", label: "پاییز", code: "2" },
];

export function formatSemesterLabel(termStr: string): string {
  if (!termStr) return "تعیین‌نشده";
  const parts = termStr.split("-");
  if (parts.length === 2) {
    const year = parts[0];
    const sem = parts[1];
    if (sem === "1" || sem === "spring") return `بهار ${year}`;
    if (sem === "2" || sem === "fall") return `پاییز ${year}`;
    return `${sem} ${year}`;
  }
  return termStr;
}

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CourseEvent | null>(null);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [isNewTermModalOpen, setIsNewTermModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Term Form state
  const [newTermYear, setNewTermYear] = useState("1404");
  const [newTermType, setNewTermType] = useState<"fall" | "spring">("fall");

  // Clone Form state
  const [cloneSourceTerm, setCloneSourceTerm] = useState<string>("");
  const [resetExamDates, setResetExamDates] = useState(true);

  // Event Form state (Term is omitted because it's locked to activeTerm)
  const [selectedOfferingId, setSelectedOfferingId] = useState("");
  const [isTermFinalized, setIsTermFinalized] = useState(false);
  const [groupCode, setGroupCode] = useState("01");
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

  const handleOpenCreateModal = () => {
    setEditingEvent(null);
    const initialOffId = offerings[0]?.id || "";
    setSelectedOfferingId(initialOffId);
    const off = offerings.find((o) => o.id === initialOffId);
    setIsTermFinalized(off?.finalizedSemesters?.includes(activeTerm) || false);
    setGroupCode("01");
    setLocation("دانشکده فنی - کلاس ۱۰۲");
    setExamDate("1403/10/22");
    setExamStartTime("08:30");
    setExamEndTime("11:00");
    setSlots([
      { dayOfWeek: 0, startTime: "10:30", endTime: "12:00" },
      { dayOfWeek: 2, startTime: "10:30", endTime: "12:00" },
    ]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (evt: CourseEvent) => {
    setEditingEvent(evt);
    const offId = evt.offeringId || "";
    setSelectedOfferingId(offId);
    const off = offerings.find((o) => o.id === offId);
    setIsTermFinalized(off?.finalizedSemesters?.includes(activeTerm) || false);
    setGroupCode(evt.groupCode || "01");
    setLocation(evt.location || "");
    setExamDate(evt.examDate || "");
    setExamStartTime(evt.examStartTime || "08:30");
    setExamEndTime(evt.examEndTime || "11:00");
    setSlots(
      evt.slots && evt.slots.length > 0
        ? evt.slots.map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime }))
        : [{ dayOfWeek: 0, startTime: "10:30", endTime: "12:00" }]
    );
    setIsModalOpen(true);
  };

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

  const handleSaveEvent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedOfferingId) {
      alert("لطفاً یک ارائه درس را انتخاب کنید.");
      return;
    }

    // Validate class slots
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const startMin = parseTimeToMinutes(slot.startTime);
      const endMin = parseTimeToMinutes(slot.endTime);
      const dayName = DAYS_OF_WEEK.find((d) => d.value === slot.dayOfWeek)?.label || "کلاس";

      if (startMin >= endMin) {
        alert(
          `خطای زمان‌بندی: ساعت پایان کلاس در روز «${dayName}» (${slot.endTime}) باید بعد از ساعت شروع (${slot.startTime}) باشد.`
        );
        return;
      }
    }

    // Validate exam time
    if (examDate && parseTimeToMinutes(examStartTime) >= parseTimeToMinutes(examEndTime)) {
      alert(
        `خطای زمان آزمون: ساعت پایان امتحان (${examEndTime}) باید بعد از ساعت شروع (${examStartTime}) باشد.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Sync offering finalized semesters status for activeTerm
      const targetOffering = offerings.find((o) => o.id === selectedOfferingId);
      if (targetOffering) {
        const currentFinalized = targetOffering.finalizedSemesters || [];
        const currentlyHasTerm = currentFinalized.includes(activeTerm);
        if (currentlyHasTerm !== isTermFinalized) {
          let updatedFinalized: string[];
          if (isTermFinalized) {
            updatedFinalized = Array.from(new Set([...currentFinalized, activeTerm]));
          } else {
            updatedFinalized = currentFinalized.filter((s) => s !== activeTerm);
          }

          const profIds =
            targetOffering.professors?.map((p) => p.id) ||
            (targetOffering.professorIds
              ? targetOffering.professorIds
              : targetOffering.professorId
              ? [targetOffering.professorId]
              : []);

          await fetch("/api/offerings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: targetOffering.id,
              courseId: targetOffering.courseId,
              professorIds: profIds,
              code: targetOffering.code,
              description: targetOffering.description,
              finalizedSemesters: updatedFinalized,
            }),
          });
        }
      }

      if (editingEvent) {
        // Edit existing
        const res = await fetch("/api/events", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingEvent.id,
            offeringId: selectedOfferingId,
            term: activeTerm,
            groupCode,
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
          alert(res.message || "خطا در ویرایش رویداد");
        }
      } else {
        // Create new
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offeringId: selectedOfferingId,
            term: activeTerm,
            groupCode,
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
      }
    } catch (err) {
      console.error("Save event error:", err);
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
    const semCode = newTermType === "spring" ? "1" : "2";
    const generatedTerm = `${newTermYear}-${semCode}`;
    setActiveTerm(generatedTerm);
    setIsNewTermModalOpen(false);
  };

  const [customFilter, setCustomFilter] = useState<"all" | "official" | "custom">("all");

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

  const handlePromoteEvent = async (id: string) => {
    if (
      !confirm(
        "آیا مایل به تأیید این رویداد شخصی و تبدیل آن به ارائه رسمی و سراسری برای تمام کاربران سامانه هستید؟"
      )
    )
      return;

    try {
      const res = await fetch("/api/admin/events/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: id }),
      }).then((r) => r.json());

      if (res.success) {
        alert(res.message || "رویداد با موفقیت به عنوان ارائه رسمی ثبت شد.");
        await loadData();
      } else {
        alert(res.message || "خطا در تایید رویداد");
      }
    } catch (err) {
      console.error("Promote event error:", err);
    }
  };

  // Distinct terms collected from events plus defaults and activeTerm
  const existingTerms = Array.from(new Set([...events.map((e) => e.term), activeTerm, "1403-1", "1403-2"].filter(Boolean)));

  // Filter events strictly by activeTerm
  const termEvents = events.filter((evt) => evt.term === activeTerm);

  const filteredEvents = termEvents.filter((evt) => {
    if (customFilter === "official" && evt.isUserCustom) return false;
    if (customFilter === "custom" && !evt.isUserCustom) return false;

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
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20 shrink-0">
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
                  {formatSemesterLabel(activeTerm)}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                تمام رویدادها، ساعات هفتگی و آزمون‌های ارائه‌شده در این دانشکده و نیمسال مدیریت می‌شوند.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Semester Select Dropdown */}
            <div className="flex items-center gap-1.5 rounded-xl p-1">
              <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                تغییر نیمسال:
              </span>
              <Select
                value={activeTerm}
                onValueChange={(val) => val && setActiveTerm(val)}
              >
                <SelectTrigger className="min-w-25 text-xs font-bold border-none">
                  <SelectValue placeholder="انتخاب نیمسال..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {existingTerms.map((t) => {
                      const count = events.filter((e) => e.term === t).length;
                      return (
                        <SelectItem key={t} value={t} className="text-xs">
                          {formatSemesterLabel(t)}
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
              onClick={handleOpenCreateModal}
              disabled={offerings.length === 0}
              className="h-8 gap-1.5 text-xs shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              تعریف رویداد کلاسی جدید
            </Button>
          </div>
        </CardHeader>

        <CardContent className="px-4 space-y-4">
          {/* Search and Counts Bar + Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Input
                  placeholder="جستجوی درس، استاد، کلاس یا گروه..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 w-64 text-xs pr-8"
                />
                <Search className="pointer-events-none absolute right-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              </div>

              {/* Custom / Official Filter Pills */}
              <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/50">
                <Button
                  type="button"
                  size="sm"
                  variant={customFilter === "all" ? "secondary" : "ghost"}
                  onClick={() => setCustomFilter("all")}
                  className="h-7 text-[11px] px-2.5"
                >
                  همه ({termEvents.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={customFilter === "official" ? "secondary" : "ghost"}
                  onClick={() => setCustomFilter("official")}
                  className="h-7 text-[11px] px-2.5"
                >
                  رسمی ({termEvents.filter((e) => !e.isUserCustom).length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={customFilter === "custom" ? "secondary" : "ghost"}
                  onClick={() => setCustomFilter("custom")}
                  className="h-7 text-[11px] px-2.5 text-purple-600 dark:text-purple-400 gap-1"
                >
                  <Sparkles className="h-3 w-3" />
                  رویدادهای کاربران ({termEvents.filter((e) => e.isUserCustom).length})
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span>نمایش:</span>
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
                          <div className="flex items-center gap-1.5 font-bold text-foreground">
                            <span>{evt.courseName}</span>
                            {evt.isUserCustom && (
                              <Badge
                                variant="secondary"
                                className="text-[9px] px-1.5 py-0 bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30"
                              >
                                ثبت کاربر
                              </Badge>
                            )}
                          </div>
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
                      <div className="flex items-center justify-center gap-1">
                        {evt.isUserCustom && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePromoteEvent(evt.id)}
                            className="h-7 px-2 text-[11px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 gap-1"
                            title="تأیید و تبدیل به رویداد رسمی سراسری"
                          >
                            <Sparkles className="h-3 w-3" />
                            <span>تأیید سراسری</span>
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditModal(evt)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          title="ویرایش رویداد"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteEvent(evt.id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          title="حذف رویداد"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-xs text-muted-foreground">
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
                              onClick={handleOpenCreateModal}
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

      {/* 1. Modal: Create / Edit Event (Pre-locked to activeTerm) */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                {editingEvent ? (
                  <Pencil className="h-5 w-5" />
                ) : (
                  <CalendarDays className="h-5 w-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <span>{editingEvent ? "ویرایش رویداد کلاسی" : "تعریف رویداد کلاسی جدید"}</span>
                  <Badge variant="secondary" className="text-[10px] ">
                    {activeTerm}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  مشخصات ارائه درس، کد گروه، محل تشکیل و زمان‌بندی جلسات هفتگی را وارد کنید.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form id="admin-event-form" onSubmit={handleSaveEvent} className="flex-1 overflow-y-auto space-y-4">
            {/* Active Semester Banner */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <span className="text-muted-foreground">ثبت در نیمسال تحصیلی:</span>
                <span className="font-bold text-foreground">{formatSemesterLabel(activeTerm)} ({activeTerm})</span>
              </div>
            </div>

            {/* Select Offering Combobox */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                ارائه درس (درس و استاد مدرس) *
              </Label>
              <Combobox
                items={offerings.map((o) => ({
                  value: o.id,
                  label: `${o.courseName || "درس"} — ${o.professorName || "استاد"}`,
                  badge: o.courseCode || undefined,
                  sublabel: o.professorTitle || undefined,
                  keywords: [o.courseName || "", o.courseCode || "", o.professorName || ""],
                }))}
                value={selectedOfferingId}
                onChange={(val) => {
                  setSelectedOfferingId(val);
                  const off = offerings.find((o) => o.id === val);
                  setIsTermFinalized(off?.finalizedSemesters?.includes(activeTerm) || false);
                }}
                placeholder="-- انتخاب یا جستجوی ارائه درس --"
                searchPlaceholder="جستجوی نام درس، کد یا استاد..."
                className="w-full"
              />
            </div>

            {/* Finalized Status Switch for selected offering in activeTerm */}
            <div className="flex items-center justify-between p-3 rounded-2xl border border-border/80 bg-muted/20 space-x-2 space-x-reverse shadow-2xs">
              <div className="space-y-0.5 pr-1">
                <Label htmlFor="term-finalized-switch" className="text-xs font-bold block cursor-pointer">
                  وضعیت ثبت نهایی رویدادها در این نیمسال
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  ثبت رویدادهای این ارائه در نیمسال <span className="font-semibold text-foreground">{formatSemesterLabel(activeTerm)}</span> نهایی و تکمیل شده است.
                </p>
              </div>
              <Switch
                id="term-finalized-switch"
                checked={isTermFinalized}
                onCheckedChange={setIsTermFinalized}
              />
            </div>

            {/* Group Code & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">کد گروه درسی *</Label>
                <Input
                  value={groupCode}
                  onChange={(e) => setGroupCode(e.target.value)}
                  placeholder="مثلاً ۰۱"
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  محل تشکیل کلاس / شماره اتاق
                </Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="مثلاً دانشکده فنی - کلاس ۱۰۲"
                  className="text-xs"
                />
              </div>
            </div>

            {/* Weekly Slots Builder */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  جلسات هفتگی کلاس
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddSlot}
                  className="h-7 text-xs gap-1 border-dashed text-primary border-primary/30"
                >
                  <Plus className="h-3 w-3" /> افزودن جلسه
                </Button>
              </div>

              <div className="space-y-2">
                {slots.map((slot, idx) => {
                  const isInvalid =
                    parseTimeToMinutes(slot.startTime) >= parseTimeToMinutes(slot.endTime);

                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border transition-all shadow-2xs space-y-1.5 ${isInvalid
                        ? "border-destructive/60 bg-destructive/5 ring-1 ring-destructive/30"
                        : "border-border/70 bg-card/60"
                        }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Day */}
                        <div className="w-28 shrink-0">
                          <Select
                            value={String(slot.dayOfWeek)}
                            onValueChange={(val) =>
                              handleUpdateSlot(idx, "dayOfWeek", parseInt(val))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs w-full">
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

                        {/* Time Pickers */}
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
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
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
                مشخصات آزمون پایان‌ترم (اختیاری)
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">تاریخ آزمون (شمسی):</span>
                  <JalaliDatePicker
                    value={examDate}
                    onChange={setExamDate}
                    placeholder="انتخاب تاریخ آزمون"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">بازه ساعت آزمون:</span>
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
                  {examDate && parseTimeToMinutes(examStartTime) >= parseTimeToMinutes(examEndTime) && (
                    <div className="text-[11px] text-destructive flex items-center gap-1 pt-0.5 font-medium">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span>ساعت پایان آزمون باید بعد از شروع باشد.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>
          <DialogFooter className="pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              انصراف
            </Button>
            <Button
              type="submit"
              form="admin-event-form"
              onClick={() => handleSaveEvent()}
              disabled={isSubmitting || !selectedOfferingId}
              className="gap-1.5 font-semibold"
            >
              {isSubmitting
                ? "در حال ثبت..."
                : editingEvent
                  ? `ذخیره تغییرات رویداد`
                  : `ثبت رویداد کلاسی`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Modal: Clone / Copy All Events from Another Semester */}
      <Dialog open={isCloneModalOpen} onOpenChange={setIsCloneModalOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Copy className="h-4 w-4 text-primary" />
              کپی کامل رویدادها از نیمسال دیگر
            </DialogTitle>
            <DialogDescription className="text-xs">
              تمامی دروس، اساتید، گروه‌ها، جلسات هفتگی و محل کلاس‌های یک نیمسال را به نیمسال فعلی منتقل کنید.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCloneEvents} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">نیمسال مبدأ (جهت کپی رویدادها):</Label>
              <Select
                items={cloneableSourceTerms.map((t) => ({
                  value: t,
                  label: `${formatSemesterLabel(t)} (${events.filter((e) => e.term === t).length} رویداد کلاسی)`,
                }))}
                value={cloneSourceTerm}
                onValueChange={(val) => val && setCloneSourceTerm(val)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="-- انتخاب نیمسال مبدأ --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {cloneableSourceTerms.map((t) => {
                      const count = events.filter((e) => e.term === t).length;
                      return (
                        <SelectItem key={t} value={t}>
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

              <div className="pt-2 border-t border-border/60 flex items-center gap-2.5">
                <Checkbox
                  id="resetExams"
                  checked={resetExamDates}
                  onCheckedChange={(checked) => setResetExamDates(Boolean(checked))}
                />
                <Label htmlFor="resetExams" className="text-xs cursor-pointer font-normal select-none">
                  پاک کردن تاریخ امتحانات قبلی (جهت تعیین مجدد در ترم جدید)
                </Label>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                disabled={isSubmitting || !cloneSourceTerm}
                className="w-full font-semibold gap-1.5"
              >
                <Sparkles className="h-4 w-4" />
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
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-primary" />
              تعریف / جابجایی به نیمسال جدید
            </DialogTitle>
            <DialogDescription className="text-xs">
              سال و دوره تحصیلی را وارد کنید تا پنل رویدادها به آن نیمسال منتقل شود.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateNewTerm} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">سال تحصیلی:</Label>
              <NumberInput
                min={1350}
                max={1499}
                value={newTermYear}
                onChange={(val) => setNewTermYear(String(val))}
                placeholder="مثلاً ۱۴۰۴"
                required
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">دوره نیمسال:</Label>
              <Select
                items={semesterTypeOptions}
                value={newTermType}
                onValueChange={(val) => val && setNewTermType(val as any)}
              >
                <SelectTrigger className="w-full">
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
                className="w-full font-semibold"
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
