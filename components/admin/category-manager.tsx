"use client";

import React, { useState } from "react";
import {
  Layers,
  Building2,
  Plus,
  Trash2,
  CornerDownLeft,
  GripVertical,
  BookOpen,
  X,
  Scale,
  Sparkles,
  Copy,
  FolderTree,
  ChevronDown,
  Palette,
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
} from "@/components/ui/dialog";
import { CategoryPicker } from "./category-picker";
import { useAdminStore } from "@/lib/stores/admin-store";
import { TrackCloneDialog } from "./track-clone-dialog";
import { CategoryCourseAssignDialog } from "./category-course-assign-dialog";
import type { Course } from "@/lib/types";

const COLOR_PRESETS = [
  { name: "آبی", hex: "#3b82f6" },
  { name: "سبز", hex: "#10b981" },
  { name: "زرد", hex: "#f59e0b" },
  { name: "قرمز", hex: "#ef4444" },
  { name: "بنفش", hex: "#8b5cf6" },
  { name: "صورتی", hex: "#ec4899" },
  { name: "نارنجی", hex: "#f97316" },
  { name: "طوسی", hex: "#6b7280" },
];

interface CategoryManagerProps {
  onNavigateToStructure?: () => void;
}

export function CategoryManager({ onNavigateToStructure }: CategoryManagerProps) {
  const {
    faculties,
    majors,
    tracks,
    courses,
    visualCats,
    ruleCats,
    trackAssignments,
    selectedFacultyId,
    selectedMajorId,
    selectedTrackId,
    setVisualCats,
    setRuleCats,
    setTrackAssignments,
    loadTrackDetails,
    setActionMessage,
  } = useAdminStore();

  const [vcatModalOpen, setVcatModalOpen] = useState(false);
  const [rcatModalOpen, setRcatModalOpen] = useState(false);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);

  const [vcatForm, setVcatForm] = useState({ name: "", color: "#3b82f6", sortOrder: 1 });
  const [rcatForm, setRcatForm] = useState<{ name: string; parentId: string | null }>({
    name: "",
    parentId: null,
  });

  // Assign Modal State
  const [assignModal, setAssignModal] = useState<{
    open: boolean;
    type: "visual" | "rule";
    categoryId: string;
    categoryName: string;
    categoryColor?: string;
  }>({
    open: false,
    type: "visual",
    categoryId: "",
    categoryName: "",
  });

  // Drag and Drop States
  const [draggedVcatIndex, setDraggedVcatIndex] = useState<number | null>(null);
  const [dragOverVcatIndex, setDragOverVcatIndex] = useState<number | null>(null);

  const [draggedRcatId, setDraggedRcatId] = useState<string | null>(null);
  const [dragOverRcatId, setDragOverRcatId] = useState<string | null>(null);

  const currentFaculty = faculties.find((f) => f.id === selectedFacultyId);
  const currentMajor = majors.find((m) => m.id === selectedMajorId);
  const currentTrack = tracks.find((t) => t.id === selectedTrackId);

  // Helper: Get courses assigned to a visual category
  const getVisualCategoryCourses = (catId: string): Course[] => {
    const assignedCourseIds = new Set(
      trackAssignments.filter((a) => a.visualCategoryId === catId).map((a) => a.courseId)
    );
    return courses.filter((c) => assignedCourseIds.has(c.id));
  };

  // Helper: Get courses assigned to a rule category
  const getRuleCategoryCourses = (catId: string): Course[] => {
    const assignedCourseIds = new Set(
      trackAssignments.filter((a) => a.ruleCategoryId === catId).map((a) => a.courseId)
    );
    return courses.filter((c) => assignedCourseIds.has(c.id));
  };

  // Helper: Calculate depth of category in tree (Level 1: 1, Level 2: 2, Level 3: 3)
  const getCategoryDepth = (catId: string): number => {
    let depth = 1;
    let curr = ruleCats.find((c) => c.id === catId);
    while (curr?.parentId) {
      depth++;
      curr = ruleCats.find((c) => c.id === curr!.parentId);
    }
    return depth;
  };

  // Quick Unassign Course from Visual Category
  const handleQuickUnassignVisual = async (catId: string, courseId: string) => {
    if (!selectedTrackId) return;
    const currentList = getVisualCategoryCourses(catId).map((c) => c.id);
    const updated = currentList.filter((id) => id !== courseId);
    await fetch("/api/tracks/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "assign_category_courses",
        trackId: selectedTrackId,
        type: "visual",
        categoryId: catId,
        courseIds: updated,
      }),
    });
    const assignRes = await fetch("/api/tracks/assignments?trackId=" + selectedTrackId).then((r) =>
      r.json()
    );
    if (assignRes.success) setTrackAssignments(assignRes.data);
  };

  // Quick Unassign Course from Rule Category
  const handleQuickUnassignRule = async (catId: string, courseId: string) => {
    if (!selectedTrackId) return;
    const currentList = getRuleCategoryCourses(catId).map((c) => c.id);
    const updated = currentList.filter((id) => id !== courseId);
    await fetch("/api/tracks/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "assign_category_courses",
        trackId: selectedTrackId,
        type: "rule",
        categoryId: catId,
        courseIds: updated,
      }),
    });
    const assignRes = await fetch("/api/tracks/assignments?trackId=" + selectedTrackId).then((r) =>
      r.json()
    );
    if (assignRes.success) setTrackAssignments(assignRes.data);
  };

  // Create Visual Category
  const handleCreateVcat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrackId) return;
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "visual",
        trackId: selectedTrackId,
        ...vcatForm,
        sortOrder: visualCats.length + 1,
      }),
    }).then((r) => r.json());

    if (res.success) {
      setVcatModalOpen(false);
      setVcatForm({ name: "", color: "#3b82f6", sortOrder: 1 });
      setActionMessage("دسته بصری جدید با موفقیت اضافه شد.");
      await loadTrackDetails(selectedTrackId);
    }
  };

  // Create Rule Category (With strict Depth 3 check)
  const handleCreateRcat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrackId) return;

    if (rcatForm.parentId) {
      const parentDepth = getCategoryDepth(rcatForm.parentId);
      if (parentDepth >= 3) {
        alert("خطا: ساختار درختی دسته‌های قوانین حداکثر تا عمق ۳ لایه مجاز است.");
        return;
      }
    }

    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "rule",
        trackId: selectedTrackId,
        ...rcatForm,
      }),
    }).then((r) => r.json());

    if (res.success) {
      setRcatModalOpen(false);
      setRcatForm({ name: "", parentId: null });
      setActionMessage("دسته قوانین با موفقیت اضافه شد.");
      await loadTrackDetails(selectedTrackId);
    }
  };

  // Visual Category Drag and Drop Reorder
  const handleVcatDrop = async (targetIndex: number) => {
    if (draggedVcatIndex === null || draggedVcatIndex === targetIndex) {
      setDraggedVcatIndex(null);
      setDragOverVcatIndex(null);
      return;
    }

    const updated = [...visualCats];
    const [draggedItem] = updated.splice(draggedVcatIndex, 1);
    updated.splice(targetIndex, 0, draggedItem);

    setVisualCats(updated);
    setDraggedVcatIndex(null);
    setDragOverVcatIndex(null);

    try {
      const itemsPayload = updated.map((item, idx) => ({ id: item.id, sortOrder: idx + 1 }));
      await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", type: "visual", items: itemsPayload }),
      });
    } catch (err) {
      console.error("Reorder visual categories error:", err);
    }
  };

  // Rule Category Drag and Drop Reorder
  const handleRcatDrop = async (targetCatId: string, parentId: string | null) => {
    if (!draggedRcatId || draggedRcatId === targetCatId) {
      setDraggedRcatId(null);
      setDragOverRcatId(null);
      return;
    }

    const siblings = ruleCats.filter((c) => (c.parentId || null) === parentId);
    const draggedIdx = siblings.findIndex((c) => c.id === draggedRcatId);
    const targetIdx = siblings.findIndex((c) => c.id === targetCatId);

    if (draggedIdx === -1 || targetIdx === -1) {
      setDraggedRcatId(null);
      setDragOverRcatId(null);
      return;
    }

    const reorderedSiblings = [...siblings];
    const [draggedItem] = reorderedSiblings.splice(draggedIdx, 1);
    reorderedSiblings.splice(targetIdx, 0, draggedItem);

    const otherCats = ruleCats.filter((c) => (c.parentId || null) !== parentId);
    const newRuleCats = [...otherCats, ...reorderedSiblings];

    setRuleCats(newRuleCats);
    setDraggedRcatId(null);
    setDragOverRcatId(null);

    try {
      const itemsPayload = reorderedSiblings.map((item, idx) => ({
        id: item.id,
        sortOrder: idx + 1,
        parentId: parentId || null,
      }));
      await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", type: "rule", items: itemsPayload }),
      });
    } catch (err) {
      console.error("Reorder rule categories error:", err);
    }
  };

  // Filter categories eligible to be parent for new categories (depth < 3)
  const eligibleParentCategories = ruleCats.filter((c) => getCategoryDepth(c.id) < 3);

  return (
    <div className="space-y-6">
      {/* Active Track Banner */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20 shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">گرایش انتخابی:</span>
                {currentTrack ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="default" className="text-xs px-2.5 py-0.5 font-bold shadow-xs">
                      {currentTrack.name}
                    </Badge>
                  </div>
                ) : (
                  <Badge variant="outline" className="text-xs px-2.5 py-0.5 text-destructive border-destructive/40">
                    گرایشی در بخش ساختار دانشگاه انتخاب نشده است
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                دسته‌های بصری و دسته‌های قوانین برای دروس این گرایش تنظیم می‌شوند. با کلیک روی هر دسته می‌توانید مستقیماً دروس آن را انتخاب و تخصیص دهید.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentTrack && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCloneModalOpen(true)}
                className="h-8 text-xs gap-1.5 shadow-2xs font-medium"
              >
                <Copy className="h-3.5 w-3.5 text-primary" />
                کپی ساختار از گرایش دیگر
              </Button>
            )}
            {!currentTrack && onNavigateToStructure && (
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
      </div>

      {/* 1. VISUAL CATEGORIES (STACKED FULL-WIDTH CARD) */}
      <Card className="rounded-2xl border-border/80 shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              <span>دسته‌های بصری چارت (رنگی سایدبار چارت)</span>
            </CardTitle>
            <CardDescription className="text-xs">
              این دسته‌ها با رنگ دلخواه در سایدبار ساخت چارت به دانشجو نشان داده می‌شوند. برای انتساب یا حذف دروس روی هر دسته کلیک کنید.
            </CardDescription>
          </div>

          <Button
            size="sm"
            disabled={!selectedTrackId}
            onClick={() => setVcatModalOpen(true)}
            className="h-8 gap-1.5 text-xs shadow-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            افزودن دسته بصری جدید
          </Button>
        </CardHeader>

        <CardContent className="p-4 space-y-3">
          {visualCats.map((cat, idx) => {
            const assignedCourses = getVisualCategoryCourses(cat.id);
            const totalUnits = assignedCourses.reduce((sum, c) => sum + (c.units || 3), 0);

            return (
              <div
                key={cat.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", idx.toString());
                  setDraggedVcatIndex(idx);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverVcatIndex !== idx) setDragOverVcatIndex(idx);
                }}
                onDragLeave={() => {
                  if (dragOverVcatIndex === idx) setDragOverVcatIndex(null);
                }}
                onDrop={() => handleVcatDrop(idx)}
                onDragEnd={() => {
                  setDraggedVcatIndex(null);
                  setDragOverVcatIndex(null);
                }}
                className={"rounded-2xl border p-3.5 transition-all duration-150 space-y-2.5 " + (
                  draggedVcatIndex === idx
                    ? "opacity-40 border-dashed border-primary bg-primary/5 scale-[0.99]"
                    : dragOverVcatIndex === idx
                    ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
                    : "border-border/70 bg-card hover:border-primary/40 shadow-2xs"
                )}
              >
                {/* Category Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 cursor-grab active:cursor-grabbing select-none">
                    <GripVertical className="h-4 w-4 text-muted-foreground/60 shrink-0 cursor-grab" />
                    <span
                      className="h-4 w-4 rounded-full border shadow-2xs shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="font-bold text-sm text-foreground">{cat.name}</span>
                    <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground font-normal">
                      #{idx + 1}
                    </Badge>
                    <Badge variant="secondary" className="text-[11px] font-medium">
                      {assignedCourses.length} درس ({totalUnits} واحد)
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setAssignModal({
                          open: true,
                          type: "visual",
                          categoryId: cat.id,
                          categoryName: cat.name,
                          categoryColor: cat.color,
                        })
                      }
                      className="h-7 text-xs gap-1 shadow-2xs font-medium"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-primary" />
                      انتخاب و تخصیص دروس
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (!confirm("آیا از حذف دسته بصری «" + cat.name + "» مطمئن هستید؟")) return;
                        await fetch("/api/categories?id=" + cat.id + "&type=visual", { method: "DELETE" });
                        const res = await fetch("/api/categories?trackId=" + selectedTrackId).then((r) =>
                          r.json()
                        );
                        if (res.success) setVisualCats(res.data.visual);
                      }}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                      title="حذف دسته"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Assigned Courses Chips Container */}
                <div className="pt-2 border-t border-border/50">
                  {assignedCourses.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {assignedCourses.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-lg bg-muted/40 border border-border/70 text-xs hover:bg-muted/70 transition-colors"
                        >
                          <span className="font-semibold text-foreground">{c.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">({c.code || (c.units + " واحد")})</span>
                          <button
                            type="button"
                            onClick={() => handleQuickUnassignVisual(cat.id, c.id)}
                            className="text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-full p-0.5 transition-colors"
                            title="حذف این درس از دسته"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      onClick={() =>
                        setAssignModal({
                          open: true,
                          type: "visual",
                          categoryId: cat.id,
                          categoryName: cat.name,
                          categoryColor: cat.color,
                        })
                      }
                      className="text-xs text-muted-foreground/80 italic py-1 cursor-pointer hover:text-primary transition-colors flex items-center gap-1.5"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-primary/70" />
                      <span>هیچ درسی به این دسته بصری اختصاص داده نشده است (جهت انتساب سریع درس‌ها کلیک کنید).</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {visualCats.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground space-y-1">
              <Palette className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p>دسته‌بندی بصری برای این گرایش تعریف نشده است.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. RULE CATEGORIES (STACKED FULL-WIDTH CARD WITH TREE & DEPTH 3 LIMIT) */}
      <Card className="rounded-2xl border-border/80 shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-primary" />
              <span>دسته‌های قوانین آموزشی و فارغ‌التحصیلی (ساختار درختی تا ۳ لایه)</span>
            </CardTitle>
            <CardDescription className="text-xs">
              ساختار درختی و دسته‌های والد و زیردسته جهت انتساب دروس و ساخت قوانین فارغ‌التحصیلی (حداکثر عمق: ۳ لایه)
            </CardDescription>
          </div>

          <Button
            size="sm"
            disabled={!selectedTrackId}
            onClick={() => {
              setRcatForm({ name: "", parentId: null });
              setRcatModalOpen(true);
            }}
            className="h-8 gap-1.5 text-xs shadow-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            افزودن دسته اصلی قوانین
          </Button>
        </CardHeader>

        <CardContent className="p-4 space-y-3.5">
          {(() => {
            const topLevelCats = ruleCats.filter(
              (c) => !c.parentId || !ruleCats.some((p) => p.id === c.parentId)
            );
            const getChildCats = (parentId: string) =>
              ruleCats.filter((c) => c.parentId === parentId);

            if (ruleCats.length === 0) {
              return (
                <div className="text-center py-8 text-xs text-muted-foreground space-y-1">
                  <FolderTree className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                  <p>دسته قوانینی برای این گرایش تعریف نشده است.</p>
                </div>
              );
            }

            return topLevelCats.map((parentCat, pIdx) => {
              const children = getChildCats(parentCat.id);
              const parentAssignedCourses = getRuleCategoryCourses(parentCat.id);
              const parentUnits = parentAssignedCourses.reduce((sum, c) => sum + (c.units || 3), 0);

              return (
                <div
                  key={parentCat.id}
                  draggable
                  onDragStart={(e) => {
                    e.stopPropagation();
                    setDraggedRcatId(parentCat.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (dragOverRcatId !== parentCat.id) setDragOverRcatId(parentCat.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverRcatId === parentCat.id) setDragOverRcatId(null);
                  }}
                  onDrop={(e) => {
                    e.stopPropagation();
                    handleRcatDrop(parentCat.id, null);
                  }}
                  onDragEnd={() => {
                    setDraggedRcatId(null);
                    setDragOverRcatId(null);
                  }}
                  className={"space-y-3 rounded-2xl border p-4 transition-all duration-150 " + (
                    draggedRcatId === parentCat.id
                      ? "opacity-40 border-dashed border-primary bg-primary/5 scale-[0.99]"
                      : dragOverRcatId === parentCat.id
                      ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
                      : "border-border/80 bg-card hover:border-border shadow-2xs"
                  )}
                >
                  {/* LEVEL 1: Parent Category Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 select-none">
                    <div className="flex items-center gap-2.5 cursor-grab active:cursor-grabbing">
                      <GripVertical className="h-4 w-4 text-muted-foreground/60 shrink-0 cursor-grab" />
                      <span className="h-3 w-3 rounded-md bg-primary shrink-0" />
                      <span className="font-bold text-sm text-foreground">{parentCat.name}</span>
                      <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground font-normal">
                        سطح ۱ • #{pIdx + 1}
                      </Badge>
                      <Badge variant="secondary" className="text-[11px] font-medium">
                        {parentAssignedCourses.length} درس ({parentUnits} واحد)
                      </Badge>
                      {children.length > 0 && (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal">
                          {children.length} زیردسته
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setAssignModal({
                            open: true,
                            type: "rule",
                            categoryId: parentCat.id,
                            categoryName: parentCat.name,
                          })
                        }
                        className="h-7 text-xs gap-1 shadow-2xs font-medium"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-primary" />
                        انتخاب و تخصیص دروس
                      </Button>

                      {/* Level 1 can add Level 2 Subcategory */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRcatForm({ name: "", parentId: parentCat.id });
                          setRcatModalOpen(true);
                        }}
                        className="h-7 text-xs px-2 gap-1 text-primary hover:bg-primary/10"
                        title="افزودن زیردسته (سطح ۲)"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        زیردسته
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm("آیا از حذف دسته قوانین «" + parentCat.name + "» و زیردسته‌های آن مطمئن هستید؟")) return;
                          await fetch("/api/categories?id=" + parentCat.id + "&type=rule", {
                            method: "DELETE",
                          });
                          const res = await fetch(
                            "/api/categories?trackId=" + selectedTrackId
                          ).then((r) => r.json());
                          if (res.success) setRuleCats(res.data.rule);
                        }}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        title="حذف دسته"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Level 1 Assigned Courses Chips */}
                  <div className="pt-2 border-t border-border/40">
                    {parentAssignedCourses.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {parentAssignedCourses.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-lg bg-primary/5 border border-primary/20 text-xs"
                          >
                            <span className="font-semibold text-foreground">{c.name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">({c.code || (c.units + " واحد")})</span>
                            <button
                              type="button"
                              onClick={() => handleQuickUnassignRule(parentCat.id, c.id)}
                              className="text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-full p-0.5 transition-colors"
                              title="حذف این درس از دسته"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        onClick={() =>
                          setAssignModal({
                            open: true,
                            type: "rule",
                            categoryId: parentCat.id,
                            categoryName: parentCat.name,
                          })
                        }
                        className="text-xs text-muted-foreground/80 italic py-0.5 cursor-pointer hover:text-primary transition-colors flex items-center gap-1.5"
                      >
                        <Sparkles className="h-3 w-3 text-primary/70" />
                        <span>هیچ درسی به این دسته اختصاص نیافته است (برای انتساب کلیک کنید).</span>
                      </div>
                    )}
                  </div>

                  {/* LEVEL 2 & LEVEL 3: Nested Children Subcategories */}
                  {children.length > 0 && (
                    <div className="mr-3 pr-3 border-r-2 border-primary/30 space-y-2.5 pt-1.5">
                      {children.map((childCat, cIdx) => {
                        const subChildren = getChildCats(childCat.id);
                        const childAssignedCourses = getRuleCategoryCourses(childCat.id);
                        const childUnits = childAssignedCourses.reduce((sum, c) => sum + (c.units || 3), 0);

                        return (
                          <div
                            key={childCat.id}
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation();
                              setDraggedRcatId(childCat.id);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (dragOverRcatId !== childCat.id) setDragOverRcatId(childCat.id);
                            }}
                            onDragLeave={() => {
                              if (dragOverRcatId === childCat.id) setDragOverRcatId(null);
                            }}
                            onDrop={(e) => {
                              e.stopPropagation();
                              handleRcatDrop(childCat.id, parentCat.id);
                            }}
                            onDragEnd={() => {
                              setDraggedRcatId(null);
                              setDragOverRcatId(null);
                            }}
                            className={"space-y-2 rounded-xl border p-3 text-xs transition-all duration-150 " + (
                              draggedRcatId === childCat.id
                                ? "opacity-40 border-dashed border-primary bg-primary/5"
                                : dragOverRcatId === childCat.id
                                ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30"
                                : "bg-muted/10 border-border/70 hover:border-primary/40 shadow-2xs"
                            )}
                          >
                            {/* Level 2 Row */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 select-none">
                              <div className="flex items-center gap-1.5 cursor-grab active:cursor-grabbing">
                                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 cursor-grab" />
                                <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                                <span className="font-bold text-foreground">{childCat.name}</span>
                                <Badge variant="outline" className="text-[9px] font-mono text-muted-foreground font-normal">
                                  سطح ۲ • #{cIdx + 1}
                                </Badge>
                                <Badge variant="secondary" className="text-[10px] font-normal">
                                  {childAssignedCourses.length} درس ({childUnits} واحد)
                                </Badge>
                                {subChildren.length > 0 && (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1 font-normal">
                                    {subChildren.length} زیردسته
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-1 self-end sm:self-auto">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setAssignModal({
                                      open: true,
                                      type: "rule",
                                      categoryId: childCat.id,
                                      categoryName: childCat.name,
                                    })
                                  }
                                  className="h-6 text-[11px] px-2 gap-1 shadow-2xs"
                                >
                                  <BookOpen className="h-3 w-3 text-primary" />
                                  انتخاب دروس
                                </Button>

                                {/* Level 2 can add Level 3 Subcategory */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRcatForm({ name: "", parentId: childCat.id });
                                    setRcatModalOpen(true);
                                  }}
                                  className="h-6 text-[10px] px-1.5 gap-0.5 text-primary hover:bg-primary/10"
                                  title="افزودن زیردسته سطح ۳"
                                >
                                  <Plus className="h-3 w-3" />
                                  زیردسته
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!confirm("آیا از حذف زیردسته «" + childCat.name + "» مطمئن هستید؟")) return;
                                    await fetch("/api/categories?id=" + childCat.id + "&type=rule", {
                                      method: "DELETE",
                                    });
                                    const res = await fetch(
                                      "/api/categories?trackId=" + selectedTrackId
                                    ).then((r) => r.json());
                                    if (res.success) setRuleCats(res.data.rule);
                                  }}
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                  title="حذف زیردسته"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>

                            {/* Level 2 Assigned Courses Chips */}
                            <div className="pt-1.5 border-t border-border/30">
                              {childAssignedCourses.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5 items-center">
                                  {childAssignedCourses.map((c) => (
                                    <div
                                      key={c.id}
                                      className="flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-md bg-background border border-border/70 text-[11px]"
                                    >
                                      <span className="font-medium text-foreground">{c.name}</span>
                                      <span className="text-[10px] text-muted-foreground">({c.code || (c.units + " واحد")})</span>
                                      <button
                                        type="button"
                                        onClick={() => handleQuickUnassignRule(childCat.id, c.id)}
                                        className="text-muted-foreground/60 hover:text-destructive p-0.5"
                                        title="حذف"
                                      >
                                        <X className="h-2.5 w-2.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div
                                  onClick={() =>
                                    setAssignModal({
                                      open: true,
                                      type: "rule",
                                      categoryId: childCat.id,
                                      categoryName: childCat.name,
                                    })
                                  }
                                  className="text-[11px] text-muted-foreground/70 italic py-0.5 cursor-pointer hover:text-primary transition-colors flex items-center gap-1"
                                >
                                  <Sparkles className="h-2.5 w-2.5 text-primary/70" />
                                  <span>هیچ درسی به این زیردسته اختصاص نیافته است.</span>
                                </div>
                              )}
                            </div>

                            {/* LEVEL 3: Deepest Allowed Subchildren (NO +زیردسته button here!) */}
                            {subChildren.length > 0 && (
                              <div className="mr-3 pr-2 border-r border-border/60 space-y-1.5 pt-1">
                                {subChildren.map((subChild, sIdx) => {
                                  const subAssignedCourses = getRuleCategoryCourses(subChild.id);
                                  const subUnits = subAssignedCourses.reduce((sum, c) => sum + (c.units || 3), 0);

                                  return (
                                    <div
                                      key={subChild.id}
                                      draggable
                                      onDragStart={(e) => {
                                        e.stopPropagation();
                                        setDraggedRcatId(subChild.id);
                                      }}
                                      onDragOver={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (dragOverRcatId !== subChild.id) setDragOverRcatId(subChild.id);
                                      }}
                                      onDragLeave={() => {
                                        if (dragOverRcatId === subChild.id) setDragOverRcatId(null);
                                      }}
                                      onDrop={(e) => {
                                        e.stopPropagation();
                                        handleRcatDrop(subChild.id, childCat.id);
                                      }}
                                      onDragEnd={() => {
                                        setDraggedRcatId(null);
                                        setDragOverRcatId(null);
                                      }}
                                      className="rounded-lg bg-background/90 border border-border/50 p-2 text-xs space-y-1.5"
                                    >
                                      {/* Level 3 Row */}
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 cursor-grab active:cursor-grabbing">
                                          <GripVertical className="h-3 w-3 text-muted-foreground/60 shrink-0 cursor-grab" />
                                          <CornerDownLeft className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                                          <span className="font-semibold text-foreground">{subChild.name}</span>
                                          <Badge variant="outline" className="text-[8px] font-mono font-normal">
                                            سطح ۳ (حداکثر عمق) • #{sIdx + 1}
                                          </Badge>
                                          <Badge variant="secondary" className="text-[9px] font-normal">
                                            {subAssignedCourses.length} درس ({subUnits} واحد)
                                          </Badge>
                                        </div>

                                        <div className="flex items-center gap-1">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                              setAssignModal({
                                                open: true,
                                                type: "rule",
                                                categoryId: subChild.id,
                                                categoryName: subChild.name,
                                              })
                                            }
                                            className="h-5 text-[10px] px-1.5 gap-0.5 shadow-2xs"
                                          >
                                            <BookOpen className="h-2.5 w-2.5 text-primary" />
                                            انتخاب دروس
                                          </Button>

                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              if (!confirm("آیا از حذف زیردسته «" + subChild.name + "» مطمئن هستید؟")) return;
                                              await fetch("/api/categories?id=" + subChild.id + "&type=rule", {
                                                method: "DELETE",
                                              });
                                              const res = await fetch(
                                                "/api/categories?trackId=" + selectedTrackId
                                              ).then((r) => r.json());
                                              if (res.success) setRuleCats(res.data.rule);
                                            }}
                                            className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                                            title="حذف زیردسته"
                                          >
                                            <Trash2 className="h-2.5 w-2.5" />
                                          </Button>
                                        </div>
                                      </div>

                                      {/* Level 3 Assigned Courses */}
                                      {subAssignedCourses.length > 0 && (
                                        <div className="flex flex-wrap gap-1 items-center pt-1 border-t border-border/20">
                                          {subAssignedCourses.map((c) => (
                                            <div
                                              key={c.id}
                                              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/40 text-[10px]"
                                            >
                                              <span>{c.name}</span>
                                              <button
                                                type="button"
                                                onClick={() => handleQuickUnassignRule(subChild.id, c.id)}
                                                className="text-muted-foreground/60 hover:text-destructive"
                                              >
                                                <X className="h-2 w-2" />
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </CardContent>
      </Card>

      {/* Direct Category Course Assign Modal */}
      {selectedTrackId && assignModal.open && (
        <CategoryCourseAssignDialog
          open={assignModal.open}
          onOpenChange={(open) => setAssignModal((prev) => ({ ...prev, open }))}
          trackId={selectedTrackId}
          type={assignModal.type}
          categoryId={assignModal.categoryId}
          categoryName={assignModal.categoryName}
          categoryColor={assignModal.categoryColor}
          allCourses={courses}
          currentAssignedCourseIds={
            assignModal.type === "visual"
              ? getVisualCategoryCourses(assignModal.categoryId).map((c) => c.id)
              : getRuleCategoryCourses(assignModal.categoryId).map((c) => c.id)
          }
          onSuccess={async () => {
            if (selectedTrackId) {
              const assignRes = await fetch("/api/tracks/assignments?trackId=" + selectedTrackId).then((r) =>
                r.json()
              );
              if (assignRes.success) setTrackAssignments(assignRes.data);
            }
          }}
        />
      )}

      {/* Add Visual Category Modal */}
      <Dialog open={vcatModalOpen} onOpenChange={setVcatModalOpen}>
        <DialogContent className="sm:max-w-xs" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">افزودن دسته بصری چارت</DialogTitle>
            <DialogDescription className="text-xs">
              رنگ و نام این دسته در پیش‌نمایش گرافیکی چارت نمایش داده خواهد شد.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateVcat} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">نام دسته بصری</Label>
              <Input
                required
                placeholder="مثلاً ترم اول یا دروس پایه"
                value={vcatForm.name}
                onChange={(e) => setVcatForm({ ...vcatForm, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">رنگ شاخص دسته</Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setVcatForm({ ...vcatForm, color: color.hex })}
                    className={"h-6 w-6 rounded-full transition-transform " + (
                      vcatForm.color === color.hex
                        ? "ring-2 ring-primary ring-offset-2 scale-110"
                        : "opacity-80 hover:opacity-100"
                    )}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <Button type="submit" size="sm" className="w-full h-8 text-xs font-bold">
              ثبت دسته بصری
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rule Category Modal with CategoryPicker restricted to depth < 3 */}
      <Dialog open={rcatModalOpen} onOpenChange={setRcatModalOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">افزودن دسته قوانین آموزشی</DialogTitle>
            <DialogDescription className="text-xs">
              دسته‌ها به صورت درختی و تا حداکثر ۳ لایه سازمان‌دهی می‌شوند.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateRcat} className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">دسته والد (اختیاری):</Label>
                <span className="text-[10px] text-muted-foreground">حداکثر عمق: ۳ لایه</span>
              </div>
              <CategoryPicker
                categories={eligibleParentCategories}
                value={rcatForm.parentId}
                onChange={(val) => setRcatForm({ ...rcatForm, parentId: val })}
                placeholder="دسته اصلی (بدون والد - سطح ۱)"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">نام دسته قوانین:</Label>
              <Input
                required
                placeholder="مثلاً شبکه‌های کامپیوتری"
                value={rcatForm.name}
                onChange={(e) => setRcatForm({ ...rcatForm, name: e.target.value })}
              />
            </div>

            <Button type="submit" className="w-full font-bold">
              ثبت دسته قوانین
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Track Structure Clone Dialog */}
      <TrackCloneDialog
        open={cloneModalOpen}
        onOpenChange={setCloneModalOpen}
        targetTrack={currentTrack || null}
        allTracks={tracks}
        allMajors={majors}
        onSuccess={() => {
          if (selectedTrackId) {
            loadTrackDetails(selectedTrackId);
          }
        }}
      />
    </div>
  );
}
