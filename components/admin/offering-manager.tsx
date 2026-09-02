"use client";

import React, { useState, useEffect, useMemo } from "react";
import type { Course, Professor, CourseOffering, Faculty, OfferingResource, OfferingResourceType } from "@/lib/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OfferingImportDialog } from "@/components/offerings/offering-import-dialog";
import { Download, Upload, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  X,
  CheckCircle2,
  CalendarCheck,
  FolderArchive,
  Video,
  FileText,
  ExternalLink,
  Link2,
  Loader2,
} from "lucide-react";

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
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [editingOffering, setEditingOffering] = useState<CourseOffering | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Professor filter search inside modal
  const [modalProfSearch, setModalProfSearch] = useState("");

  const currentFaculty = faculties.find((f) => f.id === selectedFacultyId);

  // Form State: Course + Multiple Professors + Description + Finalized Semesters
  const [form, setForm] = useState<{
    code: string;
    courseId: string;
    description: string;
    professorIds: string[];
    finalizedSemesters: string[];
  }>({
    code: "",
    courseId: "",
    description: "",
    professorIds: [],
    finalizedSemesters: [],
  });

  const [newSemYear, setNewSemYear] = useState("1404");
  const [newSemType, setNewSemType] = useState("2");

  // Resources Modal State
  const [resourcesOffering, setResourcesOffering] = useState<CourseOffering | null>(null);
  const [resources, setResources] = useState<OfferingResource[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [resTitle, setResTitle] = useState("");
  const [resType, setResType] = useState<OfferingResourceType>("slide");
  const [resHasTerm, setResHasTerm] = useState(false);
  const [resTermYear, setResTermYear] = useState("1404");
  const [resTermType, setResTermType] = useState("2");
  const [resUrl, setResUrl] = useState("");
  const [savingResource, setSavingResource] = useState(false);
  const [resourceError, setResourceError] = useState<string | null>(null);

  const loadResources = async (offeringId: string) => {
    try {
      setLoadingResources(true);
      const res = await fetch(`/api/offerings/resources?offeringId=${offeringId}`).then((r) => r.json());
      if (res.success) {
        setResources(res.data);
      }
    } catch (err) {
      console.error("Failed to load resources:", err);
    } finally {
      setLoadingResources(false);
    }
  };

  const handleOpenResourcesModal = (off: CourseOffering) => {
    setResourcesOffering(off);
    setEditingResourceId(null);
    setResTitle("");
    setResType("slide");
    setResHasTerm(false);
    setResTermYear("1404");
    setResTermType("2");
    setResUrl("");
    setResourceError(null);
    loadResources(off.id);
  };

  const handleStartEditResource = (item: OfferingResource) => {
    setEditingResourceId(item.id);
    setResTitle(item.title);
    setResType(item.type);
    if (item.term && item.term.includes("-")) {
      const [y, t] = item.term.split("-");
      setResHasTerm(true);
      setResTermYear(y || "1404");
      setResTermType(t || "2");
    } else {
      setResHasTerm(false);
      setResTermYear("1404");
      setResTermType("2");
    }
    setResUrl(item.url);
    setResourceError(null);
  };

  const handleCancelEditResource = () => {
    setEditingResourceId(null);
    setResTitle("");
    setResType("slide");
    setResHasTerm(false);
    setResTermYear("1404");
    setResTermType("2");
    setResUrl("");
    setResourceError(null);
  };

  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourcesOffering) return;
    if (!resTitle.trim() || !resUrl.trim()) {
      setResourceError("نام منبع و آدرس لینک الزامی است.");
      return;
    }

    try {
      setSavingResource(true);
      setResourceError(null);
      const term = resHasTerm ? `${resTermYear}-${resTermType}` : undefined;

      if (editingResourceId) {
        const res = await fetch("/api/offerings/resources", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingResourceId,
            title: resTitle.trim(),
            term,
            type: resType,
            url: resUrl.trim(),
          }),
        }).then((r) => r.json());

        if (res.success) {
          handleCancelEditResource();
          await loadResources(resourcesOffering.id);
        } else {
          setResourceError(res.message || "خطا در ویرایش منبع");
        }
      } else {
        const res = await fetch("/api/offerings/resources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offeringId: resourcesOffering.id,
            title: resTitle.trim(),
            term,
            type: resType,
            url: resUrl.trim(),
          }),
        }).then((r) => r.json());

        if (res.success) {
          handleCancelEditResource();
          await loadResources(resourcesOffering.id);
        } else {
          setResourceError(res.message || "خطا در ثبت منبع");
        }
      }
    } catch (err) {
      console.error("Save resource error:", err);
      setResourceError("خطا در برقراری ارتباط با سرور.");
    } finally {
      setSavingResource(false);
    }
  };

  const handleDeleteResource = async (id: string, title: string) => {
    if (!confirm(`آیا از حذف منبع «${title}» اطمینان دارید؟`)) return;
    try {
      const res = await fetch(`/api/offerings/resources?id=${id}`, {
        method: "DELETE",
      }).then((r) => r.json());

      if (res.success && resourcesOffering) {
        await loadResources(resourcesOffering.id);
      } else {
        alert(res.message || "خطا در حذف منبع");
      }
    } catch (err) {
      console.error("Delete resource error:", err);
      alert("خطا در برقراری ارتباط با سرور");
    }
  };

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
    setModalProfSearch("");
    setNewSemYear("1404");
    setNewSemType("2");
    setForm({
      code: "",
      courseId: courses[0]?.id || "",
      description: "",
      professorIds: professors[0] ? [professors[0].id] : [],
      finalizedSemesters: [],
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (off: CourseOffering) => {
    setEditingOffering(off);
    setModalProfSearch("");
    setNewSemYear("1404");
    setNewSemType("2");
    const pIds =
      off.professors && off.professors.length > 0
        ? off.professors.map((p) => p.id)
        : off.professorId
        ? [off.professorId]
        : [];

    setForm({
      code: off.code || "",
      courseId: off.courseId,
      description: off.description || "",
      professorIds: pIds,
      finalizedSemesters: off.finalizedSemesters || [],
    });
    setIsModalOpen(true);
  };

  const handleToggleProfessor = (profId: string) => {
    setForm((prev) => {
      const exists = prev.professorIds.includes(profId);
      if (exists) {
        return {
          ...prev,
          professorIds: prev.professorIds.filter((id) => id !== profId),
        };
      } else {
        return {
          ...prev,
          professorIds: [...prev.professorIds, profId],
        };
      }
    });
  };

  const handleRemoveProfessor = (profId: string) => {
    setForm((prev) => ({
      ...prev,
      professorIds: prev.professorIds.filter((id) => id !== profId),
    }));
  };

  const handleSetPrimaryProfessor = (profId: string) => {
    setForm((prev) => {
      const otherIds = prev.professorIds.filter((id) => id !== profId);
      return {
        ...prev,
        professorIds: [profId, ...otherIds],
      };
    });
  };

  const handleAddFinalizedSemester = () => {
    const code = `${newSemYear}-${newSemType}`;
    if (!form.finalizedSemesters.includes(code)) {
      setForm((prev) => ({
        ...prev,
        finalizedSemesters: [...prev.finalizedSemesters, code].sort(),
      }));
    }
  };

  const handleRemoveFinalizedSemester = (code: string) => {
    setForm((prev) => ({
      ...prev,
      finalizedSemesters: prev.finalizedSemesters.filter((c) => c !== code),
    }));
  };

  const handleToggleFinalizedSemester = (code: string) => {
    setForm((prev) => {
      const exists = prev.finalizedSemesters.includes(code);
      if (exists) {
        return {
          ...prev,
          finalizedSemesters: prev.finalizedSemesters.filter((c) => c !== code),
        };
      } else {
        return {
          ...prev,
          finalizedSemesters: [...prev.finalizedSemesters, code].sort(),
        };
      }
    });
  };

  const handleSaveOffering = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.courseId || form.professorIds.length === 0) {
      alert("لطفاً درس و حداقل یک استاد مدرس را انتخاب کنید.");
      return;
    }

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

  const handleExportJson = async () => {
    try {
      setIsExporting(true);
      const url = selectedFacultyId
        ? `/api/offerings/export?facultyId=${selectedFacultyId}`
        : "/api/offerings/export";
      const res = await fetch(url).then((r) => r.json());
      if (res.success && Array.isArray(res.data)) {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], {
          type: "application/json",
        });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `offerings-export-${
          currentFaculty ? currentFaculty.code : "all"
        }-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } else {
        alert("خطا در دریافت خروجی ارائه‌ها: " + (res.message || "پاسخ نامعتبر"));
      }
    } catch (err) {
      console.error("Export offerings error:", err);
      alert("خطا در برقراری ارتباط با سرور");
    } finally {
      setIsExporting(false);
    }
  };

  const filteredOfferings = useMemo(() => {
    return offerings.filter((o) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const cName = (o.courseName || "").toLowerCase();
      const cCode = (o.courseCode || "").toLowerCase();
      const pName = (o.professorName || "").toLowerCase();
      const offCode = (o.code || "").toLowerCase();
      return (
        cName.includes(q) ||
        cCode.includes(q) ||
        pName.includes(q) ||
        offCode.includes(q)
      );
    });
  }, [offerings, search]);

  const filteredModalProfessors = useMemo(() => {
    const q = modalProfSearch.trim().toLowerCase();
    if (!q) return professors;
    return professors.filter((p) => {
      const name = (p.name || "").toLowerCase();
      const code = (p.code || "").toLowerCase();
      const title = (p.title || "").toLowerCase();
      return name.includes(q) || code.includes(q) || title.includes(q);
    });
  }, [professors, modalProfSearch]);

  const selectedProfessorsList = useMemo(() => {
    return form.professorIds
      .map((id) => professors.find((p) => p.id === id))
      .filter(Boolean) as Professor[];
  }, [form.professorIds, professors]);

  return (
    <div className="space-y-6">
      {/* Faculty Selection Banner */}
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
                ارائه‌های درسی می‌توانند به یک یا چند استاد هم‌تدریس اختصاص داده شوند (موجودیت پایه برای نظرسنجی و برنامه‌ریزی هفتگی).
              </p>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-border/70 shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BookUser className="h-4 w-4 text-primary" />
              <span>ارائه‌های درسی {currentFaculty ? `«${currentFaculty.name}»` : ""}</span>
            </CardTitle>
            <CardDescription className="text-xs">
              تعریف اینکه چه اساتیدی چه درسی را تدریس می‌کنند (پشتیبانی از ارائه‌های تک‌استادی و چنداستادی / Co-Teaching)
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportJson}
              disabled={isExporting}
              className="h-8 gap-1.5 text-xs shadow-2xs"
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              <span>خروجی ارائه‌ها (Export JSON)</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImportModalOpen(true)}
              className="h-8 gap-1.5 text-xs shadow-2xs font-semibold"
            >
              <Upload className="h-3.5 w-3.5 text-primary" />
              <span>ورود دسته‌ای (Import JSON)</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!selectedFacultyId) return;
                if (
                  confirm(
                    `هشدار: آیا از حذف کلیه ارائه‌های درسی دانشکده «${
                      currentFaculty?.name || ""
                    }» مطمئن هستید؟ ارائه‌ها به صورت موقت (Soft Delete) حذف می‌شوند و با ثبت مجدد کدهای مشابه یا ویرایش بازگردانده خواهند شد.`
                  )
                ) {
                  const res = await fetch(`/api/offerings?all=true&facultyId=${selectedFacultyId}`, {
                    method: "DELETE",
                  }).then((r) => r.json());
                  if (res.success) {
                    await loadOfferings();
                  } else {
                    alert(res.message || "خطا در حذف ارائه‌ها");
                  }
                }
              }}
              disabled={!selectedFacultyId || offerings.length === 0}
              className="h-8 gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 shadow-2xs font-medium"
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
              <span>حذف همه ارائه‌ها</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleOpenCreateModal}
              disabled={!selectedFacultyId}
              className="h-8 gap-1.5 text-xs shadow-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              تعریف ارائه جدید
            </Button>
          </div>
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
                  <th className="py-2.5 px-3 text-right">استاد / اساتید مدرس</th>
                  <th className="py-2.5 px-3 text-center">کد ارائه</th>
                  <th className="py-2.5 px-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredOfferings.map((off) => {
                  const offeringProfs = off.professors && off.professors.length > 0
                    ? off.professors
                    : [{ id: off.professorId || "p1", name: off.professorName || "استاد درس", title: off.professorTitle, avatarUrl: off.professorAvatarUrl }];

                  return (
                    <tr key={off.id} className="hover:bg-muted/20 transition-colors">
                      {/* Course */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 font-bold text-xs shrink-0">
                            <BookOpen className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-foreground">{off.courseName}</span>
                              {off.courseAbbreviation && (
                                <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/5 px-1 py-0">
                                  {off.courseAbbreviation}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                              <span>{off.courseCode}</span>
                              <span>•</span>
                              <span>{off.courseUnits} واحد</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Professors (Multi-Professor Badges & Avatars) */}
                      <td className="py-2.5 px-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {offeringProfs.map((p, idx) => (
                              <div
                                key={p.id}
                                className="flex items-center gap-1.5 bg-muted/60 pl-1.5 pr-2 py-0.5 rounded-lg border border-border/70 text-xs shadow-2xs"
                              >
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[10px] overflow-hidden border border-border/60 shrink-0">
                                  {p.avatarUrl ? (
                                    <img src={p.avatarUrl} alt={p.name} className="h-full w-full object-cover" />
                                  ) : (
                                    <span>{p.name ? p.name.charAt(0) : "؟"}</span>
                                  )}
                                </div>
                                <span className="font-semibold text-foreground text-xs">{p.name}</span>
                                {offeringProfs.length > 1 && idx === 0 && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 text-primary border-primary/30 bg-primary/5">
                                    اصلی
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>

                      {/* Code */}
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant="outline" className="text-[10px]">
                          {off.code || off.id}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenResourcesModal(off)}
                            className="h-7 px-2 gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60"
                            title="مدیریت منابع درس"
                          >
                            <FolderArchive className="h-3.5 w-3.5" />
                            <span>منابع</span>
                          </Button>
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
                  );
                })}

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

      {/* Create / Edit Modal (2-Column Responsive Layout) */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              {editingOffering ? (
                <>
                  <Pencil className="h-4 w-4 text-primary" />
                  ویرایش اتصال درس به اساتید (ارائه)
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 text-primary" />
                  اتصال درس به اساتید (تعریف ارائه جدید)
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              درس و یک یا چند استاد ارائه‌دهنده را مشخص کنید (امکان تعریف چند استاد هم‌تدریس).
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
            {/* 2-Column Responsive Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {/* Column 1: Course Info & Finalized Semesters */}
              <div className="space-y-3.5">
                {/* Course Combobox */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">انتخاب درس:</Label>
                  <Combobox
                    items={courses.map((c) => ({
                      value: c.id,
                      label: c.name,
                      badge: c.code,
                      sublabel: `${c.units} واحد`,
                      keywords: [c.name, c.code, c.abbreviation || ""],
                    }))}
                    value={form.courseId}
                    onChange={(val) => setForm({ ...form, courseId: val })}
                    placeholder="-- انتخاب یا جستجوی درس --"
                    searchPlaceholder="جستجوی نام یا کد درس..."
                    className="w-full"
                  />
                </div>

                {/* Offering Code (Optional) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">کد ارائه:</Label>
                    <span className="text-[10px] text-muted-foreground">اختیاری (تولید خودکار در صورت خالی بودن)</span>
                  </div>
                  <Input
                    placeholder="مثلاً OFF-101 یا 8101234-01"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    className="h-8 text-xs"
                    dir="ltr"
                  />
                </div>

                {/* Offering Description Textarea (Optional) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">توضیحات ارائه:</Label>
                    <span className="text-[10px] text-muted-foreground">اختیاری (نکات، منابع و ...)</span>
                  </div>
                  <Textarea
                    placeholder="توضیحات خاص این ارائه، منابع درسی، کارگاه‌های عملی، پیش‌نیازهای مهارتی و ..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    className="text-xs resize-none"
                  />
                </div>

                {/* Finalized Semesters Manager */}
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <CalendarCheck className="h-3.5 w-3.5 text-primary" />
                      <span>نیمسال‌های نهایی‌شده ثبت رویدادها:</span>
                    </Label>
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/5 shrink-0">
                      {form.finalizedSemesters.length} نیمسال
                    </Badge>
                  </div>

                  {/* Selected Semesters Chips */}
                  {form.finalizedSemesters.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-muted/40 border border-border/60 max-h-24 overflow-y-auto">
                      {form.finalizedSemesters.map((semCode) => (
                        <div
                          key={semCode}
                          className="flex items-center gap-1.5 bg-background px-2 py-1 rounded-lg border border-border/80 text-xs shadow-2xs"
                        >
                          <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                          <span className="font-semibold text-foreground">
                            {formatSemesterLabel(semCode)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFinalizedSemester(semCode)}
                            className="text-muted-foreground hover:text-destructive p-0.5 rounded-full transition-colors mr-0.5"
                            title="حذف نیمسال"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2 rounded-xl border border-dashed text-center text-xs text-muted-foreground bg-muted/20">
                      هنوز نیمسالی ثبت نشده است.
                    </div>
                  )}

                  {/* Add New Semester Container */}
                  <div className="p-2 rounded-xl bg-card border border-border/70 flex items-center justify-between gap-2">
                    {/* Inputs container on the right */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {/* Year NumberInput */}
                      <NumberInput
                        min={1350}
                        max={1499}
                        value={newSemYear}
                        onChange={(val) => setNewSemYear(String(val))}
                        placeholder="سال"
                        className="w-28 shrink-0"
                      />

                      {/* Term Type Select */}
                      <div className="flex-1 min-w-0">
                        <Select value={newSemType} onValueChange={setNewSemType}>
                          <SelectTrigger className="w-full text-xs">
                            <SelectValue placeholder="نوع نیمسال" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="1" className="text-xs">پاییز (نیمسال اول)</SelectItem>
                              <SelectItem value="2" className="text-xs">بهار (نیمسال دوم)</SelectItem>
                              <SelectItem value="3" className="text-xs">تابستان</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Add Button */}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleAddFinalizedSemester}
                      className="text-xs font-semibold gap-1 shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      افزودن
                    </Button>
                  </div>
                </div>
              </div>

              {/* Column 2: Multi-Professors Selection */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    اساتید مدرس (امکان انتخاب چند استاد):
                  </Label>
                  <span className="text-xs text-primary font-semibold">
                    {form.professorIds.length} استاد انتخاب‌شده
                  </span>
                </div>

                {/* Selected Professors Chips */}
                {selectedProfessorsList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-muted/40 border border-border/60 max-h-28 overflow-y-auto">
                    {selectedProfessorsList.map((p, idx) => {
                      const isPrimary = idx === 0;
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            if (!isPrimary) handleSetPrimaryProfessor(p.id);
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs shadow-2xs transition-all select-none ${
                            isPrimary
                              ? "bg-primary/10 border-primary/50 text-primary font-bold ring-1 ring-primary/30 cursor-default"
                              : "bg-background border-border/80 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                          }`}
                          title={
                            isPrimary
                              ? "استاد اصلی این ارائه"
                              : "کلیک کنید تا به عنوان استاد اصلی تعیین شود"
                          }
                        >
                          <span className="font-semibold text-foreground">{p.name}</span>
                          {isPrimary && (
                            <span className="text-[10px] text-primary font-bold">(اصلی)</span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveProfessor(p.id);
                            }}
                            className="text-muted-foreground hover:text-destructive p-0.5 rounded-full mr-0.5"
                            title="حذف از ارائه"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Search Professor Inside Modal */}
                <div className="relative">
                  <Input
                    placeholder="جستجوی سریع در لیست اساتید..."
                    value={modalProfSearch}
                    onChange={(e) => setModalProfSearch(e.target.value)}
                    className="h-8 text-xs pr-8"
                  />
                  <Search className="pointer-events-none absolute right-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                </div>

                {/* Professors List with Checkbox */}
                <div className="max-h-72 overflow-y-auto rounded-xl border border-border/70 divide-y divide-border/40 bg-card">
                  {filteredModalProfessors.map((p) => {
                    const isSelected = form.professorIds.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleToggleProfessor(p.id)}
                        className={`flex items-center justify-between p-2.5 cursor-pointer transition-colors ${
                          isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleProfessor(p.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[10px] overflow-hidden shrink-0 border border-border/60">
                            {p.avatarUrl ? (
                              <img src={p.avatarUrl} alt={p.name} className="h-full w-full object-cover" />
                            ) : (
                              <span>{p.name ? p.name.charAt(0) : "؟"}</span>
                            )}
                          </div>
                          <div className="truncate">
                            <span className="font-semibold text-xs text-foreground block truncate">
                              {p.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground block truncate">
                              {[p.title, p.code].filter(Boolean).join(" • ") || "عضو هیئت علمی"}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/5 shrink-0">
                            انتخاب‌شده
                          </Badge>
                        )}
                      </div>
                    );
                  })}

                  {filteredModalProfessors.length === 0 && (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                      استادی با این مشخصات یافت نشد.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !form.courseId || form.professorIds.length === 0}
                className="w-full font-semibold"
              >
                {isSubmitting
                  ? "در حال ثبت..."
                  : editingOffering
                  ? "ذخیره تغییرات ارائه"
                  : "ثبت ارائه"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Resources Management Dialog */}
      <Dialog
        open={Boolean(resourcesOffering)}
        onOpenChange={(open) => {
          if (!open) {
            setResourcesOffering(null);
            handleCancelEditResource();
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FolderArchive className="h-4 w-4 text-primary" />
              <span>مدیریت منابع درسی ارائه</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {resourcesOffering ? (
                <span>
                  {resourcesOffering.courseName} ({resourcesOffering.professorName})
                </span>
              ) : (
                "مشاهده، افزودن، ویرایش و حذف منابع و جزوات آموزشی"
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Form to Add / Edit Resource */}
          <form
            onSubmit={handleSaveResource}
            className="p-3.5 rounded-2xl border border-border/80 bg-muted/20 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                {editingResourceId ? (
                  <>
                    <Pencil className="h-3.5 w-3.5 text-primary" />
                    <span>ویرایش منبع</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5 text-primary" />
                    <span>افزودن منبع جدید</span>
                  </>
                )}
              </span>
              {editingResourceId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEditResource}
                  className="h-6 text-[10px] px-2 text-muted-foreground"
                >
                  انصراف از ویرایش
                </Button>
              )}
            </div>

            {resourceError && (
              <div className="p-2 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20">
                {resourceError}
              </div>
            )}

            <div className="space-y-3">
              {/* Row 1: Title & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-xs font-semibold">نام منبع:</Label>
                  <Input
                    placeholder="مثلاً: اسلایدهای فصل ۱ تا ۵، فیلم ضبط‌شده کلاس و ..."
                    value={resTitle}
                    onChange={(e) => setResTitle(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">نوع منبع:</Label>
                  <Select
                    value={resType}
                    onValueChange={(val: OfferingResourceType) => setResType(val)}
                  >
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder="نوع منبع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="slide" className="text-xs">
                          اسلاید / جزوه
                        </SelectItem>
                        <SelectItem value="video" className="text-xs">
                          ویدئو کلاسی
                        </SelectItem>
                        <SelectItem value="archive" className="text-xs">
                          آرشیو / فایل
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Term & URL */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-xs font-semibold">لینک منبع (URL):</Label>
                  <Input
                    placeholder="https://example.com/..."
                    value={resUrl}
                    onChange={(e) => setResUrl(e.target.value)}
                    className="h-8 text-xs"
                    dir="ltr"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">نیمسال مربوطه:</Label>
                    <button
                      type="button"
                      onClick={() => setResHasTerm(!resHasTerm)}
                      className="text-[10px] text-primary hover:underline"
                    >
                      {resHasTerm ? "حذف نیمسال" : "تعیین نیمسال"}
                    </button>
                  </div>
                  {resHasTerm ? (
                    <div className="flex items-center gap-1.5">
                      <NumberInput
                        min={1350}
                        max={1499}
                        value={resTermYear}
                        onChange={(val) => setResTermYear(String(val))}
                        placeholder="سال"
                        className="w-20 shrink-0 h-8"
                      />
                      <Select value={resTermType} onValueChange={setResTermType}>
                        <SelectTrigger className="w-full h-8 text-xs">
                          <SelectValue placeholder="نیمسال" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="1" className="text-xs">
                              پاییز
                            </SelectItem>
                            <SelectItem value="2" className="text-xs">
                              بهار
                            </SelectItem>
                            <SelectItem value="3" className="text-xs">
                              تابستان
                            </SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="h-8 rounded-md border border-border/60 bg-muted/40 px-2.5 flex items-center text-[11px] text-muted-foreground">
                      عمومی / بدون نیمسال خاص
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                size="sm"
                disabled={savingResource}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                {savingResource ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : editingResourceId ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                <span>{editingResourceId ? "ذخیره تغییرات" : "افزودن منبع"}</span>
              </Button>
            </div>
          </form>

          {/* List of Registered Resources */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                منابع ثبت‌شده ({resources.length})
              </span>
            </div>

            {loadingResources ? (
              <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>در حال بارگذاری منابع...</span>
              </div>
            ) : resources.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                {resources.map((item) => {
                  const typeLabel =
                    item.type === "video"
                      ? "ویدئو"
                      : item.type === "slide"
                      ? "اسلاید"
                      : "آرشیو";

                  return (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl border border-border/70 bg-card hover:bg-muted/20 transition-colors flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground font-semibold text-xs shrink-0 border border-border/60">
                          {item.type === "video" ? (
                            <Video className="h-3.5 w-3.5" />
                          ) : item.type === "slide" ? (
                            <FileText className="h-3.5 w-3.5" />
                          ) : (
                            <FolderArchive className="h-3.5 w-3.5" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-foreground truncate">
                              {item.title}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 bg-muted/50 border-border text-foreground font-normal shrink-0"
                            >
                              {typeLabel}
                            </Badge>
                            {item.term && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 shrink-0 font-normal"
                              >
                                {formatSemesterLabel(item.term)}
                              </Badge>
                            )}
                          </div>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-primary hover:underline truncate block mt-0.5"
                            dir="ltr"
                          >
                            {item.url}
                          </a>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="مشاهده لینک"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartEditResource(item)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          title="ویرایش منبع"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteResource(item.id, item.title)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          title="حذف منبع"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl bg-muted/10">
                هنوز منبع آموزشی برای این ارائه ثبت نشده است.
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResourcesOffering(null)}
              className="w-full text-xs font-semibold"
            >
              بستن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Offering Import Dialog */}
      <OfferingImportDialog
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        defaultFacultyId={selectedFacultyId}
        targetFaculty={currentFaculty}
        onSuccess={loadOfferings}
      />
    </div>
  );
}
