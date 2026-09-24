"use client";

import React, { useState, useMemo, useEffect } from "react";
import type { Professor, Faculty } from "@/lib/types";
import { persianSearch } from "@/lib/search/persian-search";
import { fetchJson, postJson, putJson, deleteJson } from "@/lib/api-client";
import { useAdminStore } from "@/lib/stores/admin-store";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfessorImportDialog } from "@/components/professors/professor-import-dialog";
import { Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
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
  Globe,
  GraduationCap,
  ExternalLink,
  UsersRound,
  Link2,
  Lock,
  AlertTriangle,
  X,
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
  const { setProfessors } = useAdminStore();
  const [loading, setLoading] = useState(professors.length === 0);

  const fetchProfessors = async () => {
    setLoading(true);
    try {
      const res = await fetchJson("/api/professors");
      if (res.success && Array.isArray(res.data)) {
        setProfessors(res.data);
      }
    } catch (e) {
      console.error("ProfessorManager fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfessors();
  }, []);

  const [search, setSearch] = useState("");
  const [facultyFilter, setFacultyFilter] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [editingProfessor, setEditingProfessor] = useState<Professor | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState({
    code: "",
    firstName: "",
    lastName: "",
    title: "استاد تمام",
    email: "",
    avatarUrl: "",
    websiteLink: "",
    scholarLink: "",
    facultyId: selectedFacultyId || faculties[0]?.id || "",
  });

  const handleOpenCreateModal = () => {
    setEditingProfessor(null);
    setFormError(null);
    setForm({
      code: "",
      firstName: "",
      lastName: "",
      title: "استاد تمام",
      email: "",
      avatarUrl: "",
      websiteLink: "",
      scholarLink: "",
      facultyId: selectedFacultyId || faculties[0]?.id || "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (prof: Professor) => {
    setEditingProfessor(prof);
    setFormError(null);
    const splitted = prof.name ? prof.name.split(" ") : [];
    setForm({
      code: prof.code || "",
      firstName: prof.firstName || (splitted.length > 1 ? splitted[0] : prof.name || ""),
      lastName: prof.lastName || (splitted.length > 1 ? splitted.slice(1).join(" ") : ""),
      title: prof.title || "استاد تمام",
      email: prof.email || "",
      avatarUrl: prof.avatarUrl || "",
      websiteLink: prof.links?.website || "",
      scholarLink: prof.links?.scholar || "",
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

      const res = await postJson("/api/upload", formData);

      if (res.success && res.url) {
        setForm((prev) => ({ ...prev, avatarUrl: res.url }));
        setFormError(null);
      } else {
        setFormError(res.message || "خطا در آپلود تصویر");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setFormError("خطا در برقراری ارتباط با سرور آپلود");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(" ");
    if (!fullName) return;

    setIsSubmitting(true);
    try {
      const linksPayload = {
        website: form.websiteLink.trim() || undefined,
        scholar: form.scholarLink.trim() || undefined,
      };

      const cleanCode = form.code?.trim() ? form.code.trim().toUpperCase() : (editingProfessor ? null : undefined);

      const payload = {
        code: cleanCode,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        name: fullName,
        title: form.title,
        email: form.email?.trim() || "",
        avatarUrl: form.avatarUrl?.trim() || "",
        facultyId: form.facultyId,
        links: linksPayload,
      };

      setFormError(null);
      if (editingProfessor) {
        // Edit existing
        const res = await putJson("/api/professors", {
          id: editingProfessor.id,
          ...payload,
        });

        if (res.success) {
          setIsModalOpen(false);
          setFormError(null);
          await fetchProfessors();
        } else {
          setFormError(res.message || "خطا در ویرایش اطلاعات استاد");
        }
      } else {
        // Create new
        const res = await postJson("/api/professors", payload);

        if (res.success) {
          setIsModalOpen(false);
          setFormError(null);
          await fetchProfessors();
        } else {
          setFormError(res.message || "خطا در ثبت استاد جدید");
        }
      }
    } catch (err) {
      console.error("Save professor error:", err);
      setFormError("خطا در برقراری ارتباط با سرور");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (prof: Professor) => {
    if (!confirm(`آیا از حذف "${prof.name}" مطمئن هستید؟`)) return;

    try {
      const res = await deleteJson(`/api/professors?id=${prof.id}`);

      if (res.success) {
        await fetchProfessors();
      }
    } catch (err) {
      console.error("Delete professor error:", err);
    }
  };

  const handleExportJson = async () => {
    try {
      setIsExporting(true);
      const url = selectedFacultyId
        ? `/api/professors/export?facultyId=${selectedFacultyId}`
        : "/api/professors/export";

      const res = await fetchJson(url);
      if (res.success && Array.isArray(res.data)) {
        const fileName = currentFaculty
          ? `professors-${currentFaculty.code.toLowerCase()}.json`
          : "professors-export.json";

        const dataStr =
          "data:text/json;charset=utf-8," +
          encodeURIComponent(JSON.stringify(res.data, null, 2));
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", fileName);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      } else {
        alert(res.message || "خطا در خروجی گرفتن از اطلاعات اساتید");
      }
    } catch (err: any) {
      alert("خطا در برقراری ارتباط با سرور: " + (err?.message || "نامشخص"));
    } finally {
      setIsExporting(false);
    }
  };

  const currentFaculty = faculties.find((f) => f.id === selectedFacultyId);
  const linkedFacultyIds = currentFaculty?.linkedFacultyIds || [];

  const facultyProfessors = useMemo(() => {
    return professors.filter((p) => {
      if (!selectedFacultyId) return true;
      return p.facultyId === selectedFacultyId || linkedFacultyIds.includes(p.facultyId);
    });
  }, [professors, selectedFacultyId, linkedFacultyIds]);

  const filteredProfessors = useMemo(() => {
    if (!search.trim()) return facultyProfessors;
    const searchable = facultyProfessors.map((p) => {
      const displayName =
        p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : p.name;
      const faculty = faculties.find((f) => f.id === p.facultyId);
      return {
        ...p,
        name: displayName || p.name || "",
        code: p.code || "",
        abbreviation: p.title || "",
        keywords: [
          p.email || "",
          p.title || "",
          p.code || "",
          p.name || "",
          p.firstName || "",
          p.lastName || "",
          faculty?.name || "",
          faculty?.code || "",
        ].filter(Boolean),
      };
    });
    return persianSearch(searchable, search);
  }, [facultyProfessors, search, faculties]);

  const modalFacultyOptions = faculties.map((f) => ({
    value: f.id,
    label: f.name,
  }));

  const rankOptions = [
    { value: "استاد تمام", label: "استاد تمام" },
    { value: "استاد", label: "استاد" },
    { value: "دانشیار", label: "دانشیار" },
    { value: "استادیار", label: "استادیار" },
    { value: "مربی", label: "مربی" },
    { value: "مدرس مدعو", label: "مدرس مدعو" },
    { value: "بازنشسته", label: "بازنشسته" },
  ];

  return (
    <div className="space-y-4">
      {/* Standard Active Faculty Header Banner */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
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
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    انتخاب نشده
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                اساتید تعریف‌شده در این بخش به صورت مستقیم در ارائه‌های درسی دانشکده قابل انتساب هستند.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Professors List Card */}
      <Card className="rounded-2xl border-border/80 shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <UsersRound className="h-4 w-4 text-primary" />
              <span> اساتید {currentFaculty ? `«${currentFaculty.name}»` : ""}</span>
            </CardTitle>
            <CardDescription className="text-xs">
              مدیریت، ویرایش و آپلود تصاویر اساتید جهت انتساب به ارائه‌های درسی و ارزشیابی دانشجویان
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
                    `هشدار: آیا از حذف کلیه اساتید دانشکده «${
                      currentFaculty?.name || ""
                    }» مطمئن هستید؟ اساتید به صورت موقت (Soft Delete) حذف می‌شوند و با ثبت مجدد کدهای مشابه یا ویرایش بازگردانده خواهند شد.`
                  )
                ) {
                  const res = await deleteJson(`/api/professors?all=true&facultyId=${selectedFacultyId}`);
                  if (res.success) {
                    await fetchProfessors();
                  } else {
                    alert(res.message || "خطا در حذف اساتید");
                  }
                }
              }}
              disabled={!selectedFacultyId || facultyProfessors.length === 0}
              className="h-8 gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 shadow-2xs font-medium"
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
              <span>حذف همه اساتید</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleOpenCreateModal}
              disabled={!selectedFacultyId}
              className="h-8 gap-1.5 text-xs shadow-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              افزودن استاد جدید
            </Button>
          </div>
        </CardHeader>

        <CardContent className="px-4 space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div>
                <Input
                  placeholder="جستجوی نام، کد، مرتبه علمی یا ایمیل استاد..."
                  icon={<Search />}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-7 w-64 text-xs pr-8"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchProfessors}
                disabled={loading}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                title="تازه‌سازی لیست اساتید"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <div className="text-xs text-muted-foreground">
                مجموع اساتید: <span className="font-bold text-foreground">{filteredProfessors.length}</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs font-medium">در حال دریافت اساتید از سرور...</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProfessors.map((p) => {
              const faculty = faculties.find((f) => f.id === p.facultyId);
              const displayName = p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : p.name;
              const isLinked = Boolean(selectedFacultyId && p.facultyId !== selectedFacultyId);
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between rounded-xl border p-3.5 shadow-2xs transition-colors ${
                    isLinked
                      ? "border-amber-500/40 bg-amber-500/2"
                      : "border-border/80 bg-card hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs overflow-hidden border border-border/70 shadow-2xs">
                      {p.avatarUrl ? (
                        <img
                          src={p.avatarUrl}
                          alt={displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{displayName.charAt(0)}</span>
                      )}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <p className="text-xs font-bold truncate text-foreground">{displayName}</p>
                        {p.code && (
                          <Badge variant="outline" className="text-[11px] px-1 py-0 font-mono h-4 font-normal text-muted-foreground">
                            {p.code}
                          </Badge>
                        )}
                        {isLinked && (
                          <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0 text-amber-600 border-amber-500/30 bg-amber-500/10 gap-0.5">
                            <Link2 className="h-2.5 w-2.5" />
                            لینک‌شده
                          </Badge>
                        )}
                      </div>
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

                      {/* External Links */}
                      {p.links && (p.links.website || p.links.scholar) && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {p.links.website && (
                            <a
                              href={p.links.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary px-1.5 py-0.5 text-[10px] font-medium transition-colors"
                              title="صفحه رسمی دانشگاه تهران"
                            >
                              <Globe className="h-3 w-3" />
                              <span>صفحه دانشگاه</span>
                              <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                            </a>
                          )}
                          {p.links.scholar && (
                            <a
                              href={p.links.scholar}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 text-[10px] font-medium transition-colors"
                              title="گوگل اسکولار (Google Scholar)"
                            >
                              <GraduationCap className="h-3 w-3" />
                              <span>اسکولار</span>
                              <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions (Edit + Delete) */}
                  <div className="flex items-center gap-1 shrink-0 mr-2">
                    {isLinked ? (
                      <Badge
                        variant="secondary"
                        className="text-[10px] gap-1 text-muted-foreground select-none"
                        title={`این استاد متعلق به دانشکده ${faculty?.name || p.facultyName || "مبدأ"} است و فقط از همان پنل قابل ویرایش است.`}
                      >
                        <Lock className="h-3 w-3" />
                        فقط‌خواندنی
                      </Badge>
                    ) : (
                      <>
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
                      </>
                    )}
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
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Professor Modal */}
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          setFormError(null);
        }}
      >
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
              اطلاعات استاد، تصویر پرسنلی و لینک‌های علمی را وارد یا ویرایش نمایید.
            </DialogDescription>
          </DialogHeader>

          {/* Form Error Banner */}
          {formError && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
            {/* Target Faculty Indicator */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <span className="text-muted-foreground">دانشکده:</span>
                <span className="font-bold text-foreground">
                  {currentFaculty ? `${currentFaculty.name} (${currentFaculty.code})` : "انتخاب نشده"}
                </span>
              </div>
            </div>

            {/* Photo Area (Upload or Direct URL) */}
            <div className="space-y-2.5 p-3 rounded-xl border border-border/70 bg-muted/15">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5 text-primary" />
                  <span>تصویر پرسنلی استاد:</span>
                </Label>
                {form.avatarUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm({ ...form, avatarUrl: "" })}
                    className="h-6 text-[11px] text-muted-foreground hover:text-destructive px-2 gap-1"
                  >
                    <X className="h-3 w-3" />
                    <span>حذف عکس</span>
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3.5">
                {/* Circular Preview */}
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background overflow-hidden shadow-2xs">
                  {form.avatarUrl ? (
                    <img
                      src={form.avatarUrl}
                      alt="پیش‌نمایش تصویر"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
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

                {/* Upload Button */}
                <div className="flex-1 space-y-1">
                  <label className="cursor-pointer inline-block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadImage}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors shadow-2xs">
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingImage ? "در حال آپلود..." : "آپلود فایل عکس از سیستم"}
                    </span>
                  </label>
                  <p className="text-[10px] text-muted-foreground">
                    فرمت‌های JPG، PNG و WebP مجاز هستند.
                  </p>
                </div>
              </div>

              {/* Direct URL Input Alternative */}
              <div className="pt-2 border-t border-border/50 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                    <Link2 className="h-3 w-3 text-muted-foreground" />
                    <span>یا درج لینک مستقیم عکس (جایگزین آپلود):</span>
                  </Label>
                  <span className="text-[10px] text-muted-foreground">URL مستقیم</span>
                </div>
                <div className="relative flex items-center">
                  <Input
                    placeholder="https://example.com/photo.jpg"
                    value={form.avatarUrl}
                    onChange={(e) => setForm({ ...form, avatarUrl: e.target.value.trim() })}
                    className="font-mono"
                    dir="ltr"
                  />
                  
                </div>
              </div>
            </div>

            {/* Professor Code (Optional) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">کد استاد:</Label>
                <span className="text-[10px] text-muted-foreground">اختیاری (در صورت خالی بودن خودکار تولید می‌شود)</span>
              </div>
              <Input
                placeholder="PRF-101 OR 90123"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="font-mono"
                dir="ltr"
              />
            </div>

            {/* First Name & Last Name (Separated) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">نام استاد:</Label>
                <Input
                  required
                  placeholder="مثلاً علی"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">نام خانوادگی استاد:</Label>
                <Input
                  required
                  placeholder="مثلاً محمدی"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>

            {/* Title / Rank */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">مرتبه علمی:</Label>
              <Select
                value={form.title}
                onValueChange={(val) => val && setForm({ ...form, title: val })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {rankOptions.slice(0, 5).map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    {rankOptions.slice(5).map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  {form.title && !rankOptions.some((r) => r.value === form.title) && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectItem value={form.title}>{form.title}</SelectItem>
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ایمیل دانشگاهی (اختیاری):</Label>
              <Input
                type="email"
                placeholder="mohammadi@ut.ac.ir"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                dir="ltr"
              />
            </div>

            {/* UT Profile Link */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-primary" />
                <span>لینک صفحه دانشگاه تهران (اختیاری):</span>
              </Label>
              <Input
                type="url"
                placeholder="https://profile.ut.ac.ir/~mohammadi"
                value={form.websiteLink}
                onChange={(e) => setForm({ ...form, websiteLink: e.target.value })}
                dir="ltr"
              />
            </div>

            {/* Google Scholar Link */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span>لینک گوگل اسکولار (Google Scholar) (اختیاری):</span>
              </Label>
              <Input
                type="url"
                placeholder="https://scholar.google.com/citations?user=..."
                value={form.scholarLink}
                onChange={(e) => setForm({ ...form, scholarLink: e.target.value })}
                dir="ltr"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  uploadingImage ||
                  (!form.firstName.trim() && !form.lastName.trim())
                }
                className="w-full font-semibold"
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

      {/* Professor Import Dialog */}
      <ProfessorImportDialog
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        defaultFacultyId={selectedFacultyId}
        targetFaculty={currentFaculty}
        onSuccess={fetchProfessors}
      />
    </div>
  );
}
