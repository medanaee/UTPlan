"use client";

import React, { useState } from "react";
import {
  Building2,
  GraduationCap,
  Layers,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  Link2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Faculty, Major, Track } from "@/lib/types";
import { useAdminStore } from "@/lib/stores/admin-store";

export function UniversityStructureManager() {
  const {
    faculties,
    majors,
    tracks,
    selectedFacultyId,
    selectedMajorId,
    selectedTrackId,
    setSelectedFacultyId,
    setSelectedMajorId,
    setSelectedTrackId,
    loadAllData,
    setActionMessage,
  } = useAdminStore();

  // Modals state
  const [facultyModalOpen, setFacultyModalOpen] = useState(false);
  const [majorModalOpen, setMajorModalOpen] = useState(false);
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [linksModalOpen, setLinksModalOpen] = useState(false);
  const [linkingFaculty, setLinkingFaculty] = useState<Faculty | null>(null);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [savingLinks, setSavingLinks] = useState(false);

  // Editing states
  const [editingFaculty, setEditingFaculty] = useState<Faculty | null>(null);
  const [editingMajor, setEditingMajor] = useState<Major | null>(null);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);

  // Form states
  const [facultyForm, setFacultyForm] = useState({ name: "", code: "" });
  const [majorForm, setMajorForm] = useState({ name: "", code: "" });
  const [trackForm, setTrackForm] = useState({ name: "", code: "" });

  const currentFaculty = faculties.find((f) => f.id === selectedFacultyId);
  const currentMajor = majors.find((m) => m.id === selectedMajorId);
  const currentTrack = tracks.find((t) => t.id === selectedTrackId);

  // Create or Update Faculty
  const handleSaveFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingFaculty) {
      const res = await fetch("/api/faculties", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingFaculty.id, ...facultyForm }),
      }).then((r) => r.json());

      if (res.success) {
        setFacultyModalOpen(false);
        setEditingFaculty(null);
        setFacultyForm({ name: "", code: "" });
        setActionMessage("دانشکده با موفقیت ویرایش شد.");
        await loadAllData();
      } else {
        alert(res.message || "خطا در ویرایش دانشکده");
      }
    } else {
      const res = await fetch("/api/faculties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(facultyForm),
      }).then((r) => r.json());

      if (res.success) {
        setFacultyModalOpen(false);
        setFacultyForm({ name: "", code: "" });
        setActionMessage("دانشکده جدید با موفقیت ایجاد شد.");
        await loadAllData();
        setSelectedFacultyId(res.data.id);
      } else {
        alert(res.message || "خطا در ایجاد دانشکده");
      }
    }
  };

  const handleDeleteFaculty = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`آیا از حذف دانشکده «${name}» و تمام رشته‌ها، گرایش‌ها و دروس وابسته به آن مطمئن هستید؟`)) return;
    const res = await fetch(`/api/faculties?id=${id}`, { method: "DELETE" }).then((r) => r.json());
    if (res.success) {
      setActionMessage(`دانشکده «${name}» با موفقیت حذف شد.`);
      await loadAllData();
    } else {
      alert(res.message || "خطا در حذف دانشکده");
    }
  };

  const handleOpenLinksModal = (f: Faculty) => {
    setLinkingFaculty(f);
    setSelectedSourceIds(f.linkedFacultyIds || []);
    setLinksModalOpen(true);
  };

  const handleToggleSourceId = (id: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSaveFacultyLinks = async () => {
    if (!linkingFaculty) return;
    try {
      setSavingLinks(true);
      const res = await fetch("/api/faculties/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetFacultyId: linkingFaculty.id,
          sourceFacultyIds: selectedSourceIds,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setLinksModalOpen(false);
        setActionMessage("اتصالات دانشکده با موفقیت ذخیره شد.");
        await loadAllData();
      } else {
        alert(res.message || "خطا در ذخیره اتصالات");
      }
    } catch (err: any) {
      alert("خطا در برقراری ارتباط با سرور: " + (err?.message || "نامشخص"));
    } finally {
      setSavingLinks(false);
    }
  };

  // Create or Update Major
  const handleSaveMajor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFacultyId) return;

    if (editingMajor) {
      const res = await fetch("/api/majors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingMajor.id, ...majorForm }),
      }).then((r) => r.json());

      if (res.success) {
        setMajorModalOpen(false);
        setEditingMajor(null);
        setMajorForm({ name: "", code: "" });
        setActionMessage("رشته تحصیلی با موفقیت ویرایش شد.");
        await loadAllData();
      } else {
        alert(res.message || "خطا در ویرایش رشته");
      }
    } else {
      const res = await fetch("/api/majors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facultyId: selectedFacultyId, ...majorForm }),
      }).then((r) => r.json());

      if (res.success) {
        setMajorModalOpen(false);
        setMajorForm({ name: "", code: "" });
        setActionMessage("رشته جدید با موفقیت ایجاد شد.");
        await loadAllData();
        setSelectedMajorId(res.data.id);
      } else {
        alert(res.message || "خطا در ایجاد رشته");
      }
    }
  };

  const handleDeleteMajor = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`آیا از حذف رشته «${name}» و تمام گرایش‌های وابسته به آن مطمئن هستید؟`)) return;
    const res = await fetch(`/api/majors?id=${id}`, { method: "DELETE" }).then((r) => r.json());
    if (res.success) {
      setActionMessage(`رشته «${name}» با موفقیت حذف شد.`);
      await loadAllData();
    } else {
      alert(res.message || "خطا در حذف رشته");
    }
  };

  // Create or Update Track
  const handleSaveTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMajorId) return;

    if (editingTrack) {
      const res = await fetch("/api/tracks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingTrack.id, ...trackForm }),
      }).then((r) => r.json());

      if (res.success) {
        setTrackModalOpen(false);
        setEditingTrack(null);
        setTrackForm({ name: "", code: "" });
        setActionMessage("گرایش با موفقیت ویرایش شد.");
        await loadAllData();
      } else {
        alert(res.message || "خطا در ویرایش گرایش");
      }
    } else {
      const res = await fetch("/api/tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ majorId: selectedMajorId, ...trackForm }),
      }).then((r) => r.json());

      if (res.success) {
        setTrackModalOpen(false);
        setTrackForm({ name: "", code: "" });
        setActionMessage("گرایش جدید با موفقیت ایجاد شد.");
        await loadAllData();
        setSelectedTrackId(res.data.id);
      } else {
        alert(res.message || "خطا در ایجاد گرایش");
      }
    }
  };

  const handleDeleteTrack = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`آیا از حذف گرایش «${name}» مطمئن هستید؟`)) return;
    const res = await fetch(`/api/tracks?id=${id}`, { method: "DELETE" }).then((r) => r.json());
    if (res.success) {
      setActionMessage(`گرایش «${name}» با موفقیت حذف شد.`);
      await loadAllData();
    } else {
      alert(res.message || "خطا در حذف گرایش");
    }
  };

  return (
    <div className="space-y-4">
      {/* Hierarchical Breadcrumb & Flow Path */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-muted-foreground">مسیر انتخابی فعال:</span>
          <div className="flex flex-wrap items-center gap-1.5 font-bold">
            <Badge variant="outline" className="gap-1 bg-background text-xs">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <span>{currentFaculty ? currentFaculty.name : "انتخاب دانشکده"}</span>
            </Badge>
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
            <Badge variant="outline" className="gap-1 bg-background text-xs">
              <GraduationCap className="h-3.5 w-3.5 text-violet-600" />
              <span>{currentMajor ? currentMajor.name : "انتخاب رشته"}</span>
            </Badge>
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
            <Badge variant="secondary" className="gap-1 text-xs shadow-xs">
              <Layers className="h-3.5 w-3.5 text-emerald-600" />
              <span>{currentTrack ? currentTrack.name : "انتخاب گرایش"}</span>
            </Badge>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground">
          برای تغییر هر بخش، روی آیتم مورد نظر در ۳ ستون زیر کلیک کنید.
        </div>
      </div>

      {/* 3-Column Visual Hierarchy Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Column 1: Faculties */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
            <div>
              <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-primary" />
                <span>۱. دانشکده‌ها ({faculties.length})</span>
              </CardTitle>
              <CardDescription className="text-[11px]">انتخاب دانشکده مبدأ</CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingFaculty(null);
                setFacultyForm({ name: "", code: "" });
                setFacultyModalOpen(true);
              }}
              className="h-7 text-[11px] gap-1"
            >
              <Plus className="h-3 w-3" /> افزودن
            </Button>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {faculties.map((f) => {
              const isSelected = f.id === selectedFacultyId;
              const relatedMajorCount = majors.filter((m) => m.facultyId === f.id).length;
              return (
                <div
                  key={f.id}
                  onClick={() => setSelectedFacultyId(f.id)}
                  className={`group flex items-center justify-between rounded-xl p-2.5 text-xs transition-all cursor-pointer border ${
                    isSelected
                      ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                      : "border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Building2 className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <p>{f.name}</p>
                      <span className="text-[10px] font-normal text-muted-foreground">کد: {f.code}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {Boolean(f.linkedFacultyIds && f.linkedFacultyIds.length > 0) && (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4.5 px-1.5 font-normal text-amber-600 bg-amber-500/10 border-amber-500/30 gap-0.5"
                        title={`${f.linkedFacultyIds!.length} دانشکده ارائه‌دهنده متصل`}
                      >
                        <Link2 className="h-2.5 w-2.5" />
                        {f.linkedFacultyIds!.length} متصل
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 font-normal">
                      {relatedMajorCount} رشته
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenLinksModal(f);
                      }}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10"
                      title="اتصال به دانشکده‌های دیگر (اشتراک‌گذاری دروس، اساتید و ارائه‌ها)"
                    >
                      <Link2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingFaculty(f);
                        setFacultyForm({ name: f.name, code: f.code });
                        setFacultyModalOpen(true);
                      }}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                      title="ویرایش دانشکده"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDeleteFaculty(f.id, f.name, e)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="حذف دانشکده"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {faculties.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-6">دانشکده‌ای تعریف نشده است.</p>
            )}
          </CardContent>
        </Card>

        {/* Column 2: Majors */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
            <div>
              <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4 text-violet-600" />
                <span>۲. رشته‌های تحصیلی ({majors.filter((m) => m.facultyId === selectedFacultyId).length})</span>
              </CardTitle>
              <CardDescription className="text-[11px]">
                {currentFaculty ? `وابسته به ${currentFaculty.name}` : "ابتدا دانشکده را انتخاب کنید"}
              </CardDescription>
            </div>
            <Button
              size="sm"
              disabled={!selectedFacultyId}
              onClick={() => {
                setEditingMajor(null);
                setMajorForm({ name: "", code: "" });
                setMajorModalOpen(true);
              }}
              className="h-7 text-[11px] gap-1"
            >
              <Plus className="h-3 w-3" /> افزودن
            </Button>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {majors
              .filter((m) => m.facultyId === selectedFacultyId)
              .map((m) => {
                const isSelected = m.id === selectedMajorId;
                const relatedTrackCount = tracks.filter((t) => t.majorId === m.id).length;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMajorId(m.id)}
                    className={`group flex items-center justify-between rounded-xl p-2.5 text-xs transition-all cursor-pointer border ${
                      isSelected
                        ? "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300 font-bold shadow-2xs"
                        : "border-border/60 bg-muted/20 hover:border-violet-400/40 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <GraduationCap className={`h-4 w-4 ${isSelected ? "text-violet-600" : "text-muted-foreground"}`} />
                      <div>
                        <p>{m.name}</p>
                        <span className="text-[10px] font-normal text-muted-foreground">کد: {m.code}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 font-normal">
                        {relatedTrackCount} گرایش
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingMajor(m);
                          setMajorForm({ name: m.name, code: m.code });
                          setMajorModalOpen(true);
                        }}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-violet-600 hover:bg-violet-500/10"
                        title="ویرایش رشته"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDeleteMajor(m.id, m.name, e)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="حذف رشته"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            {selectedFacultyId && majors.filter((m) => m.facultyId === selectedFacultyId).length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-6 space-y-2">
                <p>هیچ رشته‌ای برای این دانشکده ثبت نشده است.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingMajor(null);
                    setMajorForm({ name: "", code: "" });
                    setMajorModalOpen(true);
                  }}
                  className="h-7 text-xs"
                >
                  + ایجاد اولین رشته
                </Button>
              </div>
            )}
            {!selectedFacultyId && (
              <p className="text-center text-xs text-muted-foreground py-6">ابتدا یک دانشکده را از ستون اول انتخاب کنید.</p>
            )}
          </CardContent>
        </Card>

        {/* Column 3: Tracks */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
            <div>
              <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-emerald-600" />
                <span>۳. گرایش‌ها ({tracks.filter((t) => t.majorId === selectedMajorId).length})</span>
              </CardTitle>
              <CardDescription className="text-[11px]">
                {currentMajor ? `وابسته به ${currentMajor.name}` : "ابتدا رشته را انتخاب کنید"}
              </CardDescription>
            </div>
            <Button
              size="sm"
              disabled={!selectedMajorId}
              onClick={() => {
                setEditingTrack(null);
                setTrackForm({ name: "", code: "" });
                setTrackModalOpen(true);
              }}
              className="h-7 text-[11px] gap-1"
            >
              <Plus className="h-3 w-3" /> افزودن
            </Button>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {tracks
              .filter((t) => t.majorId === selectedMajorId)
              .map((t) => {
                const isSelected = t.id === selectedTrackId;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTrackId(t.id)}
                    className={`group flex items-center justify-between rounded-xl p-2.5 text-xs transition-all cursor-pointer border ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold shadow-2xs"
                        : "border-border/60 bg-muted/20 hover:border-emerald-400/40 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Layers className={`h-4 w-4 ${isSelected ? "text-emerald-600" : "text-muted-foreground"}`} />
                      <div>
                        <p>{t.name}</p>
                        <span className="text-[10px] font-normal text-muted-foreground">کد: {t.code}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTrack(t);
                          setTrackForm({ name: t.name, code: t.code });
                          setTrackModalOpen(true);
                        }}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10"
                        title="ویرایش گرایش"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDeleteTrack(t.id, t.name, e)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="حذف گرایش"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            {selectedMajorId && tracks.filter((t) => t.majorId === selectedMajorId).length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-6 space-y-2">
                <p>هیچ گرایشی برای این رشته ثبت نشده است.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingTrack(null);
                    setTrackForm({ name: "", code: "" });
                    setTrackModalOpen(true);
                  }}
                  className="h-7 text-xs"
                >
                  + ایجاد اولین گرایش
                </Button>
              </div>
            )}
            {!selectedMajorId && (
              <p className="text-center text-xs text-muted-foreground py-6">ابتدا یک رشته را از ستون دوم انتخاب کنید.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit Faculty Modal */}
      <Dialog
        open={facultyModalOpen}
        onOpenChange={(open) => {
          setFacultyModalOpen(open);
          if (!open) setEditingFaculty(null);
        }}
      >
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span>{editingFaculty ? "ویرایش مشخصات دانشکده" : "افزودن دانشکده جدید"}</span>
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveFaculty} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">نام دانشکده:</Label>
              <Input
                required
                placeholder="مثلاً دانشکده مهندسی برق و کامپیوتر"
                value={facultyForm.name}
                onChange={(e) => setFacultyForm({ ...facultyForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">کد اختصاری دانشکده:</Label>
              <Input
                required
                placeholder="مثلاً ECE"
                value={facultyForm.code}
                onChange={(e) => setFacultyForm({ ...facultyForm, code: e.target.value.toUpperCase() })}
                dir="ltr"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="submit" size="sm" className="h-8 text-xs font-semibold w-full">
                {editingFaculty ? "ذخیره تغییرات دانشکده" : "ایجاد دانشکده"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Major Modal */}
      <Dialog
        open={majorModalOpen}
        onOpenChange={(open) => {
          setMajorModalOpen(open);
          if (!open) setEditingMajor(null);
        }}
      >
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-violet-600" />
              <span>{editingMajor ? "ویرایش مشخصات رشته" : "افزودن رشته تحصیلی جدید"}</span>
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveMajor} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">نام رشته:</Label>
              <Input
                required
                placeholder="مثلاً مهندسی کامپیوتر"
                value={majorForm.name}
                onChange={(e) => setMajorForm({ ...majorForm, name: e.target.value })}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">کد رشته:</Label>
              <Input
                required
                placeholder="مثلاً CE"
                value={majorForm.code}
                onChange={(e) => setMajorForm({ ...majorForm, code: e.target.value.toUpperCase() })}
                className="h-8 text-xs"
                dir="ltr"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="submit" size="sm" className="h-8 text-xs font-semibold w-full">
                {editingMajor ? "ذخیره تغییرات رشته" : "ایجاد رشته"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Track Modal */}
      <Dialog
        open={trackModalOpen}
        onOpenChange={(open) => {
          setTrackModalOpen(open);
          if (!open) setEditingTrack(null);
        }}
      >
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-600" />
              <span>{editingTrack ? "ویرایش مشخصات گرایش" : "افزودن گرایش جدید"}</span>
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveTrack} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">نام گرایش:</Label>
              <Input
                required
                placeholder="مثلاً نرم‌افزار و هوش مصنوعی"
                value={trackForm.name}
                onChange={(e) => setTrackForm({ ...trackForm, name: e.target.value })}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">کد گرایش:</Label>
              <Input
                required
                placeholder="مثلاً CE_SW"
                value={trackForm.code}
                onChange={(e) => setTrackForm({ ...trackForm, code: e.target.value.toUpperCase() })}
                className="h-8 text-xs"
                dir="ltr"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="submit" size="sm" className="h-8 text-xs font-semibold w-full">
                {editingTrack ? "ذخیره تغییرات گرایش" : "ایجاد گرایش"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Faculty Links Modal */}
      <Dialog open={linksModalOpen} onOpenChange={setLinksModalOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Link2 className="h-4 w-4 text-amber-600" />
              <span>اتصال دانشکده‌های ارائه‌دهنده به «{linkingFaculty?.name}»</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
              دروس، اساتید، ارائه‌ها و رویدادهای دانشکده‌های انتخاب‌شده در این دانشکده به صورت اشتراکی در دسترس خواهند بود.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2 max-h-72 overflow-y-auto">
            {faculties
              .filter((f) => f.id !== linkingFaculty?.id)
              .map((f) => {
                const isChecked = selectedSourceIds.includes(f.id);
                return (
                  <div
                    key={f.id}
                    onClick={() => handleToggleSourceId(f.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? "bg-primary/10 border-primary/40 font-semibold"
                        : "bg-muted/20 border-border/60 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => handleToggleSourceId(f.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div>
                        <p className="text-foreground">{f.name}</p>
                        <span className="text-[10px] font-normal text-muted-foreground">کد: {f.code}</span>
                      </div>
                    </div>
                    {isChecked && (
                      <Badge variant="secondary" className="text-[10px] gap-1 bg-primary/15 text-primary">
                        متصل
                      </Badge>
                    )}
                  </div>
                );
              })}
            {faculties.filter((f) => f.id !== linkingFaculty?.id).length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-6">
                دانشکده دیگری برای اتصال به این دانشکده وجود ندارد.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLinksModalOpen(false)}
              className="text-xs"
            >
              انصراف
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveFacultyLinks}
              disabled={savingLinks}
              className="text-xs font-semibold gap-1.5"
            >
              <Link2 className="h-3.5 w-3.5" />
              {savingLinks ? "در حال ذخیره..." : "ذخیره اتصالات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
