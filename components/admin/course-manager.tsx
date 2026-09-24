"use client";

import React, { useState, useMemo } from "react";
import { persianSearch } from "@/lib/search/persian-search";
import { fetchJson, postJson, putJson, deleteJson } from "@/lib/api-client";
import {
  BookOpen,
  Building2,
  Plus,
  Pencil,
  Trash2,
  Link as LinkIcon,
  Link2,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Course, DegreeLevel } from "@/lib/types";
import { CourseImportDialog } from "@/components/courses/course-import-dialog";
import { Download, Upload } from "lucide-react";
import { useAdminStore } from "@/lib/stores/admin-store";

interface CourseManagerProps {
  onNavigateToStructure?: () => void;
}

export function CourseManager({ onNavigateToStructure }: CourseManagerProps) {
  const {
    faculties,
    courses,
    selectedFacultyId,
    loadCourses,
    setActionMessage,
  } = useAdminStore();

  const [courseSearch, setCourseSearch] = useState("");
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [courseFormError, setCourseFormError] = useState<string | null>(null);
  const [prereqModalOpen, setPrereqModalOpen] = useState(false);
  const [selectedCourseForPrereq, setSelectedCourseForPrereq] = useState<Course | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const [courseForm, setCourseForm] = useState({
    name: "",
    code: "",
    abbreviation: "",
    units: 3,
    degreeLevel: "undergrad" as DegreeLevel,
    facultyId: "",
    offeredIn: "both" as "fall" | "spring" | "both" | "none",
    categoryId: "",
    description: "",
  });

  const [prereqForm, setPrereqForm] = useState({
    requiredCourseId: "",
    type: "prerequisite" as "prerequisite" | "corequisite" | "recommended",
  });
  const [prereqError, setPrereqError] = useState<string | null>(null);

  const currentFaculty = faculties.find((f) => f.id === selectedFacultyId);
  const linkedFacultyIds = currentFaculty?.linkedFacultyIds || [];

  const facultyCourses = courses.filter((c) => {
    if (!selectedFacultyId) return true;
    return c.facultyId === selectedFacultyId || linkedFacultyIds.includes(c.facultyId);
  });

  const filteredCourses = useMemo(() => {
    return persianSearch(facultyCourses, courseSearch);
  }, [facultyCourses, courseSearch]);

  // Create or Update Course
  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setCourseFormError(null);
    if (!selectedFacultyId) {
      setCourseFormError("لطفاً ابتدا یک دانشکده را انتخاب یا ایجاد کنید.");
      return;
    }

    if (editingCourse) {
      const res = await putJson("/api/courses", {
        id: editingCourse.id,
        name: courseForm.name,
        code: courseForm.code?.trim() ? courseForm.code.trim().toUpperCase() : undefined,
        degreeLevel: courseForm.degreeLevel,
        abbreviation: courseForm.abbreviation?.trim() || null,
        units: Number(courseForm.units) || 3,
        facultyId: selectedFacultyId,
        offeredIn: courseForm.offeredIn,
        description: courseForm.description || "",
      });

      if (res.success) {
        setCourseModalOpen(false);
        setEditingCourse(null);
        setCourseFormError(null);
        setCourseForm({
          name: "",
          code: "",
          abbreviation: "",
          units: 3,
          degreeLevel: "undergrad",
          facultyId: selectedFacultyId,
          offeredIn: "both",
          categoryId: "",
          description: "",
        });
        setActionMessage("مشخصات درس با موفقیت ویرایش شد.");
        await loadCourses(true);
      } else {
        setCourseFormError(res.message || "خطا در ویرایش درس");
      }
    } else {
      const res = await postJson("/api/courses", {
        name: courseForm.name,
        code: courseForm.code?.trim() ? courseForm.code.trim().toUpperCase() : undefined,
        degreeLevel: courseForm.degreeLevel,
        abbreviation: courseForm.abbreviation?.trim() || null,
        units: Number(courseForm.units) || 3,
        facultyId: selectedFacultyId,
        offeredIn: courseForm.offeredIn,
        description: courseForm.description || "",
      });

      if (res.success) {
        setCourseModalOpen(false);
        setCourseFormError(null);
        setCourseForm({
          name: "",
          code: "",
          abbreviation: "",
          units: 3,
          degreeLevel: "undergrad",
          facultyId: selectedFacultyId,
          offeredIn: "both",
          categoryId: "",
          description: "",
        });
        setActionMessage("درس جدید با موفقیت ایجاد شد.");
        await loadCourses(true);
      } else {
        setCourseFormError(res.message || "خطا در ایجاد درس");
      }
    }
  };

  // Add Prerequisite with Cycle Check
  const handleAddPrerequisite = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrereqError(null);
    if (!selectedCourseForPrereq || !prereqForm.requiredCourseId) return;

    const res = await putJson("/api/courses", {
      action: "add_prerequisite",
      courseId: selectedCourseForPrereq.id,
      requiredCourseId: prereqForm.requiredCourseId,
      type: prereqForm.type,
    });

    if (!res.success) {
      setPrereqError(res.message);
      return;
    }

    setPrereqForm({ requiredCourseId: "", type: "prerequisite" });
    const updatedCourse = await fetchJson(`/api/courses?id=${selectedCourseForPrereq.id}`);
    if (updatedCourse.success) setSelectedCourseForPrereq(updatedCourse.data);
    await loadCourses(true);
  };

  // Remove Prerequisite
  const handleRemovePrerequisite = async (relationId: string) => {
    if (!selectedCourseForPrereq) return;
    await putJson("/api/courses", {
      action: "remove_prerequisite",
      relationId,
    });
    const updatedCourse = await fetchJson(`/api/courses?id=${selectedCourseForPrereq.id}`);
    if (updatedCourse.success) setSelectedCourseForPrereq(updatedCourse.data);
    await loadCourses(true);
  };

  const offeredInSelectItems = [
    { value: "both", label: "هردو ترم (پاییز و بهار)" },
    { value: "fall", label: "فقط ترم پاییز (فرد)" },
    { value: "spring", label: "فقط ترم بهار (زوج)" },
    { value: "none", label: "عدم ارائه (هیچ‌ترم)" },
  ];

  const prereqCourseSelectItems = courses
    .filter(
      (c) =>
        c.id !== selectedCourseForPrereq?.id &&
        (!selectedCourseForPrereq?.facultyId || c.facultyId === selectedCourseForPrereq.facultyId)
    )
    .map((c) => ({
      value: c.id,
      label: `${c.name} (${c.units} واحد)`,
    }));

  const prereqTypeSelectItems = [
    { value: "prerequisite", label: "پیش‌نیاز رسمی (باید در ترم‌های قبل گذرانده شود)" },
    { value: "corequisite", label: "هم‌نیاز رسمی (می‌تواند در همان ترم یا قبل از آن اخذ شود)" },
    { value: "recommended", label: "پیش‌نیاز پیشنهادی / غیررسمی (توصیه شده - غیرالزامی)" },
  ];

  return (
    <div className="space-y-4">
      {/* Active Faculty Indicator & Switcher */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20 shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
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
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                فقط دروس و روابط پیش‌نیازی مربوط به این دانشکده نمایش داده می‌شوند.
              </p>
            </div>
          </div>

          {!currentFaculty && onNavigateToStructure && (
            <Button
              size="sm"
              variant="outline"
              onClick={onNavigateToStructure}
              className="h-8 text-xs gap-1 shadow-2xs"
            >
              <Building2 className="h-3.5 w-3.5" />
              انتخاب در ساختار دانشگاه
            </Button>
          )}
        </div>
      </div>

      <Card className="border-border/70 shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <span> دروس {currentFaculty ? `«${currentFaculty.name}»` : ""}</span>
            </CardTitle>
            <CardDescription className="text-xs">
              مدیریت دروس، تعداد واحدها، نوع ارائه و تعیین پیش‌نیازها و هم‌نیازها
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const url = selectedFacultyId
                  ? `/api/courses/export?facultyId=${selectedFacultyId}`
                  : "/api/courses/export";
                window.open(url, "_blank");
              }}
              className="h-8 gap-1.5 text-xs shadow-2xs"
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              <span>خروجی JSON</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImportModalOpen(true)}
              className="h-8 gap-1.5 text-xs shadow-2xs font-semibold"
            >
              <Upload className="h-3.5 w-3.5 text-primary" />
              <span>ورودی JSON</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!selectedFacultyId) return;
                if (
                  confirm(
                    `هشدار: آیا از حذف کلیه دروس دانشکده «${currentFaculty?.name || ""
                    }» مطمئن هستید؟ دروس به صورت موقت (Soft Delete) حذف می‌شوند و با ثبت مجدد کدهای مشابه یا ویرایش بازگردانده خواهند شد.`
                  )
                ) {
                  const res = await deleteJson(`/api/courses?all=true&facultyId=${selectedFacultyId}`);
                  if (res.success) {
                    setActionMessage("کلیه دروس دانشکده با موفقیت حذف (Soft Delete) شدند.");
                    await loadCourses(true);
                  } else {
                    alert(res.message || "خطا در حذف دروس");
                  }
                }
              }}
              disabled={!selectedFacultyId || facultyCourses.length === 0}
              className="h-8 gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 shadow-2xs font-medium"
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
              <span>حذف همه دروس</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => {
                setEditingCourse(null);
                setCourseForm({
                  name: "",
                  code: "",
                  abbreviation: "",
                  units: 3,
                  degreeLevel: "undergrad",
                  facultyId: selectedFacultyId,
                  offeredIn: "both",
                  categoryId: "",
                  description: "",
                });
                setCourseFormError(null);
                setCourseModalOpen(true);
              }}
              disabled={!selectedFacultyId}
              className="h-8 gap-1.5 text-xs font-bold"
            >
              <Plus className="h-3.5 w-3.5" />
              افزودن درس جدید
            </Button>
          </div>
        </CardHeader>

        <CardContent className="px-4 space-y-4">
          {/* Search Bar */}
          <div className="flex items-center justify-between gap-3">
            <Input
              placeholder="جستجو بر اساس نام یا کد درس..."
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
              className="h-8 max-w-sm text-xs"
            />
            <Badge variant="secondary" className="text-xs">
              نمایش {filteredCourses.length} از {facultyCourses.length} درس این دانشکده
            </Badge>
          </div>

          {/* Courses Grid */}
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filteredCourses.map((course) => {
              const isLinked = Boolean(selectedFacultyId && course.facultyId !== selectedFacultyId);
              return (
                <div
                  key={course.id}
                  className={`flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs transition-colors ${isLinked
                      ? "border-amber-500/40 bg-amber-500/2"
                      : "border-border/80 bg-card hover:border-primary/40"
                    }`}
                >
                  <div className="space-y-2">
                    {/* Course header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-xs font-bold text-foreground">{course.name}</h3>
                          {course.abbreviation && (
                            <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0 text-primary border-primary/30 bg-primary/5">
                              {course.abbreviation}
                            </Badge>
                          )}
                          {isLinked && (
                            <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0 text-amber-600 border-amber-500/30 bg-amber-500/10 gap-0.5">
                              <Link2 className="h-2.5 w-2.5" />
                              {course.facultyName || "لینک‌شده"}
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">{course.code}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[11px] font-semibold">
                          {course.units} واحد
                        </Badge>
                        <Badge variant="outline" className="text-[11px] font-semibold">
                          {course.offeredIn === "fall"
                            ? "فقط پاییز"
                            : course.offeredIn === "spring"
                              ? "فقط بهار"
                              : course.offeredIn === "none"
                                ? "عدم ارائه"
                                : "پاییز و بهار"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-medium px-1.5 py-0 ${course.degreeLevel === "master"
                              ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                              : "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30"
                            }`}
                        >
                          {course.degreeLevel === "master" ? "ارشد" : "کارشناسی"}
                        </Badge>
                      </div>
                    </div>

                    {/* Prerequisites & Corequisites */}
                    <div className="space-y-1 pt-3 border-t border-border/50">
                      <p className="text-[10px] font-semibold text-muted-foreground">وابستگی‌ها:</p>
                      {!course.prerequisites || course.prerequisites.length === 0 ? (
                        <span className="text-[10px] text-muted-foreground/70 italic">بدون پیش‌نیاز</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {course.prerequisites.map((p) => (
                            <span
                              key={p.id}
                              className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium border ${p.type === "prerequisite"
                                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                                  : p.type === "corequisite"
                                    ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
                                    : "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20"
                                }`}
                            >
                              {p.type === "prerequisite"
                                ? "پیش‌نیاز:"
                                : p.type === "corequisite"
                                  ? "هم‌نیاز:"
                                  : "پیشنهادی:"}{" "}
                              {p.requiredCourseName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="mt-3 flex items-center justify-between">
                    {isLinked ? (
                      <div className="flex items-center justify-between w-full pt-1 text-[11px] text-amber-700 dark:text-amber-300">
                        <span className="flex items-center gap-1 font-medium">
                          <Link2 className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                          <span>لینک‌شده از {course.facultyName || "دانشکده مبدأ"}</span>
                        </span>
                        <Badge variant="secondary" className="text-[10px] gap-1 text-muted-foreground select-none">
                          <Lock className="h-3 w-3" />
                          فقط‌خواندنی
                        </Badge>
                      </div>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            setSelectedCourseForPrereq(course);
                            setPrereqError(null);
                            setPrereqModalOpen(true);
                            // Lazy fetch single course prerequisites to ensure up-to-date data
                            const fresh = await fetchJson(`/api/courses?id=${course.id}`);
                            if (fresh.success && fresh.data) {
                              setSelectedCourseForPrereq(fresh.data);
                            }
                          }}
                          className="h-7 gap-1 text-[11px]"
                        >
                          <LinkIcon className="h-3 w-3" />
                          پیش‌نیازها ({course.prerequisites?.length || 0})
                        </Button>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingCourse(course);
                              setCourseForm({
                                name: course.name,
                                code: course.code,
                                abbreviation: course.abbreviation || "",
                                units: course.units,
                                degreeLevel: course.degreeLevel || "undergrad",
                                facultyId: course.facultyId || selectedFacultyId,
                                offeredIn: course.offeredIn || "both",
                                categoryId: "",
                                description: course.description || "",
                              });
                              setCourseFormError(null);
                              setCourseModalOpen(true);
                            }}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            title="ویرایش مشخصات درس"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              if (confirm(`آیا از حذف درس ${course.name} مطمئن هستید؟`)) {
                                await deleteJson(`/api/courses?id=${course.id}`);
                                setActionMessage(`درس «${course.name}» حذف شد.`);
                                await loadCourses(true);
                              }
                            }}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="حذف درس"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {filteredCourses.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-8">
              درسی در این دانشکده یافت نشد.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Prerequisite Management Modal */}
      <Dialog open={prereqModalOpen} onOpenChange={setPrereqModalOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              مدیریت پیش‌نیازهای درس: {selectedCourseForPrereq?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              پیش‌نیازها یا هم‌نیازهای این درس را تعیین کنید. سیستم از ایجاد روابط چرخشی جلوگیری می‌کند.
            </DialogDescription>
          </DialogHeader>

          {prereqError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{prereqError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAddPrerequisite} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">انتخاب درس وابسته (از همین دانشکده):</Label>
              <Combobox
                items={facultyCourses
                  .filter((c) => c.id !== selectedCourseForPrereq?.id)
                  .map((c) => ({
                    value: c.id,
                    label: c.name,
                    badge: c.code,
                    sublabel: `${c.units} واحد`,
                    keywords: [c.name, c.code],
                  }))}
                value={prereqForm.requiredCourseId}
                onChange={(val) => setPrereqForm({ ...prereqForm, requiredCourseId: val })}
                placeholder="-- انتخاب یا جستجوی درس وابسته --"
                searchPlaceholder="جستجوی نام یا کد درس..."
                className="w-full"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">نوع وابستگی:</Label>
              <Select
                value={prereqForm.type}
                onValueChange={(val) =>
                  val &&
                  setPrereqForm({
                    ...prereqForm,
                    type: val as "prerequisite" | "corequisite",
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {prereqTypeSelectItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" size="sm" className="w-full text-xs font-semibold">
              افزودن رابطه پیش‌نیازی
            </Button>
          </form>

          {/* Existing Prerequisites List */}
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-semibold text-muted-foreground">روابط تعریف‌شده فعلی:</p>
            {(!selectedCourseForPrereq?.prerequisites ||
              selectedCourseForPrereq.prerequisites.length === 0) ? (
              <p className="text-xs text-muted-foreground italic">هیچ پیش‌نیازی تعریف نشده است.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {selectedCourseForPrereq.prerequisites.map((rel) => (
                  <div
                    key={rel.id}
                    className="flex items-center justify-between rounded-lg border bg-muted/40 p-2 text-xs"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold">{rel.requiredCourseName}</span>
                      <Badge
                        variant="outline"
                        className={`mr-2 text-[10px] ${rel.type === "prerequisite"
                            ? "text-amber-600 border-amber-500/30 bg-amber-500/10"
                            : rel.type === "corequisite"
                              ? "text-sky-600 border-sky-500/30 bg-sky-500/10"
                              : "text-violet-600 border-violet-500/30 bg-violet-500/10"
                          }`}
                      >
                        {rel.type === "prerequisite"
                          ? "پیش‌نیاز رسمی"
                          : rel.type === "corequisite"
                            ? "هم‌نیاز رسمی"
                            : "پیش‌نیاز پیشنهادی"}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemovePrerequisite(rel.id)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Course Modal */}
      <Dialog
        open={courseModalOpen}
        onOpenChange={(open) => {
          setCourseModalOpen(open);
          setCourseFormError(null);
          if (!open) setEditingCourse(null);
        }}
      >
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              {editingCourse ? (
                <>
                  <Pencil className="h-4 w-4 text-primary" />
                  <span>ویرایش مشخصات درس: {editingCourse.name}</span>
                </>
              ) : (
                <>
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span>تعریف درس جدید</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingCourse
                ? "مشخصات، نام، کد، تعداد واحد، ترم ارائه و توضیحات درس را ویرایش کنید."
                : "مشخصات درس و تعداد واحد را وارد کنید. انتساب دسته و چارت در بخش دسته‌بندی انجام می‌شود."}
            </DialogDescription>
          </DialogHeader>

          {/* Form Error Banner */}
          {courseFormError && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{courseFormError}</span>
            </div>
          )}

          {/* Target Faculty Indicator */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <span className="text-muted-foreground">دانشکده هدف:</span>
              <span className="font-bold text-foreground">
                {currentFaculty ? `${currentFaculty.name} (${currentFaculty.code})` : "انتخاب نشده"}
              </span>
            </div>
          </div>

          <form onSubmit={handleSaveCourse} className="space-y-3 pt-1">
            <div className="space-y-1 sm:col-span-1">
              <Label className="text-xs font-semibold">نام درس:</Label>
              <Input
                required
                placeholder="مثلاً ریاضی عمومی ۱"
                value={courseForm.name}
                onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">کد یکتای درس:</Label>
                  <span className="text-[10px] text-muted-foreground">اختیاری - خودکار</span>
                </div>
                <Input
                  placeholder="مثلاً 8101101"
                  value={courseForm.code}
                  onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value.toUpperCase() })}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">مخفف نام درس:</Label>
                  <span className="text-[10px] text-muted-foreground">اختیاری</span>
                </div>
                <Input
                  placeholder="مثلاً AP یا DS"
                  value={courseForm.abbreviation}
                  onChange={(e) => setCourseForm({ ...courseForm, abbreviation: e.target.value })}
                  dir="ltr"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">مقطع تحصیلی:</Label>
                <Select
                  value={courseForm.degreeLevel}
                  onValueChange={(val) =>
                    val &&
                    setCourseForm({
                      ...courseForm,
                      degreeLevel: val as DegreeLevel,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="undergrad">کارشناسی</SelectItem>
                      <SelectItem value="master">کارشناسی ارشد</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">تعداد واحد:</Label>
                <NumberInput
                  min={1}
                  max={6}
                  value={courseForm.units}
                  onChange={(val) => setCourseForm({ ...courseForm, units: parseInt(String(val)) || 3 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">ترم ارائه:</Label>
                <Select
                  value={courseForm.offeredIn}
                  onValueChange={(val) =>
                    val &&
                    setCourseForm({
                      ...courseForm,
                      offeredIn: val as "fall" | "spring" | "both",
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {offeredInSelectItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">توضیحات درس:</Label>
                <span className="text-[10px] text-muted-foreground">اختیاری (سرفصل، اهداف درس و ...)</span>
              </div>
              <Textarea
                placeholder="توضیحات تکمیلی یا سرفصل درس..."
                value={courseForm.description}
                onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                rows={3}
                className="text-xs resize-none"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                size="sm"
                disabled={!selectedFacultyId}
                className="h-8 text-xs font-semibold w-full"
              >
                {editingCourse
                  ? "ذخیره تغییرات درس"
                  : `ذخیره درس در ${currentFaculty ? currentFaculty.name : "دانشکده"}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Course Import Dialog */}
      <CourseImportDialog
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        defaultFacultyId={selectedFacultyId}
        targetFaculty={currentFaculty}
        onSuccess={() => loadCourses(true)}
      />
    </div>
  );
}
