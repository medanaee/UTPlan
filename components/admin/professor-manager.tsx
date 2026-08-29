"use client";

import React, { useState } from "react";
import type { Professor, Faculty } from "@/lib/types";
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
  Pencil,
  Trash2,
  Search,
  Users,
  Camera,
  Upload,
  RefreshCw,
  Mail,
  Building2,
} from "lucide-react";

interface ProfessorManagerProps {
  professors: Professor[];
  faculties: Faculty[];
  selectedFacultyId: string;
  onDataChanged: () => Promise<void>;
}

export function ProfessorManager({
  professors,
  faculties,
  selectedFacultyId,
  onDataChanged,
}: ProfessorManagerProps) {
  const [search, setSearch] = useState("");
  const [facultyFilter, setFacultyFilter] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfessor, setEditingProfessor] = useState<Professor | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState({
    name: "",
    title: "استاد تمام",
    email: "",
    avatarUrl: "",
    facultyId: selectedFacultyId || faculties[0]?.id || "",
  });

  const handleOpenCreateModal = () => {
    setEditingProfessor(null);
    setForm({
      name: "",
      title: "استاد تمام",
      email: "",
      avatarUrl: "",
      facultyId: selectedFacultyId || faculties[0]?.id || "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (prof: Professor) => {
    setEditingProfessor(prof);
    setForm({
      name: prof.name,
      title: prof.title || "استاد تمام",
      email: prof.email || "",
      avatarUrl: prof.avatarUrl || "",
      facultyId: prof.facultyId || selectedFacultyId || faculties[0]?.id || "",
    });
    setIsModalOpen(true);
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      }).then((r) => r.json());

      if (res.success && res.url) {
        setForm((prev) => ({ ...prev, avatarUrl: res.url }));
      } else {
        alert(res.message || "خطا در آپلود تصویر");
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("خطا در برقراری ارتباط با سرور آپلود");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingProfessor) {
        // Edit existing
        const res = await fetch("/api/professors", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingProfessor.id,
            ...form,
          }),
        }).then((r) => r.json());

        if (res.success) {
          setIsModalOpen(false);
          await onDataChanged();
        } else {
          alert(res.message || "خطا در ویرایش اطلاعات استاد");
        }
      } else {
        // Create new
        const res = await fetch("/api/professors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }).then((r) => r.json());

        if (res.success) {
          setIsModalOpen(false);
          await onDataChanged();
        } else {
          alert(res.message || "خطا در ثبت استاد جدید");
        }
      }
    } catch (err) {
      console.error("Save professor error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (prof: Professor) => {
    if (!confirm(`آیا از حذف "${prof.name}" مطمئن هستید؟`)) return;

    try {
      const res = await fetch(`/api/professors?id=${prof.id}`, {
        method: "DELETE",
      }).then((r) => r.json());

      if (res.success) {
        await onDataChanged();
      }
    } catch (err) {
      console.error("Delete professor error:", err);
    }
  };

  const currentFaculty = faculties.find((f) => f.id === selectedFacultyId);

  const facultyProfessors = professors.filter(
    (p) => !selectedFacultyId || p.facultyId === selectedFacultyId
  );

  const filteredProfessors = facultyProfessors.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.title || "").toLowerCase().includes(search.toLowerCase());

    return matchesSearch;
  });

  const modalFacultyOptions = faculties.map((f) => ({
    value: f.id,
    label: f.name,
  }));

  const rankOptions = [
    { value: "استاد تمام", label: "استاد تمام" },
    { value: "دانشیار", label: "دانشیار" },
    { value: "استادیار", label: "استادیار" },
    { value: "مربی", label: "مربی" },
  ];

  return (
    <div className="space-y-4">
      {/* Standard Active Faculty Header Banner */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/10 via-primary/5 to-card p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20 shrink-0">
              <Users className="h-5 w-5" />
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
                فقط اساتید و اعضای هیئت علمی این دانشکده نمایش داده می‌شوند و استاد جدید نیز به این دانشکده منتسب می‌شود.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-border/70 shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span>لیست اساتید و اعضای هیئت علمی</span>
            </CardTitle>
            <CardDescription className="text-xs">
              مدیریت، ویرایش و آپلود تصاویر اساتید جهت انتساب به ارائه‌های درسی و ارزشیابی دانشجویان
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={handleOpenCreateModal}
            className="h-8 gap-1.5 text-xs shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            افزودن استاد جدید
          </Button>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Input
                  placeholder="جستجوی نام، مرتبه علمی یا ایمیل استاد..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 w-64 text-xs pr-8"
                />
                <Search className="pointer-events-none absolute right-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              مجموع اساتید: <span className="font-bold text-foreground">{filteredProfessors.length}</span>
            </div>
          </div>

          {/* Professors Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProfessors.map((p) => {
              const faculty = faculties.find((f) => f.id === p.facultyId);
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs overflow-hidden border border-border/70 shadow-2xs">
                      {p.avatarUrl ? (
                        <img
                          src={p.avatarUrl}
                          alt={p.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{p.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-bold truncate text-foreground">{p.name}</p>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>{p.title || "استاد تمام"}</span>
                        {faculty && (
                          <>
                            <span>•</span>
                            <span className="truncate text-[10px] opacity-80">{faculty.name}</span>
                          </>
                        )}
                      </div>
                      {p.email && (
                        <p className="text-[10px] text-muted-foreground/80 truncate dir-ltr text-right">
                          {p.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions (Edit + Delete) */}
                  <div className="flex items-center gap-1 shrink-0 mr-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEditModal(p)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                      title="ویرایش استاد"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(p)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      title="حذف استاد"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {filteredProfessors.length === 0 && (
              <div className="col-span-full py-10 text-center text-xs text-muted-foreground">
                استادی با این مشخصات یافت نشد.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit Professor Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              {editingProfessor ? (
                <>
                  <Pencil className="h-4 w-4 text-primary" />
                  ویرایش اطلاعات استاد
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 text-primary" />
                  افزودن استاد جدید
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              اطلاعات استاد و تصویر پرسنلی (آپلود خودکار در Cloudflare) را وارد یا ویرایش نمایید.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
            {/* Photo Upload Area */}
            <div className="flex items-center gap-3.5 p-3 rounded-xl border border-border/70 bg-muted/15">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background overflow-hidden shadow-2xs">
                {form.avatarUrl ? (
                  <img
                    src={form.avatarUrl}
                    alt="پیش‌نمایش تصویر"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Camera className="h-6 w-6 text-muted-foreground/60" />
                )}
                {uploadingImage && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                  </div>
                )}
              </div>

              <div className="space-y-1.5 flex-1">
                <Label className="text-xs font-semibold">تصویر پرسنلی استاد (Cloudflare):</Label>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadImage}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors shadow-2xs">
                      <Upload className="h-3 w-3" />
                      {uploadingImage ? "در حال آپلود..." : "انتخاب و آپلود عکس"}
                    </span>
                  </label>
                  {form.avatarUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm({ ...form, avatarUrl: "" })}
                      className="h-7 text-xs text-muted-foreground hover:text-destructive px-2"
                    >
                      حذف عکس
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">نام و نام خانوادگی استاد:</Label>
              <Input
                required
                placeholder="مثلاً دکتر علی محمدی"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            {/* Faculty & Rank (2 columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Faculty */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">دانشکده:</Label>
                <Select
                  items={modalFacultyOptions}
                  value={form.facultyId}
                  onValueChange={(val) => val && setForm({ ...form, facultyId: val })}
                >
                  <SelectTrigger size="sm" className="w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {modalFacultyOptions.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {/* Title / Rank */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">مرتبه علمی:</Label>
                <Select
                  items={rankOptions}
                  value={form.title}
                  onValueChange={(val) => val && setForm({ ...form, title: val })}
                >
                  <SelectTrigger size="sm" className="w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {rankOptions.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ایمیل دانشگاهی (اختیاری):</Label>
              <Input
                type="email"
                placeholder="mohammadi@ut.ac.ir"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-8 text-xs"
                dir="ltr"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || uploadingImage || !form.name.trim()}
                className="w-full h-8 text-xs font-semibold"
              >
                {isSubmitting
                  ? "در حال ذخیره..."
                  : editingProfessor
                  ? "ذخیره تغییرات استاد"
                  : "ثبت استاد جدید"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
