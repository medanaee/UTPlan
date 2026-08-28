"use client";

import React, { useState, useEffect } from "react";
import type { Course, Professor, CourseOffering } from "@/lib/types";
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
  Sparkles,
  Plus,
  Trash2,
  Search,
  BookOpen,
  Users,
  GraduationCap,
  Layers,
  Calendar,
  Building,
} from "lucide-react";

interface OfferingManagerProps {
  courses: Course[];
  professors: Professor[];
}

export function OfferingManager({ courses, professors }: OfferingManagerProps) {
  const [offerings, setOfferings] = useState<CourseOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState({
    courseId: "",
    professorId: "",
    groupCode: "01",
    capacity: 40,
    term: "1403-1",
  });

  const loadOfferings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/offerings").then((r) => r.json());
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
  }, []);

  const handleCreateOffering = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.courseId || !form.professorId) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/offerings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then((r) => r.json());

      if (res.success) {
        setIsCreateModalOpen(false);
        setForm({
          courseId: "",
          professorId: "",
          groupCode: "01",
          capacity: 40,
          term: "1403-1",
        });
        await loadOfferings();
      } else {
        alert(res.message || "خطا در ایجاد ارائه");
      }
    } catch (err) {
      console.error("Create offering error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOffering = async (id: string, name: string) => {
    if (!confirm(`آیا از حذف ارائه درس "${name}" مطمئن هستید؟`)) return;

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
      (off.professorName || "").toLowerCase().includes(search.toLowerCase()) ||
      (off.groupCode || "").includes(search);

    const matchesTerm = selectedTerm === "all" || off.term === selectedTerm;
    return matchesSearch && matchesTerm;
  });

  const terms = Array.from(new Set(offerings.map((o) => o.term).filter(Boolean)));
  const termOptions = [
    { value: "all", label: "تمام نیمسال‌ها" },
    ...terms.map((t) => ({ value: t!, label: `نیمسال ${t}` })),
  ];

  const courseOptions = courses.map((c) => ({
    value: c.id,
    label: `${c.name} (${c.code} - ${c.units} واحد)`,
  }));

  const professorOptions = professors.map((p) => ({
    value: p.id,
    label: `${p.name} (${p.title || "استاد"})`,
  }));

  return (
    <div className="space-y-4">
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <span>مدیریت ارائه‌های درسی (Course Offerings)</span>
            </CardTitle>
            <CardDescription className="text-xs">
              ترکیب درس با استاد، شماره گروه، ظرفیت و نیمسال تحصیلی برای انتخاب واحد و ثبت نظرات
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setForm({
                courseId: courses[0]?.id || "",
                professorId: professors[0]?.id || "",
                groupCode: "01",
                capacity: 40,
                term: "1403-1",
              });
              setIsCreateModalOpen(true);
            }}
            className="h-8 gap-1.5 text-xs shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            تعریف ارائه جدید
          </Button>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Input
                  placeholder="جستجوی درس، استاد یا گروه..."
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
                  <SelectTrigger size="sm" className="h-8 min-w-[140px] text-xs">
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
              مجموع ارائه‌ها: <span className="font-bold text-foreground font-mono">{filteredOfferings.length}</span>
            </div>
          </div>

          {/* Offerings Table */}
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                  <th className="py-2.5 px-3 text-right">نام درس و کد</th>
                  <th className="py-2.5 px-3 text-right">استاد مدرس</th>
                  <th className="py-2.5 px-3 text-center">کد گروه</th>
                  <th className="py-2.5 px-3 text-center">ظرفیت</th>
                  <th className="py-2.5 px-3 text-center">نیمسال</th>
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
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
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
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                          {off.professorName ? off.professorName.charAt(0) : "؟"}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{off.professorName}</div>
                          <div className="text-[10px] text-muted-foreground">{off.professorTitle}</div>
                        </div>
                      </div>
                    </td>

                    {/* Group */}
                    <td className="py-2.5 px-3 text-center font-mono font-bold">
                      <Badge variant="secondary" className="font-mono text-xs px-2">
                        گروه {off.groupCode || "01"}
                      </Badge>
                    </td>

                    {/* Capacity */}
                    <td className="py-2.5 px-3 text-center font-mono">
                      <span className="text-muted-foreground">{off.capacity || 40} نفر</span>
                    </td>

                    {/* Term */}
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {off.term || "1403-1"}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleDeleteOffering(off.id, `${off.courseName} (${off.professorName})`)
                        }
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}

                {filteredOfferings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                      {loading ? "در حال دریافت ارائه‌ها..." : "هیچ ارائه‌ای با این مشخصات یافت نشد."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              تعریف ارائه درس جدید
            </DialogTitle>
            <DialogDescription className="text-xs">
              یک درس را به یک استاد اختصاص دهید تا گروه درسی در این نیمسال شکل گیرد.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateOffering} className="space-y-3.5 pt-2">
            {/* Course Select */}
            <div className="space-y-1.5">
              <Label className="text-xs">انتخاب درس:</Label>
              <Select
                items={courseOptions}
                value={form.courseId}
                onValueChange={(val) => val && setForm({ ...form, courseId: val })}
              >
                <SelectTrigger size="sm" className="w-full text-xs">
                  <SelectValue placeholder="-- انتخاب درس --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {courseOptions.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Professor Select */}
            <div className="space-y-1.5">
              <Label className="text-xs">استاد مدرس:</Label>
              <Select
                items={professorOptions}
                value={form.professorId}
                onValueChange={(val) => val && setForm({ ...form, professorId: val })}
              >
                <SelectTrigger size="sm" className="w-full text-xs">
                  <SelectValue placeholder="-- انتخاب استاد --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {professorOptions.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Group Code & Capacity */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">کد گروه:</Label>
                <Input
                  value={form.groupCode}
                  onChange={(e) => setForm({ ...form, groupCode: e.target.value })}
                  placeholder="01"
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">ظرفیت کلاس (نفر):</Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 40 })}
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>
            </div>

            {/* Term */}
            <div className="space-y-1.5">
              <Label className="text-xs">نیمسال تحصیلی:</Label>
              <Input
                value={form.term}
                onChange={(e) => setForm({ ...form, term: e.target.value })}
                placeholder="1403-1"
                className="h-8 text-xs font-mono"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !form.courseId || !form.professorId}
                className="w-full h-8 text-xs font-semibold"
              >
                {isSubmitting ? "در حال ثبت..." : "ثبت ارائه درس"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
