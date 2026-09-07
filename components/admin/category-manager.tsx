"use client";

import React, { useState, useMemo } from "react";
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
  Scale,
  Sparkles,
  Copy,
  FolderTree,
  Palette,
  RefreshCw,
  Download,
  Upload,
  Link2,
  ChevronDown,
  ChevronUp,
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
import { RuleCategoryNode } from "./rule-category-node";
import { VisualCategoryNode } from "./visual-category-node";
import { RuleCategoryImportDialog } from "./rule-category-import-dialog";
import { VisualCategoryImportDialog } from "./visual-category-import-dialog";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import type { Course, VisualCategory, RuleCategory } from "@/lib/types";

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

  // Create Modals
  const [vcatModalOpen, setVcatModalOpen] = useState(false);
  const [rcatModalOpen, setRcatModalOpen] = useState(false);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);

  // Edit Modals
  const [vcatEditModalOpen, setVcatEditModalOpen] = useState(false);
  const [editingVcat, setEditingVcat] = useState<VisualCategory | null>(null);
  const [vcatEditForm, setVcatEditForm] = useState<{ code: string; name: string; color: string; parentId: string | null }>({
    code: "",
    name: "",
    color: "#3b82f6",
    parentId: null,
  });

  const [rcatEditModalOpen, setRcatEditModalOpen] = useState(false);
  const [editingRcat, setEditingRcat] = useState<RuleCategory | null>(null);
  const [rcatEditForm, setRcatEditForm] = useState<{ code: string; name: string; parentId: string | null }>({
    code: "",
    name: "",
    parentId: null,
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [vcatForm, setVcatForm] = useState<{ code: string; name: string; color: string; sortOrder: number; parentId: string | null }>({
    code: "",
    name: "",
    color: "#3b82f6",
    sortOrder: 1,
    parentId: null,
  });
  const [rcatForm, setRcatForm] = useState<{ code: string; name: string; parentId: string | null }>({
    code: "",
    name: "",
    parentId: null,
  });
  const [rcatImportModalOpen, setRcatImportModalOpen] = useState(false);
  const [vcatImportModalOpen, setVcatImportModalOpen] = useState(false);

  // Collapsed Categories State (persisted in localStorage)
  const [collapsedRuleCatIdsArray, setCollapsedRuleCatIdsArray] = usePersistedState<string[]>(
    "ut_ece_collapsed_rcats",
    []
  );
  const [collapsedVisualCatIdsArray, setCollapsedVisualCatIdsArray] = usePersistedState<string[]>(
    "ut_ece_collapsed_vcats",
    []
  );

  const collapsedRuleCatIds = useMemo(() => new Set(collapsedRuleCatIdsArray), [collapsedRuleCatIdsArray]);
  const collapsedVisualCatIds = useMemo(() => new Set(collapsedVisualCatIdsArray), [collapsedVisualCatIdsArray]);

  const toggleCollapseRuleCat = (catId: string) => {
    setCollapsedRuleCatIdsArray((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const toggleCollapseVisualCat = (catId: string) => {
    setCollapsedVisualCatIdsArray((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const collapseAllRuleCats = () => {
    setCollapsedRuleCatIdsArray(ruleCats.map((c) => c.id));
  };

  const expandAllRuleCats = () => {
    setCollapsedRuleCatIdsArray([]);
  };

  const collapseAllVisualCats = () => {
    setCollapsedVisualCatIdsArray(visualCats.map((c) => c.id));
  };

  const expandAllVisualCats = () => {
    setCollapsedVisualCatIdsArray([]);
  };

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
  const [draggedVcatId, setDraggedVcatId] = useState<string | null>(null);
  const [dragOverVcatId, setDragOverVcatId] = useState<string | null>(null);

  const [draggedRcatId, setDraggedRcatId] = useState<string | null>(null);
  const [dragOverRcatId, setDragOverRcatId] = useState<string | null>(null);

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

  // Helper: Map courses assigned to other categories of the same track
  const otherCategoryAssignments = useMemo(() => {
    if (!assignModal.open || !assignModal.categoryId) return {};
    const map: Record<string, { categoryId: string; categoryName: string; categoryColor?: string }> = {};

    for (const a of trackAssignments) {
      if (assignModal.type === "visual") {
        if (a.visualCategoryId && a.visualCategoryId !== assignModal.categoryId) {
          const vcat = visualCats.find((c) => c.id === a.visualCategoryId);
          map[a.courseId] = {
            categoryId: a.visualCategoryId,
            categoryName: vcat?.name || "دسته بصری دیگر",
            categoryColor: vcat?.color,
          };
        }
      } else {
        if (a.ruleCategoryId && a.ruleCategoryId !== assignModal.categoryId) {
          const rcat = ruleCats.find((c) => c.id === a.ruleCategoryId);
          map[a.courseId] = {
            categoryId: a.ruleCategoryId,
            categoryName: rcat?.name || "دسته قوانین دیگر",
          };
        }
      }
    }
    return map;
  }, [assignModal.open, assignModal.categoryId, assignModal.type, trackAssignments, visualCats, ruleCats]);

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

  // Helper: Calculate subtree height (1 if leaf, 2 if has children, 3 if has grandchildren)
  const getSubtreeDepth = (catId: string): number => {
    const children = ruleCats.filter((c) => c.parentId === catId);
    if (children.length === 0) return 1;
    let maxChildSubtree = 0;
    for (const ch of children) {
      maxChildSubtree = Math.max(maxChildSubtree, getSubtreeDepth(ch.id));
    }
    return 1 + maxChildSubtree;
  };

  // Helper: Check if childId is a descendant of ancestorId
  const isDescendant = (childId: string, ancestorId: string): boolean => {
    let curr = ruleCats.find((c) => c.id === childId);
    while (curr?.parentId) {
      if (curr.parentId === ancestorId) return true;
      curr = ruleCats.find((c) => c.id === curr!.parentId);
    }
    return false;
  };

  // Helper: Calculate depth of visual category in tree (Level 1: 1, Level 2: 2, Level 3: 3)
  const getVisualCategoryDepth = (catId: string): number => {
    let depth = 1;
    let curr = visualCats.find((c) => c.id === catId);
    while (curr?.parentId) {
      depth++;
      curr = visualCats.find((c) => c.id === curr!.parentId);
    }
    return depth;
  };

  // Helper: Calculate visual subtree height
  const getVisualSubtreeDepth = (catId: string): number => {
    const children = visualCats.filter((c) => c.parentId === catId);
    if (children.length === 0) return 1;
    let maxChildSubtree = 0;
    for (const ch of children) {
      maxChildSubtree = Math.max(maxChildSubtree, getVisualSubtreeDepth(ch.id));
    }
    return 1 + maxChildSubtree;
  };

  // Helper: Check if childId is a descendant of ancestorId for visual categories
  const isVisualDescendant = (childId: string, ancestorId: string): boolean => {
    let curr = visualCats.find((c) => c.id === childId);
    while (curr?.parentId) {
      if (curr.parentId === ancestorId) return true;
      curr = visualCats.find((c) => c.id === curr!.parentId);
    }
    return false;
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

  // Create Visual Category (With Depth 3 check)
  const handleCreateVcat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrackId) return;

    if (vcatForm.parentId) {
      const parentDepth = getVisualCategoryDepth(vcatForm.parentId);
      if (parentDepth >= 3) {
        alert("خطا: ساختار درختی دسته‌های بصری حداکثر تا عمق ۳ لایه مجاز است.");
        return;
      }
    }

    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "visual",
        trackId: selectedTrackId,
        code: vcatForm.code?.trim() || undefined,
        name: (vcatForm.name || "").trim(),
        color: vcatForm.color,
        sortOrder: vcatForm.sortOrder,
        parentId: vcatForm.parentId || null,
      }),
    }).then((r) => r.json());

    if (res.success) {
      setVcatModalOpen(false);
      setVcatForm({ code: "", name: "", color: "#3b82f6", sortOrder: 1, parentId: null });
      setActionMessage("دسته بصری جدید با موفقیت اضافه شد.");
      await loadTrackDetails(selectedTrackId);
    }
  };

  // Open Edit Visual Category Modal
  const handleOpenEditVcat = (cat: VisualCategory) => {
    setEditingVcat(cat);
    setVcatEditForm({
      code: cat.code || "",
      name: cat.name || "",
      color: cat.color || "#3b82f6",
      parentId: cat.parentId || null,
    });
    setVcatEditModalOpen(true);
  };

  // Update Visual Category
  const handleUpdateVcat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVcat || !selectedTrackId) return;

    if (vcatEditForm.parentId) {
      if (vcatEditForm.parentId === editingVcat.id) {
        alert("خطا: یک دسته نمی‌تواند والد خودش باشد!");
        return;
      }
      if (isVisualDescendant(vcatEditForm.parentId, editingVcat.id)) {
        alert("خطا: نمی‌توانید یکی از زیردسته‌ها را به عنوان والد این دسته انتخاب کنید (ایجاد چرخه)!");
        return;
      }
      const parentDepth = getVisualCategoryDepth(vcatEditForm.parentId);
      const subtreeDepth = getVisualSubtreeDepth(editingVcat.id);
      if (parentDepth + subtreeDepth > 3) {
        alert("خطا: ساختار درختی دسته‌های بصری حداکثر تا عمق ۳ لایه مجاز است.");
        return;
      }
    }

    const res = await fetch("/api/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        type: "visual",
        id: editingVcat.id,
        code: vcatEditForm.code?.trim() || null,
        name: (vcatEditForm.name || "").trim(),
        color: vcatEditForm.color,
        parentId: vcatEditForm.parentId || null,
      }),
    }).then((r) => r.json());

    if (res.success) {
      setVcatEditModalOpen(false);
      setEditingVcat(null);
      setActionMessage("دسته بصری با موفقیت ویرایش شد.");
      await loadTrackDetails(selectedTrackId);
    } else {
      alert(res.message || "خطا در ویرایش دسته بصری");
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
        code: rcatForm.code?.trim() || undefined,
        name: (rcatForm.name || "").trim(),
        parentId: rcatForm.parentId,
      }),
    }).then((r) => r.json());

    if (res.success) {
      setRcatModalOpen(false);
      setRcatForm({ code: "", name: "", parentId: null });
      setActionMessage("دسته قوانین با موفقیت اضافه شد.");
      await loadTrackDetails(selectedTrackId);
    }
  };

  // Open Edit Rule Category Modal
  const handleOpenEditRcat = (cat: RuleCategory) => {
    setEditingRcat(cat);
    setRcatEditForm({ code: cat.code || "", name: cat.name || "", parentId: cat.parentId || null });
    setRcatEditModalOpen(true);
  };

  // Update Rule Category
  const handleUpdateRcat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRcat || !selectedTrackId) return;

    if (rcatEditForm.parentId) {
      if (rcatEditForm.parentId === editingRcat.id) {
        alert("خطا: یک دسته نمی‌تواند والد خودش باشد!");
        return;
      }
      if (isDescendant(rcatEditForm.parentId, editingRcat.id)) {
        alert("خطا: نمی‌توانید یکی از زیردسته‌ها را به عنوان والد این دسته انتخاب کنید (ایجاد چرخه)!");
        return;
      }
      const parentDepth = getCategoryDepth(rcatEditForm.parentId);
      const subtreeDepth = getSubtreeDepth(editingRcat.id);
      if (parentDepth + subtreeDepth > 3) {
        alert("خطا: ساختار درختی دسته‌های قوانین حداکثر تا عمق ۳ لایه مجاز است.");
        return;
      }
    }

    const res = await fetch("/api/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        type: "rule",
        id: editingRcat.id,
        code: rcatEditForm.code?.trim() || null,
        name: (rcatEditForm.name || "").trim(),
        parentId: rcatEditForm.parentId || null,
      }),
    }).then((r) => r.json());

    if (res.success) {
      setRcatEditModalOpen(false);
      setEditingRcat(null);
      setActionMessage("دسته قوانین با موفقیت ویرایش شد.");
      await loadTrackDetails(selectedTrackId);
    } else {
      alert(res.message || "خطا در ویرایش دسته قوانین");
    }
  };

  // Sync Visual Categories from Rule Categories (Preserving full tree & courses)
  const handleSyncVisualFromRules = async () => {
    if (!selectedTrackId) return;
    if (
      !confirm(
        "آیا از پاک کردن تمام دسته‌های بصری فعلی و کپی کامل ساختار درختی دسته‌های قوانین (به همراه کلیه دروس مربوطه) مطمئن هستید؟ این عملیات قابل بازگشت نیست."
      )
    ) {
      return;
    }

    setIsSyncing(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_from_rules",
          trackId: selectedTrackId,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setActionMessage(res.message || "دسته‌های بصری با موفقیت بر اساس ساختار درختی قوانین بازتولید شدند.");
        await loadTrackDetails(selectedTrackId);
      } else {
        alert(res.message || "خطا در همگام‌سازی دسته‌های بصری");
      }
    } catch (err) {
      console.error("Sync visual categories error:", err);
      alert("خطا در برقراری ارتباط با سرور");
    } finally {
      setIsSyncing(false);
    }
  };

  // Visual Category Drag and Drop Reorder
  const handleVcatDrop = async (targetCatId: string, parentId: string | null) => {
    if (!draggedVcatId || draggedVcatId === targetCatId) {
      setDraggedVcatId(null);
      setDragOverVcatId(null);
      return;
    }

    const siblings = visualCats.filter((c) => (c.parentId || null) === parentId);
    const draggedIdx = siblings.findIndex((c) => c.id === draggedVcatId);
    const targetIdx = siblings.findIndex((c) => c.id === targetCatId);

    if (draggedIdx === -1 || targetIdx === -1) {
      setDraggedVcatId(null);
      setDragOverVcatId(null);
      return;
    }

    const reorderedSiblings = [...siblings];
    const [draggedItem] = reorderedSiblings.splice(draggedIdx, 1);
    reorderedSiblings.splice(targetIdx, 0, draggedItem);

    const otherCats = visualCats.filter((c) => (c.parentId || null) !== parentId);
    const newVisualCats = [...otherCats, ...reorderedSiblings];

    setVisualCats(newVisualCats);
    setDraggedVcatId(null);
    setDragOverVcatId(null);

    try {
      const itemsPayload = reorderedSiblings.map((item, idx) => ({
        id: item.id,
        sortOrder: idx + 1,
        parentId: parentId || null,
      }));
      await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", type: "visual", items: itemsPayload }),
      });
    } catch (err) {
      console.error("Reorder visual categories error:", err);
    }
  };

  // Filter visual categories eligible to be parent for new categories (depth < 3)
  const eligibleVisualParentCategories = visualCats.filter((c) => getVisualCategoryDepth(c.id) < 3);

  // Filter visual categories eligible to be parent when editing an existing category
  const eligibleVisualParentsForEdit = editingVcat
    ? visualCats.filter((c) => {
        if (c.id === editingVcat.id) return false;
        if (isVisualDescendant(c.id, editingVcat.id)) return false;
        const pDepth = getVisualCategoryDepth(c.id);
        const subDepth = getVisualSubtreeDepth(editingVcat.id);
        return pDepth + subDepth <= 3;
      })
    : eligibleVisualParentCategories;

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

  // Filter categories eligible to be parent when editing an existing category
  const eligibleParentsForEdit = editingRcat
    ? ruleCats.filter((c) => {
        if (c.id === editingRcat.id) return false;
        if (isDescendant(c.id, editingRcat.id)) return false;
        const pDepth = getCategoryDepth(c.id);
        const subDepth = getSubtreeDepth(editingRcat.id);
        return pDepth + subDepth <= 3;
      })
    : eligibleParentCategories;

  // Render course chips list with identical formatting across all levels
  const renderCourseChips = (catId: string, type: "visual" | "rule", catName: string, catColor?: string) => {
    const assignedCourses = type === "visual" ? getVisualCategoryCourses(catId) : getRuleCategoryCourses(catId);

    if (assignedCourses.length === 0) {
      return (
        <div
          onClick={() =>
            setAssignModal({
              open: true,
              type,
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
              className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border text-xs transition-colors shadow-2xs bg-muted/40 border-border/70 hover:bg-muted/70 `}
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
                onClick={() => (type === "visual" ? handleQuickUnassignVisual(catId, c.id) : handleQuickUnassignRule(catId, c.id))}
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
                دسته‌های بصری و دسته‌های قوانین برای دروس این گرایش تنظیم می‌شوند. با کلیک روی هر دسته می‌توانید نام، رنگ، والد و دروس آن را ویرایش کنید.
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

      {/* 1. RULE CATEGORIES (STACKED FULL-WIDTH CARD WITH TREE & DEPTH 3 LIMIT) */}
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

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (!selectedTrackId) return;
                window.open(`/api/tracks/rule-categories/export?trackId=${selectedTrackId}`, "_blank");
              }}
              disabled={!selectedTrackId || ruleCats.length === 0}
              className="h-8 gap-1.5 text-xs shadow-2xs font-semibold"
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              <span>خروجی JSON</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRcatImportModalOpen(true)}
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
                setRcatForm({ code: "", name: "", parentId: null });
                setRcatModalOpen(true);
              }}
              className="h-8 gap-1.5 text-xs shadow-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              افزودن دسته اصلی قوانین
            </Button>

            {ruleCats.length > 0 && (
              <div className="flex items-center gap-1 border-r pr-2 mr-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={expandAllRuleCats}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground font-medium gap-1"
                  title="باز کردن تمام دسته‌های قوانین"
                >
                  <ChevronDown className="h-3.5 w-3.5 text-primary" />
                  <span>باز کردن همه</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={collapseAllRuleCats}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground font-medium gap-1"
                  title="بستن تمام دسته‌های قوانین"
                >
                  <ChevronUp className="h-3.5 w-3.5 text-primary" />
                  <span>بستن همه</span>
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {(() => {
            const topLevelCats = ruleCats.filter(
              (c) => !c.parentId || !ruleCats.some((p) => p.id === c.parentId)
            );

            if (ruleCats.length === 0) {
              return (
                <div className="text-center py-8 text-xs text-muted-foreground space-y-1">
                  <FolderTree className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                  <p>دسته قوانینی برای این گرایش تعریف نشده است.</p>
                </div>
              );
            }

            return topLevelCats.map((parentCat) => (
              <RuleCategoryNode
                key={parentCat.id}
                category={parentCat}
                depth={1}
                maxDepth={3}
                ruleCats={ruleCats}
                draggedRcatId={draggedRcatId}
                dragOverRcatId={dragOverRcatId}
                selectedTrackId={selectedTrackId}
                setDraggedRcatId={setDraggedRcatId}
                setDragOverRcatId={setDragOverRcatId}
                handleRcatDrop={handleRcatDrop}
                handleOpenEditRcat={handleOpenEditRcat}
                setRcatForm={setRcatForm}
                setRcatModalOpen={setRcatModalOpen}
                setAssignModal={setAssignModal}
                setRuleCats={setRuleCats}
                getRuleCategoryCourses={getRuleCategoryCourses}
                renderCourseChips={renderCourseChips}
                onAssignmentsChanged={async () => {
                  if (selectedTrackId) await loadTrackDetails(selectedTrackId);
                }}
                collapsedIds={collapsedRuleCatIds}
                onToggleCollapse={toggleCollapseRuleCat}
              />
            ));
          })()}
        </CardContent>
      </Card>

      {/* 2. VISUAL CATEGORIES (STACKED FULL-WIDTH CARD) */}
      <Card className="rounded-2xl border-border/80 shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              <span>دسته‌های بصری چارت (رنگی سایدبار چارت)</span>
            </CardTitle>
            <CardDescription className="text-xs">
              این دسته‌ها با رنگ دلخواه در سایدبار ساخت چارت به دانشجو نشان داده می‌شوند. برای تغییر نام، رنگ یا انتساب دروس از دکمه‌های مربوطه استفاده کنید.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (!selectedTrackId) return;
                window.open(`/api/tracks/visual-categories/export?trackId=${selectedTrackId}`, "_blank");
              }}
              disabled={!selectedTrackId || visualCats.length === 0}
              className="h-8 gap-1.5 text-xs shadow-2xs font-semibold"
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              <span>خروجی JSON</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setVcatImportModalOpen(true)}
              disabled={!selectedTrackId}
              className="h-8 gap-1.5 text-xs shadow-2xs font-semibold"
            >
              <Upload className="h-3.5 w-3.5 text-primary" />
              <span>ورود JSON</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={!selectedTrackId || isSyncing || ruleCats.length === 0}
              onClick={handleSyncVisualFromRules}
              className="h-8 gap-1.5 text-xs shadow-2xs font-semibold text-muted-foreground hover:text-foreground"
              title="پاک کردن دسته‌های بصری فعلی و کپی کامل ساختار درختی دسته‌های قوانین به همراه دروس"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin text-primary" : ""}`} />
              همگام‌سازی از قوانین
            </Button>

            <Button
              size="sm"
              disabled={!selectedTrackId}
              onClick={() => {
                setVcatForm({ code: "", name: "", color: "#3b82f6", sortOrder: visualCats.length + 1, parentId: null });
                setVcatModalOpen(true);
              }}
              className="h-8 gap-1.5 text-xs shadow-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              افزودن دسته بصری جدید
            </Button>

            {visualCats.length > 0 && (
              <div className="flex items-center gap-1 border-r pr-2 mr-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={expandAllVisualCats}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground font-medium gap-1"
                  title="باز کردن تمام دسته‌های بصری"
                >
                  <ChevronDown className="h-3.5 w-3.5 text-primary" />
                  <span>باز کردن همه</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={collapseAllVisualCats}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground font-medium gap-1"
                  title="بستن تمام دسته‌های بصری"
                >
                  <ChevronUp className="h-3.5 w-3.5 text-primary" />
                  <span>بستن همه</span>
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3.5">
          {(() => {
            const rootVisualCats = visualCats.filter(
              (c) => !c.parentId || !visualCats.some((p) => p.id === c.parentId)
            );

            if (rootVisualCats.length === 0) {
              return (
                <div className="text-center py-8 text-xs text-muted-foreground space-y-1">
                  <Palette className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                  <p>دسته‌بندی بصری برای این گرایش تعریف نشده است.</p>
                </div>
              );
            }

            return rootVisualCats.map((parentCat) => (
              <VisualCategoryNode
                key={parentCat.id}
                category={parentCat}
                depth={1}
                maxDepth={3}
                visualCats={visualCats}
                draggedVcatId={draggedVcatId}
                dragOverVcatId={dragOverVcatId}
                selectedTrackId={selectedTrackId}
                setDraggedVcatId={setDraggedVcatId}
                setDragOverVcatId={setDragOverVcatId}
                handleVcatDrop={handleVcatDrop}
                handleOpenEditVcat={handleOpenEditVcat}
                setVcatForm={setVcatForm}
                setVcatModalOpen={setVcatModalOpen}
                setAssignModal={setAssignModal}
                setVisualCats={setVisualCats}
                getVisualCategoryCourses={getVisualCategoryCourses}
                renderCourseChips={renderCourseChips}
                onAssignmentsChanged={async () => {
                  if (selectedTrackId) await loadTrackDetails(selectedTrackId);
                }}
                collapsedIds={collapsedVisualCatIds}
                onToggleCollapse={toggleCollapseVisualCat}
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
          type={assignModal.type}
          categoryId={assignModal.categoryId}
          categoryName={assignModal.categoryName}
          categoryColor={assignModal.categoryColor}
          allCourses={facultyCourses}
          currentFacultyId={effectiveFacultyId}
          otherCategoryAssignments={otherCategoryAssignments}
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

      {/* 1. Add Visual Category Modal */}
      <Dialog open={vcatModalOpen} onOpenChange={setVcatModalOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">افزودن دسته بصری چارت</DialogTitle>
            <DialogDescription className="text-xs">
              دسته‌ها به صورت درختی و تا حداکثر ۳ لایه سازمان‌دهی می‌شوند.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateVcat} className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">دسته والد (اختیاری):</Label>
                <span className="text-xs text-muted-foreground">حداکثر عمق: ۳ لایه</span>
              </div>
              <CategoryPicker
                categories={eligibleVisualParentCategories}
                value={vcatForm.parentId}
                onChange={(val) => setVcatForm({ ...vcatForm, parentId: val })}
                placeholder="دسته اصلی (بدون والد - سطح ۱)"
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">کد دسته:</Label>
                <span className="text-[10px] text-muted-foreground">اختیاری (تولید خودکار در صورت خالی بودن)</span>
              </div>
              <Input
                placeholder="مثلاً VCAT-BASE یا BASE-01"
                value={vcatForm.code}
                onChange={(e) => setVcatForm({ ...vcatForm, code: e.target.value.toUpperCase() })}
                className="h-8 text-xs"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">نام دسته بصری:</Label>
              <Input
                required
                placeholder="مثلاً ترم اول یا دروس پایه"
                value={vcatForm.name}
                onChange={(e) => setVcatForm({ ...vcatForm, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">رنگ شاخص دسته:</Label>
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

      {/* 2. Edit Visual Category Modal */}
      <Dialog open={vcatEditModalOpen} onOpenChange={setVcatEditModalOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-1.5">
              <Pencil className="h-4 w-4 text-primary" />
              <span>ویرایش دسته بصری چارت</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              نام، کد، دسته والد و رنگ اختصاصی این دسته بصری را تغییر دهید (حداکثر ۳ لایه).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateVcat} className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">دسته والد (اختیاری):</Label>
                <span className="text-xs text-muted-foreground">حداکثر عمق: ۳ لایه</span>
              </div>
              <CategoryPicker
                categories={eligibleVisualParentsForEdit}
                value={vcatEditForm.parentId}
                onChange={(val) => setVcatEditForm({ ...vcatEditForm, parentId: val })}
                placeholder="دسته اصلی (بدون والد - سطح ۱)"
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">کد دسته:</Label>
                <span className="text-[10px] text-muted-foreground">اختیاری (تولید خودکار در صورت خالی بودن)</span>
              </div>
              <Input
                placeholder="مثلاً VCAT-BASE یا BASE-01"
                value={vcatEditForm.code}
                onChange={(e) => setVcatEditForm({ ...vcatEditForm, code: e.target.value.toUpperCase() })}
                className="h-8 text-xs"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">نام دسته بصری:</Label>
              <Input
                required
                placeholder="نام دسته بصری"
                value={vcatEditForm.name}
                onChange={(e) => setVcatEditForm({ ...vcatEditForm, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">رنگ شاخص دسته:</Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setVcatEditForm({ ...vcatEditForm, color: color.hex })}
                    className={"h-6 w-6 rounded-full transition-transform " + (
                      vcatEditForm.color === color.hex
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
              ذخیره تغییرات دسته بصری
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 3. Add Rule Category Modal */}
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
                <span className="text-xs text-muted-foreground">حداکثر عمق: ۳ لایه</span>
              </div>
              <CategoryPicker
                categories={eligibleParentCategories}
                value={rcatForm.parentId}
                onChange={(val) => setRcatForm({ ...rcatForm, parentId: val })}
                placeholder="دسته اصلی (بدون والد - سطح ۱)"
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">کد دسته:</Label>
                <span className="text-[10px] text-muted-foreground">اختیاری (تولید خودکار در صورت خالی بودن)</span>
              </div>
              <Input
                placeholder="مثلاً RCAT-BASE یا CORE-CS"
                value={rcatForm.code}
                onChange={(e) => setRcatForm({ ...rcatForm, code: e.target.value.toUpperCase() })}
                className="h-8 text-xs"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">نام دسته قوانین:</Label>
              <Input
                required
                placeholder="مثلاً شبکه‌های کامپیوتری"
                value={rcatForm.name}
                onChange={(e) => setRcatForm({ ...rcatForm, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <Button type="submit" className="w-full font-bold">
              ثبت دسته قوانین
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 4. Edit Rule Category Modal */}
      <Dialog open={rcatEditModalOpen} onOpenChange={setRcatEditModalOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-1.5">
              <Pencil className="h-4 w-4 text-primary" />
              <span>ویرایش دسته قوانین: {editingRcat?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              نام، کد و دسته والد این دسته‌بندی را تغییر دهید (حداکثر عمق مجاز: ۳ لایه).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateRcat} className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">دسته والد:</Label>
                <span className="text-xs text-muted-foreground">حداکثر عمق: ۳ لایه</span>
              </div>
              <CategoryPicker
                categories={eligibleParentsForEdit}
                value={rcatEditForm.parentId}
                onChange={(val) => setRcatEditForm({ ...rcatEditForm, parentId: val })}
                placeholder="دسته اصلی (بدون والد - سطح ۱)"
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">کد دسته:</Label>
                <span className="text-[10px] text-muted-foreground">اختیاری (تولید خودکار در صورت خالی بودن)</span>
              </div>
              <Input
                placeholder="مثلاً RCAT-BASE یا CORE-CS"
                value={rcatEditForm.code}
                onChange={(e) => setRcatEditForm({ ...rcatEditForm, code: e.target.value.toUpperCase() })}
                className="h-8 text-xs"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">نام دسته قوانین:</Label>
              <Input
                required
                placeholder="نام جدید دسته"
                value={rcatEditForm.name}
                onChange={(e) => setRcatEditForm({ ...rcatEditForm, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <Button type="submit" className="w-full font-bold">
              ذخیره تغییرات دسته قوانین
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

      {/* Rule Categories Import Dialog */}
      <RuleCategoryImportDialog
        open={rcatImportModalOpen}
        onOpenChange={setRcatImportModalOpen}
        trackId={selectedTrackId || undefined}
        trackName={currentTrack?.name || ""}
        onSuccess={async () => {
          if (selectedTrackId) {
            await loadTrackDetails(selectedTrackId);
          }
        }}
      />

      {/* Visual Categories Import Dialog */}
      <VisualCategoryImportDialog
        open={vcatImportModalOpen}
        onOpenChange={setVcatImportModalOpen}
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
