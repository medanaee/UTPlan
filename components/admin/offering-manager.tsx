"use client";

import React, { useState, useEffect, useMemo } from "react";
import type { Course, Professor, CourseOffering, Faculty, OfferingResource, OfferingResourceType } from "@/lib/types";
import { fetchJson, postJson, putJson, deleteJson } from "@/lib/api-client";
import { useAdminStore } from "@/lib/stores/admin-store";
import { persianSearch } from "@/lib/search/persian-search";
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
  ChevronLeft,
  ChevronRight,
  AlertCircle,
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
  Lock,
  Loader2,
} from "lucide-react";

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
  const [offeringFormError, setOfferingFormError] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [editingOffering, setEditingOffering] = useState<CourseOffering | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Professor filter search inside modal
  const [modalProfSearch, setModalProfSearch] = useState("");
  const [unassignedSearch, setUnassignedSearch] = useState("");
  const [showAllUnassigned, setShowAllUnassigned] = useState(false);
  const unassignedScrollRef = React.useRef<HTMLDivElement>(null);

  const currentFaculty = faculties.find((f) => f.id === selectedFacultyId);
  const linkedFacultyIds = currentFaculty?.linkedFacultyIds || [];

  const availableCourses = React.useMemo(() => {
    if (!selectedFacultyId) return courses;
    return courses.filter(
      (c) => c.facultyId === selectedFacultyId || linkedFacultyIds.includes(c.facultyId)
    );
  }, [courses, selectedFacultyId, linkedFacultyIds]);

  const availableProfessors = React.useMemo(() => {
    if (!selectedFacultyId) return professors;
    return professors.filter(
      (p) => p.facultyId === selectedFacultyId || linkedFacultyIds.includes(p.facultyId)
    );
  }, [professors, selectedFacultyId, linkedFacultyIds]);

  // Set of course IDs that have at least one active offering
  const offeringCourseIds = React.useMemo(() => {
    const set = new Set<string>();
    for (const off of offerings) {
      if (off.courseId) {
        set.add(off.courseId);
      }
    }
    return set;
  }, [offerings]);

  // Courses that do not have any offering registered yet (only direct courses of selected faculty, excluding linked courses)
  const coursesWithoutOfferings = React.useMemo(() => {
    const directCourses = selectedFacultyId
      ? courses.filter((c) => c.facultyId === selectedFacultyId)
      : courses;
    return directCourses.filter((c) => !offeringCourseIds.has(c.id));
  }, [courses, selectedFacultyId, offeringCourseIds]);

  const filteredUnassignedCourses = React.useMemo(() => {
    if (!unassignedSearch.trim()) return coursesWithoutOfferings;
    return persianSearch(coursesWithoutOfferings, unassignedSearch);
  }, [coursesWithoutOfferings, unassignedSearch]);

  const displayedUnassignedCourses = React.useMemo(() => {
    if (unassignedSearch.trim()) return filteredUnassignedCourses;
    return showAllUnassigned
      ? filteredUnassignedCourses
      : filteredUnassignedCourses.slice(0, 10);
  }, [filteredUnassignedCourses, showAllUnassigned, unassignedSearch]);

  const handleScrollUnassigned = (direction: "left" | "right") => {
    if (unassignedScrollRef.current) {
      const delta = direction === "left" ? -260 : 260;
      unassignedScrollRef.current.scrollBy({ left: delta, behavior: "smooth" });
    }
  };

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
      const res = await fetchJson(`/api/offerings/resources?offeringId=${offeringId}`);
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
        const res = await putJson("/api/offerings/resources", {
          id: editingResourceId,
          title: resTitle.trim(),
          term,
          type: resType,
          url: resUrl.trim(),
        });

        if (res.success) {
          handleCancelEditResource();
          await loadResources(resourcesOffering.id);
        } else {
          setResourceError(res.message || "خطا در ویرایش منبع");
        }
      } else {
        const res = await postJson("/api/offerings/resources", {
          offeringId: resourcesOffering.id,
          title: resTitle.trim(),
          term,
          type: resType,
          url: resUrl.trim(),
        });

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
      const res = await deleteJson(`/api/offerings/resources?id=${id}`);

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
        ? `/api/offerings?facultyId=${selectedFacultyId}&all=true`
        : "/api/offerings?all=true";
      const res = await fetchJson(url);
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

  useEffect(() => {
    if (courses.length === 0) {
      fetchJson("/api/courses?all=true").then((res) => {
        if (res.success && Array.isArray(res.data)) {
          useAdminStore.getState().setCourses(res.data);
        }
      });
    }
    if (professors.length === 0) {
      fetchJson("/api/professors").then((res) => {
        if (res.success && Array.isArray(res.data)) {
          useAdminStore.getState().setProfessors(res.data);
        }
      });
    }
  }, [courses.length, professors.length]);

  const handleOpenCreateModal = (initialCourseId?: string) => {
    setEditingOffering(null);
    setOfferingFormError(null);
    setModalProfSearch("");
    setNewSemYear("1404");
    setNewSemType("2");
    setForm({
      code: "",
      courseId: initialCourseId || "",
      description: "",
      professorIds: [],
      finalizedSemesters: [],
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (off: CourseOffering) => {
    setEditingOffering(off);
    setOfferingFormError(null);
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
    setOfferingFormError(null);
    if (!form.courseId || form.professorIds.length === 0) {
      setOfferingFormError("لطفاً درس و حداقل یک استاد مدرس را انتخاب کنید.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingOffering) {
        const res = await putJson("/api/offerings", {
          id: editingOffering.id,
          ...form,
        });

        if (res.success) {
          setIsModalOpen(false);
          setOfferingFormError(null);
          await loadOfferings();
        } else {
          setOfferingFormError(res.message || "خطا در ویرایش ارائه");
        }
      } else {
        const res = await postJson("/api/offerings", form);

        if (res.success) {
          setIsModalOpen(false);
          setOfferingFormError(null);
          await loadOfferings();
        } else {
          setOfferingFormError(res.message || "خطا در ایجاد ارائه");
        }
      }
    } catch (err) {
      console.error("Save offering error:", err);
      setOfferingFormError("خطا در برقراری ارتباط با سرور");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOffering = async (id: string, name: string) => {
    if (!confirm(`آیا از حذف اتصال ارائه درس "${name}" مطمئن هستید؟`)) return;

    try {
      const res = await deleteJson(`/api/offerings?id=${id}`);
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
      const res = await fetchJson(url);
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
    if (!search.trim()) return offerings;
    const searchable = offerings.map((o) => {
      const profNames =
        o.professors && o.professors.length > 0
          ? o.professors.map((p) => p.name).join(" ")
          : o.professorName || "";
      return {
        ...o,
        name: `${o.courseName || ""} ${profNames}`.trim(),
        code: o.courseCode || o.code || "",
        abbreviation: o.courseAbbreviation || "",
        keywords: [
          o.code || "",
          o.courseCode || "",
          profNames,
          o.courseName || "",
          o.facultyName || "",
          o.description || "",
        ].filter(Boolean),
      };
    });
    return persianSearch(searchable, search);
  }, [offerings, search]);

  const filteredModalProfessors = useMemo(() => {
    if (!modalProfSearch.trim()) return availableProfessors;
    const searchable = availableProfessors.map((p) => ({
      ...p,
      name: p.name,
      code: p.code || "",
      abbreviation: p.title || "",
      keywords: [p.facultyName || "", p.title || "", p.code || ""].filter(Boolean),
    }));
    return persianSearch(searchable, modalProfSearch);
  }, [availableProfessors, modalProfSearch]);

  const selectedProfessorsList = useMemo(() => {
    return form.professorIds
      .map((id) => availableProfessors.find((p) => p.id === id) || professors.find((p) => p.id === id))
      .filter(Boolean) as Professor[];
  }, [form.professorIds, availableProfessors, professors]);

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

      {/* Courses Without Offerings Suggestion Card */}
      {!loading && coursesWithoutOfferings.length > 0 && (
        <Card className="border-border/70 bg-card shadow-2xs overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
                <BookOpen className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="text-xs font-semibold text-foreground">
                  دروس فاقد ارائه:
                </span>
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 font-bold bg-muted text-foreground border border-border/60"
                >
                  {unassignedSearch.trim()
                    ? `${filteredUnassignedCourses.length} از ${coursesWithoutOfferings.length} درس`
                    : `${coursesWithoutOfferings.length} درس`}
                </Badge>
                <span className="text-[10px] text-muted-foreground hidden lg:inline truncate">
                  (جهت تعریف سریع ارائه، روی درس کلیک کنید)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Search Bar with Persian search engine */}
              <div className="relative">
                <Input
                  placeholder="جستجوی درس..."
                  value={unassignedSearch}
                  onChange={(e) => setUnassignedSearch(e.target.value)}
                  className="h-7 w-32 sm:w-44 text-xs pr-7 pl-6 bg-background/80"
                />
                <Search className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                {unassignedSearch && (
                  <button
                    type="button"
                    onClick={() => setUnassignedSearch("")}
                    className="absolute left-1.5 top-1.5 p-0.5 text-muted-foreground hover:text-foreground rounded-full"
                    title="پاک کردن جستجو"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {!unassignedSearch.trim() && coursesWithoutOfferings.length > 10 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllUnassigned((prev) => !prev)}
                  className="text-[11px] h-7 px-2 text-muted-foreground hover:text-foreground font-medium"
                >
                  {showAllUnassigned ? "محدود به ۱۰ درس" : `مشاهده همه (${coursesWithoutOfferings.length})`}
                </Button>
              )}
              <div className="flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleScrollUnassigned("right")}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  title="قبلی"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleScrollUnassigned("left")}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  title="بعدی"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div
              ref={unassignedScrollRef}
              className="flex items-stretch gap-2 overflow-x-auto pb-1 pt-0.5 px-0.5 scrollbar-thin scroll-smooth"
            >
              {displayedUnassignedCourses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleOpenCreateModal(c.id)}
                  className="flex flex-col justify-between text-right p-2.5 rounded-lg border border-border/70 bg-card hover:bg-muted/50 hover:border-border transition-colors min-w-[185px] max-w-[215px] shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <div className="space-y-1.5 w-full">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-mono text-[11px] text-muted-foreground bg-muted/70 px-1.5 py-0.5 rounded font-semibold">
                        {c.code || "بدون کد"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0.5 h-auto font-medium text-foreground/80"
                        >
                          {c.degreeLevel === "master" ? "ارشد" : "کارشناسی"}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {c.units} واحد
                        </span>
                      </div>
                    </div>

                    <div
                      className="font-semibold text-xs text-foreground line-clamp-1 leading-snug"
                      title={c.name}
                    >
                      {c.name}
                    </div>
                  </div>

                  <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center justify-between w-full text-[11px] text-muted-foreground">
                    <span>تعریف ارائه</span>
                    <Plus className="h-3.5 w-3.5" />
                  </div>
                </button>
              ))}

              {displayedUnassignedCourses.length === 0 && (
                <div className="py-4 text-center text-xs text-muted-foreground w-full">
                  درسی با عبارت «{unassignedSearch}» در لیست دروس فاقد ارائه یافت نشد.
                </div>
              )}

              {!unassignedSearch.trim() && !showAllUnassigned && coursesWithoutOfferings.length > 10 && (
                <button
                  type="button"
                  onClick={() => setShowAllUnassigned(true)}
                  className="flex flex-col items-center justify-center p-2 rounded-lg border border-dashed border-border/80 hover:border-border hover:bg-muted/50 transition-colors min-w-[110px] shrink-0 text-muted-foreground hover:text-foreground text-[11px] gap-1 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="font-semibold text-[10px]">+{coursesWithoutOfferings.length - 10} دیگر</span>
                  <span className="text-[9px]">مشاهده همه</span>
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
                    `هشدار: آیا از حذف کلیه ارائه‌های درسی دانشکده «${
                      currentFaculty?.name || ""
                    }» مطمئن هستید؟ ارائه‌ها به صورت موقت (Soft Delete) حذف می‌شوند و با ثبت مجدد کدهای مشابه یا ویرایش بازگردانده خواهند شد.`
                  )
                ) {
                  const res = await deleteJson(`/api/offerings?all=true&facultyId=${selectedFacultyId}`);
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
              onClick={() => handleOpenCreateModal()}
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
                placeholder="جستجوی درس، استاد، کد یا دانشکده..."
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
                  const isLinked = Boolean(
                    selectedFacultyId && off.facultyId && off.facultyId !== selectedFacultyId
                  );
                  const offeringProfs = off.professors && off.professors.length > 0
                    ? off.professors
                    : [{ id: off.professorId || "p1", name: off.professorName || "استاد درس", title: off.professorTitle, avatarUrl: off.professorAvatarUrl }];

                  return (
                    <tr
                      key={off.id}
                      className={`transition-colors ${
                        isLinked ? "bg-amber-500/2 hover:bg-amber-500/4" : "hover:bg-muted/20"
                      }`}
                    >
                      {/* Course */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-lg font-bold text-xs shrink-0 ${
                              isLinked
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-emerald-500/10 text-emerald-600"
                            }`}
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-foreground">{off.courseName}</span>
                              {off.courseAbbreviation && (
                                <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/5 px-1 py-0">
                                  {off.courseAbbreviation}
                                </Badge>
                              )}
                              {isLinked && (
                                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30 bg-amber-500/10 gap-0.5">
                                  <Link2 className="h-2.5 w-2.5" />
                                  {off.facultyName || "لینک‌شده"}
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
                        {isLinked ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] gap-1 text-muted-foreground select-none"
                            title={`این ارائه متعلق به دانشکده ${off.facultyName || "مبدأ"} است و فقط از همان پنل قابل ویرایش است.`}
                          >
                            <Lock className="h-3 w-3" />
                            فقط‌خواندنی
                          </Badge>
                        ) : (
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
                        )}
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
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          setOfferingFormError(null);
        }}
      >
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

          {/* Form Error Banner */}
          {offeringFormError && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{offeringFormError}</span>
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

          <form onSubmit={handleSaveOffering} className="space-y-4">
            {/* 2-Column Responsive Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {/* Column 1: Course Info & Finalized Semesters */}
              <div className="space-y-3.5">
                {/* Course Combobox */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">انتخاب درس:</Label>
                  <Combobox
                    items={availableCourses.map((c) => {
                      const isCourseLinked = Boolean(selectedFacultyId && c.facultyId !== selectedFacultyId);
                      return {
                        value: c.id,
                        label: isCourseLinked ? `${c.name} (${c.facultyName || "لینک‌شده"})` : c.name,
                        badge: c.code,
                        sublabel: `${c.units} واحد${isCourseLinked ? ` • لینک‌شده از ${c.facultyName || "دانشکده دیگر"}` : ""}`,
                        keywords: [c.name, c.code, c.abbreviation || "", c.facultyName || ""],
                      };
                    })}
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
                              <SelectItem value="1" className="text-xs">بهار</SelectItem>
                              <SelectItem value="2" className="text-xs">پاییز</SelectItem>
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
                {selectedProfessorsList.length > 0 ? (
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
                ) : (
                  <div className="p-2.5 rounded-xl border border-dashed border-border/70 text-center text-xs text-muted-foreground bg-muted/20">
                    استادی انتخاب نشده است. از لیست زیر انتخاب نمایید.
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
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-semibold text-xs text-foreground block truncate">
                                {p.name}
                              </span>
                              {Boolean(selectedFacultyId && p.facultyId !== selectedFacultyId) && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 text-amber-600 border-amber-500/30 bg-amber-500/10 gap-0.5">
                                  <Link2 className="h-2.5 w-2.5" />
                                  {p.facultyName || "لینک‌شده"}
                                </Badge>
                              )}
                            </div>
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
                              بهار
                            </SelectItem>
                            <SelectItem value="2" className="text-xs">
                              پاییز
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
