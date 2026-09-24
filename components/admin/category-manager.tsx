"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Layers,
  Building2,
  Plus,
  Trash2,
  Pencil,
  CornerDownLeft,
  GripVertical,
  BookOpen,
  X,
  Sparkles,
  Copy,
  FolderTree,
  Palette,
  Download,
  Upload,
  Link2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RefreshCw,
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
import { CategoryNode } from "./category-node";
import { CategoryImportDialog } from "./category-import-dialog";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { fetchJson, postJson, putJson, deleteJson } from "@/lib/api-client";
import type { Course, Category } from "@/lib/types";

const COLOR_PRESETS = [
  { name: "آبی", hex: "#3b82f6" },
  { name: "سبز", hex: "#10b981" },
  { name: "زرد", hex: "#f59e0b" },
  { name: "فیروزه ای", hex: "#44efc7" },
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
    categories,
    trackAssignments,
    selectedFacultyId,
    selectedMajorId,
    selectedTrackId,
    setCategories,
    setTrackAssignments,
    loadTrackDetails,
    setActionMessage,
  } = useAdminStore();

  const [loading, setLoading] = useState(false);

  // Self-fetch courses if not already in store
  useEffect(() => {
    if (courses.length === 0) {
      fetchJson("/api/courses").then((res) => {
        if (res.success && Array.isArray(res.data)) {
          useAdminStore.getState().setCourses(res.data);
        }
      });
    }
  }, [courses.length]);

  const fetchTrackData = async (trackId: string) => {
    if (!trackId) return;
    setLoading(true);
    try {
      await loadTrackDetails(trackId, true);
    } catch (e) {
      console.error("CategoryManager fetchTrackData error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTrackId) {
      fetchTrackData(selectedTrackId);
    }
  }, [selectedTrackId]);

  // Create & Clone Modals
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catModalError, setCatModalError] = useState<string | null>(null);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [catImportModalOpen, setCatImportModalOpen] = useState(false);

  // Edit Modal State
  const [catEditModalOpen, setCatEditModalOpen] = useState(false);
  const [catEditModalError, setCatEditModalError] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catEditForm, setCatEditForm] = useState<{
    code: string;
    name: string;
    color: string;
    parentId: string | null;
  }>({
    code: "",
    name: "",
    color: "#3b82f6",
    parentId: null,
  });

  // Create Form State
  const [catForm, setCatForm] = useState<{
    code: string;
    name: string;
    color: string;
    parentId: string | null;
  }>({
    code: "",
    name: "",
    color: "#3b82f6",
    parentId: null,
  });

  // Collapsed Categories State (persisted in localStorage)
  const [collapsedCatIdsArray, setCollapsedCatIdsArray] = usePersistedState<string[]>(
    "ut_ece_collapsed_cats",
    []
  );

  const collapsedCatIds = useMemo(() => new Set(collapsedCatIdsArray), [collapsedCatIdsArray]);

  const toggleCollapseCat = (catId: string) => {
    setCollapsedCatIdsArray((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const collapseAllCats = () => {
    setCollapsedCatIdsArray(categories.map((c) => c.id));
  };

  const expandAllCats = () => {
    setCollapsedCatIdsArray([]);
  };

  // Assign Modal State
  const [assignModal, setAssignModal] = useState<{
    open: boolean;
    categoryId: string;
    categoryName: string;
    categoryColor?: string;
  }>({
    open: false,
    categoryId: "",
    categoryName: "",
  });

  // Drag and Drop States
  const [draggedCatId, setDraggedCatId] = useState<string | null>(null);
  const [dragOverCatId, setDragOverCatId] = useState<string | null>(null);

  const currentFaculty = faculties.find((f) => f.id === selectedFacultyId);
  const currentMajor = majors.find((m) => m.id === selectedMajorId);
  const currentTrack = tracks.find((t) => t.id === selectedTrackId);

  const effectiveFacultyId = selectedFacultyId || currentMajor?.facultyId || currentFaculty?.id || "";
  const linkedFacultyIds = currentFaculty?.linkedFacultyIds || [];

  const facultyCourses = useMemo(() => {
    if (!effectiveFacultyId) return courses;
    return courses.filter(
      (c) => c.facultyId === effectiveFacultyId || linkedFacultyIds.includes(c.facultyId)
    );
  }, [courses, effectiveFacultyId, linkedFacultyIds]);

  // Helper: Get courses assigned to a category
  const getCategoryCourses = (catId: string): Course[] => {
    const assignedCourseIds = new Set(
      trackAssignments
        .filter((a) => a.categoryId === catId || (a as any).ruleCategoryId === catId || (a as any).visualCategoryId === catId)
        .map((a) => a.courseId)
    );
    return courses.filter((c) => assignedCourseIds.has(c.id));
  };

  // Helper: Map courses assigned to other categories of the same track
  const otherCategoryAssignments = useMemo(() => {
    if (!assignModal.open || !assignModal.categoryId) return {};
    const map: Record<string, { categoryId: string; categoryName: string; categoryColor?: string }> = {};

    for (const a of trackAssignments) {
      const aCatId = a.categoryId || (a as any).ruleCategoryId || (a as any).visualCategoryId;
      if (aCatId && aCatId !== assignModal.categoryId) {
        const cat = categories.find((c) => c.id === aCatId);
        map[a.courseId] = {
          categoryId: aCatId,
          categoryName: cat?.name || "دسته دیگر",
          categoryColor: cat?.color,
        };
      }
    }
    return map;
  }, [assignModal.open, assignModal.categoryId, trackAssignments, categories]);

  // Helper: Check if childId is a descendant of ancestorId
  const isDescendant = (childId: string, ancestorId: string): boolean => {
    let curr = categories.find((c) => c.id === childId);
    while (curr?.parentId) {
      if (curr.parentId === ancestorId) return true;
      curr = categories.find((c) => c.id === curr!.parentId);
    }
    return false;
  };

  // Quick Unassign Course from Category
  const handleQuickUnassign = async (catId: string, courseId: string) => {
    if (!selectedTrackId) return;

    // 1. Optimistic UI update: instantly remove from state for instant response
    const prevAssignments = trackAssignments;
    setTrackAssignments(
      trackAssignments.filter(
        (a) => !(a.trackId === selectedTrackId && a.courseId === courseId)
      )
    );

    try {
      // 2. Fast single-query unassign on server
      const res = await postJson("/api/tracks/assignments", {
        action: "unassign_course",
        trackId: selectedTrackId,
        courseId,
      });

      if (!res.success) {
        // Rollback on failure
        setTrackAssignments(prevAssignments);
        alert(res.message || "خطا در حذف درس از دسته");
      }
    } catch (err: any) {
      setTrackAssignments(prevAssignments);
      alert("خطا در برقراری ارتباط با سرور: " + (err?.message || "نامشخص"));
    }
  };

  // Create Category (Arbitrary depth supported)
  const handleCreateCat = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatModalError(null);
    if (!selectedTrackId) return;

    const res = await postJson("/api/categories", {
      trackId: selectedTrackId,
      code: catForm.code?.trim() || undefined,
      name: (catForm.name || "").trim(),
      color: catForm.color || "#3b82f6",
      parentId: catForm.parentId || null,
    });

    if (res.success) {
      setCatModalOpen(false);
      setCatModalError(null);
      setCatForm({ code: "", name: "", color: "#3b82f6", parentId: null });
      setActionMessage("دسته جدید با موفقیت اضافه شد.");
      await loadTrackDetails(selectedTrackId);
    } else {
      setCatModalError(res.message || "خطا در افزودن دسته");
    }
  };

  // Open Edit Category Modal
  const handleOpenEditCat = (cat: Category) => {
    setEditingCat(cat);
    setCatEditModalError(null);
    setCatEditForm({
      code: cat.code || "",
      name: cat.name || "",
      color: cat.color || "#3b82f6",
      parentId: cat.parentId || null,
    });
    setCatEditModalOpen(true);
  };

  // Update Category
  const handleUpdateCat = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatEditModalError(null);
    if (!editingCat || !selectedTrackId) return;

    if (catEditForm.parentId) {
      if (catEditForm.parentId === editingCat.id) {
        setCatEditModalError("خطا: یک دسته نمی‌تواند والد خودش باشد!");
        return;
      }
      if (isDescendant(catEditForm.parentId, editingCat.id)) {
        setCatEditModalError("خطا: نمی‌توانید یکی از زیردسته‌ها را به عنوان والد این دسته انتخاب کنید (ایجاد چرخه)!");
        return;
      }
    }

    const res = await putJson("/api/categories", {
      action: "update",
      id: editingCat.id,
      code: catEditForm.code?.trim() || null,
      name: (catEditForm.name || "").trim(),
      color: catEditForm.color || "#3b82f6",
      parentId: catEditForm.parentId || null,
    });

    if (res.success) {
      setCatEditModalOpen(false);
      setCatEditModalError(null);
      setEditingCat(null);
      setActionMessage("دسته با موفقیت ویرایش شد.");
      await loadTrackDetails(selectedTrackId);
    } else {
      setCatEditModalError(res.message || "خطا در ویرایش دسته");
    }
  };

  // Category Drag and Drop Reorder
  const handleCatDrop = async (targetCatId: string, parentId: string | null) => {
    if (!draggedCatId || draggedCatId === targetCatId) {
      setDraggedCatId(null);
      setDragOverCatId(null);
      return;
    }

    const siblings = categories.filter((c) => (c.parentId || null) === parentId);
    const draggedIdx = siblings.findIndex((c) => c.id === draggedCatId);
    const targetIdx = siblings.findIndex((c) => c.id === targetCatId);

    if (draggedIdx === -1 || targetIdx === -1) {
      setDraggedCatId(null);
      setDragOverCatId(null);
      return;
    }

    const reorderedSiblings = [...siblings];
    const [draggedItem] = reorderedSiblings.splice(draggedIdx, 1);
    reorderedSiblings.splice(targetIdx, 0, draggedItem);

    const otherCats = categories.filter((c) => (c.parentId || null) !== parentId);
    const newCategories = [...otherCats, ...reorderedSiblings];

    setCategories(newCategories);
    setDraggedCatId(null);
    setDragOverCatId(null);

    try {
      const itemsPayload = reorderedSiblings.map((item, idx) => ({
        id: item.id,
        sortOrder: idx + 1,
        parentId: parentId || null,
      }));
      await putJson("/api/categories", { action: "reorder", items: itemsPayload });
    } catch (err) {
      console.error("Reorder categories error:", err);
    }
  };

  // Filter categories eligible to be parent when editing an existing category
  const eligibleParentsForEdit = editingCat
    ? categories.filter((c) => {
        if (c.id === editingCat.id) return false;
        if (isDescendant(c.id, editingCat.id)) return false;
        return true;
      })
    : categories;

  // Render course chips list
  const renderCourseChips = (catId: string, catName: string, catColor?: string) => {
    const assignedCourses = getCategoryCourses(catId);

    if (assignedCourses.length === 0) {
      return (
        <div
          onClick={() =>
            setAssignModal({
              open: true,
              categoryId: catId,
              categoryName: catName,
              categoryColor: catColor,
            })
          }
          className="text-xs text-muted-foreground/80 italic py-1.5 cursor-pointer hover:text-primary transition-colors flex items-center gap-1.5"
        >
          <Sparkles className="h-4 w-4 text-primary/70 shrink-0" />
          <span>هیچ درسی به این دسته اختصاص داده نشده است (جهت انتساب سریع درس‌ها کلیک کنید).</span>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-2 items-center">
        {assignedCourses.map((c) => {
          const isLinked = Boolean(effectiveFacultyId && c.facultyId && c.facultyId !== effectiveFacultyId);
          return (
            <div
              key={c.id}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border text-xs transition-colors shadow-2xs bg-muted/40 border-border/70 hover:bg-muted/70"
            >
              <span className="font-semibold text-foreground">{c.name}</span>
              {isLinked && (
                <Badge
                  variant="outline"
                  className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 px-1 py-0 gap-0.5"
                >
                  <Link2 className="h-2.5 w-2.5" />
                  {c.facultyName || "لینک‌شده"}
                </Badge>
              )}
              {c.abbreviation && (
                <Badge variant="outline" className="text-[10px] font-mono font-medium px-1 py-0 text-primary border-primary/30 bg-primary/5">
                  {c.abbreviation}
                </Badge>
              )}
              <span className="text-muted-foreground font-mono text-xs">({c.code || (c.units + " واحد")})</span>
              <button
                type="button"
                onClick={() => handleQuickUnassign(catId, c.id)}
                className="text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-full p-0.5 transition-colors"
                title="حذف این درس از دسته"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

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
              <p className="text-xs text-muted-foreground mt-1">
                دسته‌ها برای گروه‌بندی دروس، نمایش بصری در چارت تحصیلی و قوانین آموزشی این گرایش استفاده می‌شوند.
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

      {/* UNIFIED CATEGORIES CARD */}
      <Card className="rounded-2xl border-border/80 shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-primary" />
              <span>دسته‌ها</span>
            </CardTitle>
            <CardDescription className="text-xs">
              مدیریت ساختار درختی دسته‌ها، رنگ شاخص و انتساب دروس جهت سازمان‌دهی چارت تحصیلی و قوانین آموزشی
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (!selectedTrackId) return;
                window.open(`/api/tracks/categories/export?trackId=${selectedTrackId}`, "_blank");
              }}
              disabled={!selectedTrackId || categories.length === 0}
              className="h-8 gap-1.5 text-xs shadow-2xs font-semibold"
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              <span>خروجی JSON</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCatImportModalOpen(true)}
              disabled={!selectedTrackId}
              className="h-8 gap-1.5 text-xs shadow-2xs font-semibold"
            >
              <Upload className="h-3.5 w-3.5 text-primary" />
              <span>ورودی JSON</span>
            </Button>

            <Button
              size="sm"
              disabled={!selectedTrackId}
              onClick={() => {
                setCatForm({ code: "", name: "", color: "#3b82f6", parentId: null });
                setCatModalOpen(true);
              }}
              className="h-8 gap-1.5 text-xs shadow-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              افزودن دسته اصلی
            </Button>

            {selectedTrackId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fetchTrackData(selectedTrackId)}
                disabled={loading}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                title="تازه‌سازی دسته‌بندی‌ها"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            )}

            {categories.length > 0 && (
              <div className="flex items-center gap-1 border-r pr-2 mr-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={expandAllCats}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground font-medium gap-1"
                  title="باز کردن تمام دسته‌ها"
                >
                  <ChevronDown className="h-3.5 w-3.5 text-primary" />
                  <span>باز کردن همه</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={collapseAllCats}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground font-medium gap-1"
                  title="بستن تمام دسته‌ها"
                >
                  <ChevronUp className="h-3.5 w-3.5 text-primary" />
                  <span>بستن همه</span>
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs font-medium">در حال دریافت دسته‌بندی‌ها و انتساب دروس گرایش...</p>
            </div>
          ) : (() => {
            const topLevelCats = categories.filter(
              (c) => !c.parentId || !categories.some((p) => p.id === c.parentId)
            );

            if (categories.length === 0) {
              return (
                <div className="text-center py-8 text-xs text-muted-foreground space-y-1">
                  <FolderTree className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                  <p>دسته‌ای برای این گرایش تعریف نشده است.</p>
                </div>
              );
            }

            return topLevelCats.map((parentCat) => (
              <CategoryNode
                key={parentCat.id}
                category={parentCat}
                depth={1}
                categories={categories}
                draggedCatId={draggedCatId}
                dragOverCatId={dragOverCatId}
                selectedTrackId={selectedTrackId}
                setDraggedCatId={setDraggedCatId}
                setDragOverCatId={setDragOverCatId}
                handleCatDrop={handleCatDrop}
                handleOpenEditCat={handleOpenEditCat}
                setCatForm={setCatForm}
                setCatModalOpen={setCatModalOpen}
                setAssignModal={(modalData) =>
                  setAssignModal({
                    open: modalData.open,
                    categoryId: modalData.categoryId,
                    categoryName: modalData.categoryName,
                    categoryColor: modalData.categoryColor,
                  })
                }
                setCategories={setCategories}
                getCategoryCourses={getCategoryCourses}
                renderCourseChips={renderCourseChips}
                onAssignmentsChanged={async () => {
                  if (selectedTrackId) await loadTrackDetails(selectedTrackId);
                }}
                collapsedIds={collapsedCatIds}
                onToggleCollapse={toggleCollapseCat}
              />
            ));
          })()}
        </CardContent>
      </Card>

      {/* Direct Category Course Assign Modal */}
      {selectedTrackId && assignModal.open && (
        <CategoryCourseAssignDialog
          open={assignModal.open}
          onOpenChange={(open) => setAssignModal((prev) => ({ ...prev, open }))}
          trackId={selectedTrackId}
          categoryId={assignModal.categoryId}
          categoryName={assignModal.categoryName}
          categoryColor={assignModal.categoryColor}
          allCourses={facultyCourses}
          currentFacultyId={effectiveFacultyId}
          otherCategoryAssignments={otherCategoryAssignments}
          currentAssignedCourseIds={getCategoryCourses(assignModal.categoryId).map((c) => c.id)}
          onSuccess={async (updatedData) => {
            if (updatedData && Array.isArray(updatedData)) {
              setTrackAssignments(updatedData);
            } else if (selectedTrackId) {
              const assignRes = await fetchJson("/api/tracks/assignments?trackId=" + selectedTrackId);
              if (assignRes.success) setTrackAssignments(assignRes.data);
            }
          }}
        />
      )}

      {/* Add Category Modal */}
      <Dialog
        open={catModalOpen}
        onOpenChange={(open) => {
          setCatModalOpen(open);
          setCatModalError(null);
        }}
      >
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">افزودن دسته جدید</DialogTitle>
            <DialogDescription className="text-xs">
              دسته‌ها به صورت درختی سازمان‌دهی می‌شوند و در نمایش چارت و قوانین استفاده می‌گردند.
            </DialogDescription>
          </DialogHeader>

          {/* Form Error Banner */}
          {catModalError && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{catModalError}</span>
            </div>
          )}

          <form onSubmit={handleCreateCat} className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">دسته والد (اختیاری):</Label>
              <CategoryPicker
                categories={categories}
                value={catForm.parentId}
                onChange={(val) => setCatForm({ ...catForm, parentId: val })}
                placeholder="دسته اصلی (بدون والد - ریشه)"
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">کد دسته:</Label>
                <span className="text-[10px] text-muted-foreground">اختیاری (تولید خودکار در صورت خالی بودن)</span>
              </div>
              <Input
                placeholder="مثلاً BASE-01 یا CORE-CS"
                value={catForm.code}
                onChange={(e) => setCatForm({ ...catForm, code: e.target.value.toUpperCase() })}
                className="h-8 text-xs"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">نام دسته:</Label>
              <Input
                required
                placeholder="مثلاً دروس پایه، دروس تخصصی یا ترم اول"
                value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">رنگ شاخص دسته:</Label>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setCatForm({ ...catForm, color: color.hex })}
                    className={`h-6 w-6 rounded-full transition-transform ${
                      catForm.color === color.hex
                        ? "ring-2 ring-primary ring-offset-2 scale-110"
                        : "opacity-80 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  />
                ))}
                <input
                  type="color"
                  value={catForm.color}
                  onChange={(e) => setCatForm({ ...catForm, color: e.target.value })}
                  className="h-6 w-6 rounded-full cursor-pointer border-0 p-0 bg-transparent"
                  title="انتخاب رنگ سفارشی"
                />
              </div>
            </div>

            <Button type="submit" size="sm" className="w-full h-8 text-xs font-bold">
              ثبت دسته
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Category Modal */}
      <Dialog
        open={catEditModalOpen}
        onOpenChange={(open) => {
          setCatEditModalOpen(open);
          setCatEditModalError(null);
        }}
      >
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-1.5">
              <Pencil className="h-4 w-4 text-primary" />
              <span>ویرایش دسته: {editingCat?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              نام، کد، رنگ و دسته والد را تغییر دهید.
            </DialogDescription>
          </DialogHeader>

          {/* Form Error Banner */}
          {catEditModalError && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{catEditModalError}</span>
            </div>
          )}

          <form onSubmit={handleUpdateCat} className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">دسته والد:</Label>
              <CategoryPicker
                categories={eligibleParentsForEdit}
                value={catEditForm.parentId}
                onChange={(val) => setCatEditForm({ ...catEditForm, parentId: val })}
                placeholder="دسته اصلی (بدون والد - ریشه)"
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">کد دسته:</Label>
                <span className="text-[10px] text-muted-foreground">اختیاری</span>
              </div>
              <Input
                placeholder="مثلاً BASE-01 یا CORE-CS"
                value={catEditForm.code}
                onChange={(e) => setCatEditForm({ ...catEditForm, code: e.target.value.toUpperCase() })}
                className="h-8 text-xs"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">نام دسته:</Label>
              <Input
                required
                placeholder="نام جدید دسته"
                value={catEditForm.name}
                onChange={(e) => setCatEditForm({ ...catEditForm, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">رنگ شاخص دسته:</Label>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setCatEditForm({ ...catEditForm, color: color.hex })}
                    className={`h-6 w-6 rounded-full transition-transform ${
                      catEditForm.color === color.hex
                        ? "ring-2 ring-primary ring-offset-2 scale-110"
                        : "opacity-80 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  />
                ))}
                <input
                  type="color"
                  value={catEditForm.color}
                  onChange={(e) => setCatEditForm({ ...catEditForm, color: e.target.value })}
                  className="h-6 w-6 rounded-full cursor-pointer border-0 p-0 bg-transparent"
                  title="انتخاب رنگ سفارشی"
                />
              </div>
            </div>

            <Button type="submit" size="sm" className="w-full h-8 text-xs font-bold">
              ذخیره تغییرات
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

      {/* Unified Category Import Dialog */}
      <CategoryImportDialog
        open={catImportModalOpen}
        onOpenChange={setCatImportModalOpen}
        trackId={selectedTrackId || undefined}
        trackName={currentTrack?.name || ""}
        onSuccess={async () => {
          if (selectedTrackId) {
            await loadTrackDetails(selectedTrackId);
          }
        }}
      />
    </div>
  );
}
