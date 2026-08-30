"use client";

import React, { useState, useEffect } from "react";
import type { Course, Professor, CourseOffering, Faculty } from "@/lib/types";
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
import { Combobox } from "@/components/ui/combobox";
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
  Plus,
  Pencil,
  Trash2,
  Search,
  BookOpen,
  Users,
  Layers,
  Sparkles,
  Building2,
  BookUser,
} from "lucide-react";

const items = [
  { label: "Select a fruit", value: null },
  { label: "Apple", value: "apple" },
  { label: "Banana", value: "banana" },
  { label: "Blueberry", value: "blueberry" },
  { label: "Grapes", value: "grapes" },
  { label: "Pineapple", value: "pineapple" },
];

interface OfferingManagerProps {
  courses: Course[];
  professors: Professor[];
  faculties?: Faculty[];
  selectedFacultyId?: string;
}

export function OfferingManager({
  courses,
  professors,
  faculties = [],
  selectedFacultyId,
}: OfferingManagerProps) {
  const [offerings, setOfferings] = useState<CourseOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffering, setEditingOffering] = useState<CourseOffering | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentFaculty = faculties.find((f) => f.id === selectedFacultyId);

  // Form State: Only Course + Professor
  const [form, setForm] = useState({
    courseId: "",
    professorId: "",
  });

  const loadOfferings = async () => {
    try {
      setLoading(true);
      const url = selectedFacultyId
        ? `/api/offerings?facultyId=${selectedFacultyId}`
        : "/api/offerings";
      const res = await fetch(url).then((r) => r.json());
      if (res.success) {
        setOfferings(res.data);
      }
    } catch (err) {
      console.error("Failed to load offerings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOfferings();
  }, [selectedFacultyId]);

  const handleOpenCreateModal = () => {
    setEditingOffering(null);
    setForm({
      courseId: courses[0]?.id || "",
      professorId: professors[0]?.id || "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (off: CourseOffering) => {
    setEditingOffering(off);
    setForm({
      courseId: off.courseId,
      professorId: off.professorId,
    });
    setIsModalOpen(true);
  };

  const handleSaveOffering = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.courseId || !form.professorId) return;

    setIsSubmitting(true);
    try {
      if (editingOffering) {
        const res = await fetch("/api/offerings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingOffering.id,
            ...form,
          }),
        }).then((r) => r.json());

        if (res.success) {
          setIsModalOpen(false);
          await loadOfferings();
        } else {
          alert(res.message || "خطا در ویرایش ارائه");
        }
      } else {
        const res = await fetch("/api/offerings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }).then((r) => r.json());

        if (res.success) {
          setIsModalOpen(false);
          await loadOfferings();
        } else {
          alert(res.message || "خطا در ایجاد ارائه");
        }
      }
    } catch (err) {
      console.error("Save offering error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOffering = async (id: string, name: string) => {
    if (!confirm(`آیا از حذف اتصال ارائه درس "${name}" مطمئن هستید؟`)) return;

    try {
      const res = await fetch(`/api/offerings?id=${id}`, { method: "DELETE" }).then((r) =>
        r.json()
      );
      if (res.success) {
        await loadOfferings();
      }
    } catch (err) {
      console.error("Delete offering error:", err);
    }
  };

  const filteredOfferings = offerings.filter((off) => {
    const matchesSearch =
      (off.courseName || "").toLowerCase().includes(search.toLowerCase()) ||
      (off.courseCode || "").toLowerCase().includes(search.toLowerCase()) ||
      (off.professorName || "").toLowerCase().includes(search.toLowerCase());

    return matchesSearch;
  });

  const facultyCourses = courses.filter(
    (c) => !selectedFacultyId || c.facultyId === selectedFacultyId
  );
  const facultyProfessors = professors.filter(
    (p) => !selectedFacultyId || p.facultyId === selectedFacultyId
  );

  const courseOptions = facultyCourses.map((c) => ({
    value: c.id,
    label: `${c.name} (${c.units} واحد)`,
  }));

  const professorOptions = facultyProfessors.map((p) => ({
    value: p.id,
    label: `${p.name} (${p.title || "استاد"})`,
  }));

  return (
    <div className="space-y-4">
      {/* Standard Active Faculty Header Banner */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20 shrink-0">
              <Sparkles className="h-5 w-5" />
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
                    دانشکده‌ای در بخش ساختار دانشگاه انتخاب نشده است
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                فقط ارائه‌های درسی (ترکیب درس + استاد) مربوط به این دانشکده نمایش داده می‌شوند و ارائه‌های جدید نیز از دروس و اساتید این دانشکده ساخته می‌شوند.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-border/70 shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BookUser className="h-4 w-4 text-primary" />
              <span>ارائه‌های درسی (اتصال درس به استاد)</span>
            </CardTitle>
            <CardDescription className="text-xs">
              تعریف اینکه چه استادی چه درسی را تدریس می‌کند (موجودیت پایه جهت تفکیک نظرات دانشجویان و برنامه‌ریزی کلاسی)
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={handleOpenCreateModal}
            className="h-8 gap-1.5 text-xs shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            تعریف اتصال درس و استاد
          </Button>
        </CardHeader>

        <CardContent className="px-4 space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative">
              <Input
                placeholder="جستجوی درس یا استاد..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-64 text-xs pr-8"
              />
              <Search className="pointer-events-none absolute right-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            </div>

            <div className="text-xs text-muted-foreground">
              مجموع ارائه‌ها: <span className="font-bold text-foreground">{filteredOfferings.length}</span>
            </div>
          </div>

          {/* Offerings Table */}
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                  <th className="py-2.5 px-3 text-right">نام درس و مشخصات</th>
                  <th className="py-2.5 px-3 text-right">استاد مدرس</th>
                  <th className="py-2.5 px-3 text-center">شناسه ارائه</th>
                  <th className="py-2.5 px-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredOfferings.map((off) => (
                  <tr key={off.id} className="hover:bg-muted/20 transition-colors">
                    {/* Course */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 font-bold text-xs shrink-0">
                          <BookOpen className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="font-bold text-foreground">{off.courseName}</div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>{off.courseCode}</span>
                            <span>•</span>
                            <span>{off.courseUnits} واحد</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Professor */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0 overflow-hidden border border-border/70">
                          {off.professorAvatarUrl ? (
                            <img src={off.professorAvatarUrl} alt={off.professorName} className="h-full w-full object-cover" />
                          ) : (
                            <span>{off.professorName ? off.professorName.charAt(0) : "؟"}</span>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{off.professorName}</div>
                          <div className="text-[10px] text-muted-foreground">{off.professorTitle}</div>
                        </div>
                      </div>
                    </td>

                    {/* ID */}
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant="outline" className="text-[10px]">
                        {off.id}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditModal(off)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          title="ویرایش ارائه"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleDeleteOffering(off.id, `${off.courseName} (${off.professorName})`)
                          }
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          title="حذف ارائه"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredOfferings.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-xs text-muted-foreground">
                      {loading ? "در حال دریافت ارائه‌ها..." : "هیچ ارائه‌ای با این مشخصات یافت نشد."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              {editingOffering ? (
                <>
                  <Pencil className="h-4 w-4 text-primary" />
                  ویرایش اتصال درس به استاد (ارائه)
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 text-primary" />
                  اتصال درس به استاد (تعریف ارائه)
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              درس و استاد مربوطه را انتخاب کنید تا به عنوان ارائه‌دهنده در سامانه ثبت شود.
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
          </div>

          <form onSubmit={handleSaveOffering} className="space-y-4">
            {/* Course Combobox */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">انتخاب درس:</Label>
              <Combobox
                items={courses.map((c) => ({
                  value: c.id,
                  label: c.name,
                  badge: c.code,
                  sublabel: `${c.units} واحد`,
                  keywords: [c.name, c.code],
                }))}
                value={form.courseId}
                onChange={(val) => setForm({ ...form, courseId: val })}
                placeholder="-- انتخاب یا جستجوی درس --"
                searchPlaceholder="جستجوی نام یا کد درس..."
              />
            </div>

            {/* Professor Combobox */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">استاد مدرس:</Label>
              <Combobox
                items={professors.map((p) => ({
                  value: p.id,
                  label: p.name,
                  sublabel: p.title || undefined,
                  keywords: [p.name, p.title || ""],
                }))}
                value={form.professorId}
                onChange={(val) => setForm({ ...form, professorId: val })}
                placeholder="-- انتخاب یا جستجوی استاد --"
                searchPlaceholder="جستجوی نام استاد..."
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !form.courseId || !form.professorId}
                className="w-full font-semibold"
              >
                {isSubmitting
                  ? "در حال ثبت..."
                  : editingOffering
                  ? "ذخیره تغییرات ارائه"
                  : "ثبت اتصال ارائه"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

