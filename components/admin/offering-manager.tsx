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
  Plus,
  Trash2,
  Search,
  BookOpen,
  Users,
  Layers,
  Sparkles,
} from "lucide-react";

interface OfferingManagerProps {
  courses: Course[];
  professors: Professor[];
}

export function OfferingManager({ courses, professors }: OfferingManagerProps) {
  const [offerings, setOfferings] = useState<CourseOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State: Only Course + Professor
  const [form, setForm] = useState({
    courseId: "",
    professorId: "",
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
              <span>ارائه‌های درسی (اتصال درس به استاد)</span>
            </CardTitle>
            <CardDescription className="text-xs">
              تعریف اینکه چه استادی چه درسی را تدریس می‌کند (موجودیت پایه جهت تفکیک نظرات دانشجویان و برنامه‌ریزی کلاسی)
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setForm({
                courseId: courses[0]?.id || "",
                professorId: professors[0]?.id || "",
              });
              setIsCreateModalOpen(true);
            }}
            className="h-8 gap-1.5 text-xs shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            تعریف اتصال درس و استاد
          </Button>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
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
              مجموع ارائه‌ها: <span className="font-bold text-foreground font-mono">{filteredOfferings.length}</span>
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
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {off.id}
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

      {/* Create Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              اتصال درس به استاد (تعریف ارائه)
            </DialogTitle>
            <DialogDescription className="text-xs">
              یک درس را به یک استاد متصل کنید تا به عنوان ارائه‌دهنده این درس در سامانه شناخته شود.
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

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !form.courseId || !form.professorId}
                className="w-full h-8 text-xs font-semibold"
              >
                {isSubmitting ? "در حال ثبت..." : "ثبت اتصال ارائه"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
