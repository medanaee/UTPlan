"use client";

import React, { useState } from "react";
import {
  BookOpen,
  Building2,
  Plus,
  Pencil,
  Trash2,
  Link as LinkIcon,
  AlertTriangle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Course } from "@/lib/types";
import { useAdminStore } from "@/lib/stores/admin-store";

interface CourseManagerProps {
  onNavigateToStructure?: () => void;
}

export function CourseManager({ onNavigateToStructure }: CourseManagerProps) {
  const {
    faculties,
    courses,
    selectedFacultyId,
    loadAllData,
    setActionMessage,
  } = useAdminStore();

  const [courseSearch, setCourseSearch] = useState("");
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [prereqModalOpen, setPrereqModalOpen] = useState(false);
  const [selectedCourseForPrereq, setSelectedCourseForPrereq] = useState<Course | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const [courseForm, setCourseForm] = useState({
    name: "",
    code: "",
    units: 3,
    facultyId: "",
    offeredIn: "both" as "fall" | "spring" | "both",
    visualCategoryId: "",
    ruleCategoryId: "",
    description: "",
  });

  const [prereqForm, setPrereqForm] = useState({
    requiredCourseId: "",
    type: "prerequisite" as "prerequisite" | "corequisite",
  });
  const [prereqError, setPrereqError] = useState<string | null>(null);

  const currentFaculty = faculties.find((f) => f.id === selectedFacultyId);

  const facultyCourses = courses.filter(
    (c) => !selectedFacultyId || c.facultyId === selectedFacultyId
  );

  const filteredCourses = facultyCourses.filter(
    (c) =>
      c.name.toLowerCase().includes(courseSearch.toLowerCase()) ||
      c.code.toLowerCase().includes(courseSearch.toLowerCase())
  );

  // Create or Update Course
  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFacultyId) {
      alert("لطفاً ابتدا یک دانشکده را انتخاب یا ایجاد کنید.");
      return;
    }

    if (editingCourse) {
      const res = await fetch("/api/courses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingCourse.id,
          name: courseForm.name,
          code: courseForm.code,
          units: Number(courseForm.units) || 3,
          facultyId: selectedFacultyId,
          offeredIn: courseForm.offeredIn,
          description: courseForm.description || "",
        }),
      }).then((r) => r.json());

      if (res.success) {
        setCourseModalOpen(false);
        setEditingCourse(null);
        setCourseForm({
          name: "",
          code: "",
          units: 3,
          facultyId: selectedFacultyId,
          offeredIn: "both",
          visualCategoryId: "",
          ruleCategoryId: "",
          description: "",
        });
        setActionMessage("مشخصات درس با موفقیت ویرایش شد.");
        await loadAllData();
      } else {
        alert(res.message || "خطا در ویرایش درس");
      }
    } else {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: courseForm.name,
          code: courseForm.code,
          units: Number(courseForm.units) || 3,
          facultyId: selectedFacultyId,
          offeredIn: courseForm.offeredIn,
          description: courseForm.description || "",
        }),
      }).then((r) => r.json());

      if (res.success) {
        setCourseModalOpen(false);
        setCourseForm({
          name: "",
          code: "",
          units: 3,
          facultyId: selectedFacultyId,
          offeredIn: "both",
          visualCategoryId: "",
          ruleCategoryId: "",
          description: "",
        });
        setActionMessage("درس جدید با موفقیت اضافه شد.");
        await loadAllData();
      } else {
        alert(res.message || "خطا در ثبت درس");
      }
    }
  };

  // Add Prerequisite with Cycle Check
  const handleAddPrerequisite = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrereqError(null);
    if (!selectedCourseForPrereq || !prereqForm.requiredCourseId) return;

    const res = await fetch("/api/courses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_prerequisite",
        courseId: selectedCourseForPrereq.id,
        requiredCourseId: prereqForm.requiredCourseId,
        type: prereqForm.type,
      }),
    }).then((r) => r.json());

    if (!res.success) {
      setPrereqError(res.message);
      return;
    }

    setPrereqForm({ requiredCourseId: "", type: "prerequisite" });
    await loadAllData();
    const updatedCourse = await fetch(`/api/courses?id=${selectedCourseForPrereq.id}`).then((r) => r.json());
    if (updatedCourse.success) setSelectedCourseForPrereq(updatedCourse.data);
  };

  // Remove Prerequisite
  const handleRemovePrerequisite = async (relationId: string) => {
    if (!selectedCourseForPrereq) return;
    await fetch("/api/courses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "remove_prerequisite",
        relationId,
      }),
    });
    await loadAllData();
    const updatedCourse = await fetch(`/api/courses?id=${selectedCourseForPrereq.id}`).then((r) => r.json());
    if (updatedCourse.success) setSelectedCourseForPrereq(updatedCourse.data);
  };

  const offeredInSelectItems = [
    { value: "both", label: "هردو ترم (پاییز و بهار)" },
    { value: "fall", label: "فقط ترم پاییز (فرد)" },
    { value: "spring", label: "فقط ترم بهار (زوج)" },
  ];

  const prereqCourseSelectItems = courses
    .filter(
      (c) =>
        c.id !== selectedCourseForPrereq?.id &&
        (!selectedCourseForPrereq?.facultyId || c.facultyId === selectedCourseForPrereq.facultyId)
    )
    .map((c) => ({
      value: c.id,
      label: `${c.name} (${c.code} - ${c.units} واحد)`,
    }));

  const prereqTypeSelectItems = [
    { value: "prerequisite", label: "پیش‌نیاز (باید در ترم‌های قبل گذرانده شود)" },
    { value: "corequisite", label: "هم‌نیاز (می‌تواند در همان ترم یا قبل از آن اخذ شود)" },
  ];

  return (
    <div className="space-y-4">
      {/* Active Faculty Indicator & Switcher */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/10 via-primary/5 to-card p-4 shadow-sm">
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
        <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <span>بانک اطلاعاتی دروس {currentFaculty ? `«${currentFaculty.name}»` : ""}</span>
            </CardTitle>
            <CardDescription className="text-xs">
              مدیریت دروس، تعداد واحدها، نوع ارائه و تعیین پیش‌نیازها و هم‌نیازها
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditingCourse(null);
              setCourseForm({
                name: "",
                code: "",
                units: 3,
                facultyId: selectedFacultyId,
                offeredIn: "both",
                visualCategoryId: "",
                ruleCategoryId: "",
                description: "",
              });
              setCourseModalOpen(true);
            }}
            disabled={!selectedFacultyId}
            className="h-8 gap-1 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            افزودن درس جدید
          </Button>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map((course) => (
              <div
                key={course.id}
                className="flex flex-col justify-between rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs hover:border-primary/40 transition-colors"
              >
                <div className="space-y-2">
                  {/* Course header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold text-foreground">{course.name}</h3>
                      <span className="text-[11px] text-muted-foreground">{course.code}</span>
                    </div>
                    <Badge variant="outline" className="text-[11px] font-semibold">
                      {course.units} واحد
                    </Badge>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1 text-[10px]">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      ارائه:{" "}
                      {course.offeredIn === "fall"
                        ? "فقط پاییز"
                        : course.offeredIn === "spring"
                        ? "فقط بهار"
                        : "پاییز و بهار"}
                    </Badge>
                  </div>

                  {/* Prerequisites & Corequisites */}
                  <div className="space-y-1 pt-1 border-t border-border/50">
                    <p className="text-[10px] font-semibold text-muted-foreground">وابستگی‌ها:</p>
                    {!course.prerequisites || course.prerequisites.length === 0 ? (
                      <span className="text-[10px] text-muted-foreground/70 italic">بدون پیش‌نیاز</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {course.prerequisites.map((p) => (
                          <span
                            key={p.id}
                            className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              p.type === "prerequisite"
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                : "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                            }`}
                          >
                            {p.type === "prerequisite" ? "پیش:" : "هم:"} {p.requiredCourseName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/40">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedCourseForPrereq(course);
                      setPrereqError(null);
                      setPrereqModalOpen(true);
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
                          units: course.units,
                          facultyId: course.facultyId || selectedFacultyId,
                          offeredIn: course.offeredIn || "both",
                          visualCategoryId: "",
                          ruleCategoryId: "",
                          description: course.description || "",
                        });
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
                          await fetch(`/api/courses?id=${course.id}`, { method: "DELETE" });
                          setActionMessage(`درس «${course.name}» حذف شد.`);
                          await loadAllData();
                        }
                      }}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="حذف درس"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
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
            <div className="space-y-1.5">
              <Label className="text-sm">انتخاب درس وابسته (از همین دانشکده):</Label>
              <Select
                items={prereqCourseSelectItems}
                value={prereqForm.requiredCourseId}
                onValueChange={(val) => val && setPrereqForm({ ...prereqForm, requiredCourseId: val })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="-- یک درس را انتخاب کنید --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {prereqCourseSelectItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">نوع وابستگی:</Label>
              <Select
                items={prereqTypeSelectItems}
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
                        className={`mr-2 text-[10px] ${
                          rel.type === "prerequisite" ? "text-amber-600" : "text-sky-600"
                        }`}
                      >
                        {rel.type === "prerequisite" ? "پیش‌نیاز" : "هم‌نیاز"}
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

          {/* Target Faculty Indicator */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <span className="text-muted-foreground">دانشکده هدف:</span>
              <span className="font-bold text-foreground">
                {currentFaculty ? `${currentFaculty.name} (${currentFaculty.code})` : "انتخاب نشده"}
              </span>
            </div>
            <Badge variant="outline" className="text-[10px]">تثبیت‌شده</Badge>
          </div>

          <form onSubmit={handleSaveCourse} className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">نام درس:</Label>
                <Input
                  required
                  placeholder="مثلاً ریاضی عمومی ۱"
                  value={courseForm.name}
                  onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">کد درس:</Label>
                <Input
                  required
                  placeholder="مثلاً MATH101"
                  value={courseForm.code}
                  onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })}
                  className="h-8 text-xs"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">تعداد واحد:</Label>
                <Input
                  type="number"
                  min={1}
                  max={6}
                  value={courseForm.units}
                  onChange={(e) => setCourseForm({ ...courseForm, units: parseInt(e.target.value) || 3 })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">ترم ارائه:</Label>
                <Select
                  items={offeredInSelectItems}
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

            <div className="space-y-1">
              <Label className="text-xs font-semibold">توضیحات اختیاری:</Label>
              <Input
                placeholder="توضیحات تکمیلی یا سرفصل درس..."
                value={courseForm.description}
                onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                className="h-8 text-xs"
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
    </div>
  );
}
